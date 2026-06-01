'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveExamData } from '@/app/actions/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Trash, Loader2 } from 'lucide-react';

const formSchema = z.object({
  facultyId: z.string().min(1, '学部を選択してください'),
  subjectId: z.string().min(1, '科目を選択してください'),
  newSubjectName: z.string().optional(),
  year: z.number().int().min(1900, '正しい年を入力してください'),
  instructor: z.string().min(1, '担当教員を入力してください'),
  comment: z.string().max(1000, '備考・メモは1000文字以内で入力してください').optional(),
  courseIds: z.array(z.string()).optional(),
  agreeTerms: z.boolean().refine(val => val === true, {
    message: 'アップロードには注意事項への同意が必要です',
  }),
}).superRefine((data, ctx) => {
  if (data.subjectId === 'new' && !data.newSubjectName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "科目名を入力してください",
      path: ["newSubjectName"]
    });
  }
  if (data.subjectId === 'new' && (!data.courseIds || data.courseIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "少なくとも1つのコースを選択してください",
      path: ["courseIds"]
    });
  }
});

type FormData = z.infer<typeof formSchema>;

// 画像ファイルをブラウザ上で結合して1つのPDFを生成するヘルパー関数
const compileImagesToPdf = async (
  imageFiles: { file: File }[], 
  subjectName: string, 
  year: number
): Promise<File> => {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i].file;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context could not be created');
    ctx.drawImage(img, 0, 0);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (i > 0) {
      doc.addPage();
    }

    const imgWidth = img.width;
    const imgHeight = img.height;
    const aspectRatio = imgWidth / imgHeight;

    let printWidth = pageWidth;
    let printHeight = pageWidth / aspectRatio;

    if (printHeight > pageHeight) {
      printHeight = pageHeight;
      printWidth = pageHeight * aspectRatio;
    }

    const x = (pageWidth - printWidth) / 2;
    const y = (pageHeight - printHeight) / 2;

    doc.addImage(jpegDataUrl, 'JPEG', x, y, printWidth, printHeight, undefined, 'FAST');
  }

  const pdfBlob = doc.output('blob');
  const cleanSubjectName = subjectName ? subjectName.replace(/[\\/:*?"<>|]/g, '_') : 'past_exam';
  const customFileName = `${cleanSubjectName}_${year}年度_過去問.pdf`;

  return new File([pdfBlob], customFileName, { type: 'application/pdf' });
};

export function UploadForm({ subjects, faculties, courses }: { subjects: any[], faculties: any[], courses: any[] }) {
  const router = useRouter();
  
  // ファイルアップロード関連状態
  const [uploadMode, setUploadMode] = useState<'pdf' | 'images'>('pdf');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const [isGuidelineOpen, setIsGuidelineOpen] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      facultyId: '',
      subjectId: '',
      comment: '',
      courseIds: [],
      agreeTerms: false,
    }
  });

  const facultyIdValue = watch('facultyId');
  const subjectIdValue = watch('subjectId');

  // 学部が変更されたら科目の選択とコースの選択をリセットする
  // また、コースが存在する場合はデフォルトで全選択にする
  useEffect(() => {
    setValue('subjectId', '');
    const courseIdsOfFaculty = courses.filter(c => c.facultyId === facultyIdValue).map(c => c.id);
    setValue('courseIds', courseIdsOfFaculty);
  }, [facultyIdValue, setValue, courses]);

  // 画像プレビュー用URLのクリーンアップ
  useEffect(() => {
    return () => {
      imageFiles.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, [imageFiles]);

  // 選択された学部の科目・コースを抽出
  const filteredSubjects = subjects.filter(s => s.facultyId === facultyIdValue);
  const selectedCourseIds = watch('courseIds') || [];
  const filteredCourses = courses.filter(c => c.facultyId === facultyIdValue);

  const handleAllCoursesToggle = (checked: boolean) => {
    if (checked) {
      setValue('courseIds', filteredCourses.map(c => c.id));
    } else {
      setValue('courseIds', []);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newImages = selectedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setImageFiles(prev => [...prev, ...newImages]);
  };

  const handleRemoveImage = (id: string) => {
    setImageFiles(prev => {
      const target = prev.find(img => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index === 0) return;
    if (direction === 'right' && index === imageFiles.length - 1) return;

    const newIndex = direction === 'left' ? index - 1 : index + 1;
    const newImages = [...imageFiles];
    const temp = newImages[index];
    newImages[index] = newImages[newIndex];
    newImages[newIndex] = temp;
    setImageFiles(newImages);
  };

  const onSubmit = async (data: FormData) => {
    let finalFile: File | null = null;

    if (uploadMode === 'pdf') {
      if (!pdfFile) {
        setError('PDFファイルを選択してください');
        return;
      }
      finalFile = pdfFile;
    } else {
      if (imageFiles.length === 0) {
        setError('少なくとも1つの画像ファイルを選択してください');
        return;
      }
      setIsUploading(true);
      setError('');
      setUploadStatus('画像をPDFに結合中...');
      try {
        const selectedSubject = subjects.find(s => s.id === data.subjectId);
        const subjectName = data.subjectId === 'new' ? data.newSubjectName : selectedSubject?.name;
        finalFile = await compileImagesToPdf(imageFiles, subjectName || '過去問', data.year);
      } catch (err: any) {
        console.error(err);
        setError('画像のPDF結合に失敗しました: ' + (err.message || ''));
        setIsUploading(false);
        setUploadStatus('');
        return;
      }
    }

    if (filteredCourses.length > 0 && selectedCourseIds.length === 0) {
      setError('少なくとも1つの対象コースを選択してください。');
      setIsUploading(false);
      setUploadStatus('');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadStatus('ファイルをアップロード中...');

    try {
      const supabase = createClient();
      const targetSubjectId = data.subjectId === 'new' ? crypto.randomUUID() : data.subjectId;
      const fileExt = finalFile.name.split('.').pop() || 'pdf';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${targetSubjectId}/${fileName}`;

      // クライアント側から直接Supabase Storageにアップロード
      const { error: uploadError } = await supabase.storage
        .from('exams')
        .upload(filePath, finalFile);

      if (uploadError) {
        throw new Error(`ファイルのアップロードに失敗しました: ${uploadError.message}`);
      }

      setUploadStatus('データベースに登録中...');

      // DBにメタデータを保存 (Server Action実行)
      const result = await saveExamData({
        ...data,
        targetSubjectId,
        fileUrl: filePath,
        fileName: finalFile.name,
      });

      // 完了後、アップロードした科目のページへリダイレクト
      router.push(`/subject/${result.subjectId}`);

    } catch (err: any) {
      console.error(err);
      setError(err.message || '予期せぬエラーが発生しました');
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm w-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">過去問ファイル情報</CardTitle>
        <CardDescription>
          アップロードする過去問の情報を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="faculty-select">学部</Label>
              <select
                id="faculty-select"
                {...register('facultyId')}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              >
                <option value="">学部を選択してください</option>
                {faculties.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.facultyId && <p className="text-sm text-red-500">{errors.facultyId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject-select">科目</Label>
              <select
                id="subject-select"
                {...register('subjectId')}
                disabled={!facultyIdValue}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm"
              >
                {!facultyIdValue ? (
                  <option value="">先に学部を選択してください</option>
                ) : (
                  <>
                    <option value="">科目を選択してください</option>
                    {filteredSubjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                    <option value="new">+ 新しい科目を追加する</option>
                  </>
                )}
              </select>
              {errors.subjectId && <p className="text-sm text-red-500">{errors.subjectId.message}</p>}
            </div>
          </div>

          {/* 新規科目が選択されたときだけ表示される入力欄 */}
          {subjectIdValue === 'new' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <Label htmlFor="new-subject-name">新しい科目名</Label>
              <Input
                id="new-subject-name"
                {...register('newSubjectName')}
                placeholder="例: 線形代数学II"
                className="bg-slate-50 border-blue-200 focus:border-blue-500"
              />
              {errors.newSubjectName && <p className="text-sm text-red-500">{errors.newSubjectName.message}</p>}
            </div>
          )}

          {/* 選択した学部にコースが存在するときは常に表示されるコース選択 */}
          {facultyIdValue && filteredCourses.length > 0 && (
            <div className="space-y-2 border border-slate-200 bg-slate-50 p-4 rounded-lg animate-in slide-in-from-top-2 duration-300">
              <Label className="font-semibold text-slate-800">対象コース</Label>
              <p className="text-xs text-slate-500 mb-3">この過去問が対象とするコースを選択してください（複数選択可）。</p>
              
              <div className="flex flex-col gap-2.5">
                {/* 全コース共通 */}
                <div className="flex items-center gap-2">
                  <input
                    id="all-courses-toggle"
                    type="checkbox"
                    checked={filteredCourses.length > 0 && filteredCourses.every(c => selectedCourseIds.includes(c.id))}
                    onChange={(e) => handleAllCoursesToggle(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="all-courses-toggle" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                    全コース共通
                  </label>
                </div>

                <hr className="border-slate-200 my-1" />

                {/* 個別コース */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                  {filteredCourses.map(course => (
                    <div key={course.id} className="flex items-center gap-2">
                      <input
                        id={`course-${course.id}`}
                        type="checkbox"
                        checked={selectedCourseIds.includes(course.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            setValue('courseIds', [...selectedCourseIds, course.id]);
                          } else {
                            setValue('courseIds', selectedCourseIds.filter(id => id !== course.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor={`course-${course.id}`} className="text-sm text-slate-600 cursor-pointer select-none">
                        {course.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {errors.courseIds && <p className="text-sm text-red-500 mt-1">{errors.courseIds.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year-input">開講年度</Label>
              <Input
                id="year-input"
                type="number"
                {...register('year', { valueAsNumber: true })}
              />
              {errors.year && <p className="text-sm text-red-500">{errors.year.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructor-input">担当教員</Label>
              <Input
                id="instructor-input"
                type="text"
                {...register('instructor')}
                placeholder="例: 佐藤 太郎"
              />
              {errors.instructor && <p className="text-sm text-red-500">{errors.instructor.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment-input">備考・メモ（任意）</Label>
            <Textarea
              id="comment-input"
              {...register('comment')}
              placeholder="例: 中間試験の問題です。解答は含まれていません。持ち込み情報など自由に記載してください。"
              className="min-h-[80px]"
            />
            {errors.comment && <p className="text-sm text-red-500">{errors.comment.message}</p>}
          </div>

          <div className="space-y-3 pt-2">
            <Label>過去問ファイル</Label>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit text-sm">
              <button
                type="button"
                onClick={() => setUploadMode('pdf')}
                className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer transition-all ${
                  uploadMode === 'pdf' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PDFファイルをアップロード
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('images')}
                className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer transition-all ${
                  uploadMode === 'images' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                複数画像からPDFを生成
              </button>
            </div>

            {uploadMode === 'pdf' ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative flex flex-col items-center justify-center min-h-[120px]">
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    {pdfFile ? <span className="font-medium text-slate-900">{pdfFile.name}</span> : 'クリックまたはドラッグ＆ドロップでPDFを選択'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">PDFファイルのみ</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative flex flex-col items-center justify-center min-h-[120px]">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-center">
                    <p className="text-sm text-slate-600">
                      クリックまたはドラッグ＆ドロップで画像を追加
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">複数選択可 (JPEG, PNG等)</p>
                  </div>
                </div>

                {imageFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-700">選択された画像 ({imageFiles.length}枚)</span>
                      <button
                        type="button"
                        onClick={() => {
                          imageFiles.forEach(img => URL.revokeObjectURL(img.previewUrl));
                          setImageFiles([]);
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium cursor-pointer"
                      >
                        すべてクリア
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      {imageFiles.map((img, index) => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white p-2 shadow-sm flex flex-col justify-between">
                          <div className="aspect-[3/4] relative w-full bg-slate-100 rounded-md overflow-hidden flex items-center justify-center">
                            <img
                              src={img.previewUrl}
                              alt={`ページ ${index + 1}`}
                              className="object-contain w-full h-full"
                            />
                            <div className="absolute top-1 left-1 bg-slate-900/70 text-white text-xs px-2 py-0.5 rounded font-bold">
                              {index + 1} ページ
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-2 gap-1">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveImage(index, 'left')}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 text-slate-700 cursor-pointer"
                                title="前に移動"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === imageFiles.length - 1}
                                onClick={() => handleMoveImage(index, 'right')}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 text-slate-700 cursor-pointer"
                                title="後ろに移動"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(img.id)}
                              className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                              title="削除"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">
                      ※左から右、上から下の順番でPDFのページになります。矢印ボタンで順番を変更できます。
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-start gap-2.5">
              <input
                id="agree-terms"
                type="checkbox"
                {...register('agreeTerms')}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="agree-terms" className="text-sm font-normal text-slate-600 leading-relaxed cursor-pointer select-none">
                ファイル内に<strong>個人情報（氏名・学籍番号など）</strong>が含まれていないこと、<br />
                および<button type="button" onClick={() => setIsGuidelineOpen(true)} className="text-blue-600 underline font-medium hover:text-blue-800 focus:outline-none cursor-pointer mx-1 inline">過去問共有のガイドライン</button>に同意します。
              </label>
            </div>
            {errors.agreeTerms && <p className="text-sm text-red-500">{errors.agreeTerms.message}</p>}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100 animate-in shake duration-300">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isUploading} className="w-full mt-4 h-11 text-base font-bold cursor-pointer flex items-center justify-center gap-2">
            {isUploading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isUploading ? (uploadStatus || '処理中...') : 'アップロードを完了する'}
          </Button>
        </form>
      </CardContent>

      {isGuidelineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">過去問共有のガイドライン</h3>
            <div className="space-y-4 text-sm text-slate-600 overflow-y-auto max-h-[60vh] pr-1">
              <div>
                <p className="font-semibold text-slate-800">1. 個人情報の完全な保護</p>
                <p className="pl-3 mt-1">
                  アップロードするファイル（問題用紙・解答・ノート等）に、自分や他の学生の<strong>氏名、学籍番号、連絡先、顔写真などの個人情報</strong>が一切含まれていないことを確認してください。必要に応じて黒塗りなどで完全に消去してください。
                </p>
              </div>
              
              <div>
                <p className="font-semibold text-slate-800">2. 著作権と配布の配慮</p>
                <p className="pl-3 mt-1">
                  教員が著作権を有し、外部への公開や配布を明示的に禁止している資料のアップロードは避けてください。本プラットフォームは学内における学習の助け合いを目的に運営されています。
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-800">3. 正確な情報の入力</p>
                <p className="pl-3 mt-1">
                  他の学生が正しく検索して対策できるよう、開講年度、担当教員、科目名を正しく入力してください。
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setIsGuidelineOpen(false)} className="px-4 py-2 cursor-pointer font-bold">
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
