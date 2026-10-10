'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { saveExamData } from '@/app/actions/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Trash, Loader2 } from 'lucide-react';

const formSchema = z.object({
  facultyId: z.string().min(1, '学部を選択してください'),
  subjectId: z.string().min(1, '科目を選択してください'),
  newSubjectName: z.string().optional(),
  year: z
    .number({ error: '開講年度を入力してください' })
    .int('正しい年を入力してください')
    .min(1900, '正しい年を入力してください')
    .max(new Date().getFullYear(), `${new Date().getFullYear()}年以前の年度を入力してください`),
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

// ファイルサイズの上限（PDF・結合後のPDF共通）
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

// 画像の長辺の最大ピクセル数（メモリ使用量の抑制）
const MAX_IMAGE_DIMENSION = 2000;

// PDFページの余白 (mm)
const PAGE_MARGIN = 5;

// 画像ファイルをHTMLImageElementとして読み込む
const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `「${file.name}」を読み込めませんでした。HEICなど一部の形式には対応していません。JPEGまたはPNG形式に変換してもう一度お試しください。`
        )
      );
    };
    image.src = url;
  });

// 画像ファイルをブラウザ上で結合して1つのPDFを生成するヘルパー関数
const compileImagesToPdf = async (
  imageFiles: { file: File }[],
  subjectName: string,
  year: number,
  onProgress?: (current: number, total: number) => void
): Promise<File> => {
  const { jsPDF } = await import('jspdf');

  const A4_SHORT = 210;
  const A4_LONG = 297;

  let doc: InstanceType<typeof jsPDF> | null = null;

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i].file;
    onProgress?.(i + 1, imageFiles.length);

    const img = await loadImage(file);
    const srcWidth = img.naturalWidth || img.width;
    const srcHeight = img.naturalHeight || img.height;
    if (!srcWidth || !srcHeight) {
      throw new Error(`「${file.name}」のサイズを取得できませんでした。別の画像でお試しください。`);
    }

    // 長辺が上限を超える場合は縮小
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(srcWidth, srcHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(srcWidth * scale));
    canvas.height = Math.max(1, Math.round(srcHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context could not be created');
    // 透過PNGが黒くならないよう白で塗りつぶす
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const aspectRatio = canvas.width / canvas.height;
    // メモリ解放
    canvas.width = 0;
    canvas.height = 0;

    // 画像の向きに合わせてページの向きを決定
    const orientation = srcWidth > srcHeight ? 'landscape' : 'portrait';
    if (!doc) {
      doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    } else {
      doc.addPage('a4', orientation);
    }

    const pageWidth = orientation === 'landscape' ? A4_LONG : A4_SHORT;
    const pageHeight = orientation === 'landscape' ? A4_SHORT : A4_LONG;
    const maxWidth = pageWidth - PAGE_MARGIN * 2;
    const maxHeight = pageHeight - PAGE_MARGIN * 2;

    let printWidth = maxWidth;
    let printHeight = maxWidth / aspectRatio;
    if (printHeight > maxHeight) {
      printHeight = maxHeight;
      printWidth = maxHeight * aspectRatio;
    }

    const x = (pageWidth - printWidth) / 2;
    const y = (pageHeight - printHeight) / 2;

    doc.addImage(jpegDataUrl, 'JPEG', x, y, printWidth, printHeight, undefined, 'FAST');
  }

  if (!doc) throw new Error('画像が選択されていません');

  const pdfBlob = doc.output('blob');
  const cleanSubjectName = subjectName ? subjectName.replace(/[\\/:*?"<>|]/g, '_') : 'past_exam';
  const customFileName = `${cleanSubjectName}_${year}年度_過去問.pdf`;

  return new File([pdfBlob], customFileName, { type: 'application/pdf' });
};

// フォーム部品の共通スタイル（B案: 太めの濃紺枠 + 44px以上のタップ領域）
const INPUT_CLASS = 'bg-card border-2 border-ink/80 rounded-xl min-h-11 focus-visible:ring-2 focus-visible:ring-ring';
const SELECT_CLASS =
  'w-full min-h-11 rounded-xl border-2 border-ink/80 bg-card px-3 text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:text-sm';

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : '');

type Faculty = { id: string; name: string };
// courseIds: 管理者が設定した、その科目の現在のコース（未設定なら空配列）
type SubjectOption = { id: string; name: string; facultyId: string; courseIds: string[] };
type CourseOption = { id: string; name: string; facultyId: string };

export function UploadForm({
  subjects,
  faculties,
  courses,
  initialSubjectId,
}: {
  subjects: SubjectOption[],
  faculties: Faculty[],
  courses: CourseOption[],
  // /upload?subject=<id> で指定された科目（存在する場合のみ渡される）。学部・科目を事前選択する
  initialSubjectId?: string,
}) {
  const router = useRouter();
  const initialSubject = initialSubjectId ? subjects.find(s => s.id === initialSubjectId) : undefined;

  // 科目を選んだときのコースの初期選択。既存科目はその科目の現在のコース（管理者の編集を上書きしないため）、
  // コース未設定の科目・新規科目・未選択のときは学部の全コースにする
  const getDefaultCourseIds = (facultyId: string, subjectId: string): string[] => {
    const facultyCourseIds = courses.filter(c => c.facultyId === facultyId).map(c => c.id);
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return facultyCourseIds;
    const subjectCourseIds = subject.courseIds.filter(id => facultyCourseIds.includes(id));
    return subjectCourseIds.length > 0 ? subjectCourseIds : facultyCourseIds;
  };

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
      facultyId: initialSubject?.facultyId ?? '',
      subjectId: initialSubject?.id ?? '',
      comment: '',
      courseIds: initialSubject
        ? getDefaultCourseIds(initialSubject.facultyId, initialSubject.id)
        : [],
      agreeTerms: false,
    }
  });

  const facultyIdValue = watch('facultyId');
  const subjectIdValue = watch('subjectId');

  // 学部が変更されたら科目の選択とコースの選択をリセットする
  // また、コースが存在する場合はデフォルトで全選択にする
  // 事前選択された学部で初回レンダリングした場合は、科目の選択を維持するためリセットしない
  const processedFacultyRef = useRef(facultyIdValue);
  useEffect(() => {
    if (processedFacultyRef.current === facultyIdValue) return;
    processedFacultyRef.current = facultyIdValue;
    setValue('subjectId', '');
    const courseIdsOfFaculty = courses.filter(c => c.facultyId === facultyIdValue).map(c => c.id);
    setValue('courseIds', courseIdsOfFaculty);
  }, [facultyIdValue, setValue, courses]);

  // 既存の科目が選択されたら、コースの初期選択をその科目の現在のコースに合わせる
  // （「新しい科目」や未選択のときは学部の全コースのまま。初回レンダリング時は事前選択の値を維持する）
  const processedSubjectRef = useRef(subjectIdValue);
  useEffect(() => {
    if (processedSubjectRef.current === subjectIdValue) return;
    processedSubjectRef.current = subjectIdValue;
    setValue('courseIds', getDefaultCourseIds(facultyIdValue, subjectIdValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectIdValue]);

  // 画像プレビュー用URLのクリーンアップ（アンマウント時に残っているURLのみ解放）
  const imageFilesRef = useRef(imageFiles);
  useEffect(() => {
    imageFilesRef.current = imageFiles;
  }, [imageFiles]);
  useEffect(() => {
    return () => {
      imageFilesRef.current.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  // アップロード中のページ離脱を警告
  useEffect(() => {
    if (!isUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isUploading]);

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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_FILE_SIZE) {
      setPdfFile(null);
      e.target.value = '';
      setError(`ファイルサイズが大きすぎます（上限 ${MAX_FILE_SIZE_MB}MB）。`);
      return;
    }
    setError('');
    setPdfFile(file);
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
    const target = imageFiles.find(img => img.id === id);
    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }
    setImageFiles(prev => prev.filter(img => img.id !== id));
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
      if (pdfFile.size > MAX_FILE_SIZE) {
        setError(`ファイルサイズが大きすぎます（上限 ${MAX_FILE_SIZE_MB}MB）。`);
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
        finalFile = await compileImagesToPdf(
          imageFiles,
          subjectName || '過去問',
          data.year,
          (current, total) => setUploadStatus(`画像を結合中... (${current}/${total})`)
        );
      } catch (err) {
        console.error(err);
        setError(getErrorMessage(err) || '画像のPDF結合に失敗しました。画像の形式を確認してもう一度お試しください。');
        setIsUploading(false);
        setUploadStatus('');
        return;
      }
    }

    if (finalFile.size > MAX_FILE_SIZE) {
      setError(`生成されたPDFのサイズが大きすぎます（上限 ${MAX_FILE_SIZE_MB}MB）。画像の枚数を減らしてお試しください。`);
      setIsUploading(false);
      setUploadStatus('');
      return;
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

    const showError = (message: string) => {
      setError(message);
      setIsUploading(false);
      setUploadStatus('');
    };

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
        console.error(uploadError);
        showError(`ファイルのアップロードに失敗しました: ${uploadError.message}`);
        return;
      }

      setUploadStatus('データベースに登録中...');

      // DBにメタデータを保存 (Server Action実行)
      const result = await saveExamData({
        ...data,
        targetSubjectId,
        fileUrl: filePath,
        fileName: finalFile.name,
      });

      if (!result.ok) {
        showError(result.message);
        return;
      }

      // 完了後、アップロードした科目のページへリダイレクト
      router.push(`/subject/${result.data.subjectId}?uploaded=1`);

    } catch (err) {
      // 通信エラーなど、Server Action が結果を返せなかった場合
      console.error(err);
      showError('通信エラーが発生しました。通信環境を確認して再度お試しください。');
    }
  };

  return (
    <div className="card-pop w-full flex flex-col p-5 md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold">過去問ファイル情報</h2>
        <p className="text-sm text-muted-foreground mt-1">
          アップロードする過去問の情報を入力してください。
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="faculty-select">学部</Label>
            <select
              id="faculty-select"
              {...register('facultyId')}
              className={SELECT_CLASS}
            >
              <option value="">学部を選択してください</option>
              {faculties.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {errors.facultyId && <p className="text-sm text-red-700">{errors.facultyId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject-select">科目</Label>
            <select
              id="subject-select"
              {...register('subjectId')}
              disabled={!facultyIdValue}
              className={`${SELECT_CLASS} disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50`}
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
            {errors.subjectId && <p className="text-sm text-red-700">{errors.subjectId.message}</p>}
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
              className={INPUT_CLASS}
            />
            {errors.newSubjectName && <p className="text-sm text-red-700">{errors.newSubjectName.message}</p>}
          </div>
        )}

        {/* 選択した学部にコースが存在するときは常に表示されるコース選択 */}
        {facultyIdValue && filteredCourses.length > 0 && (
          <div className="space-y-2 bg-card border border-border p-4 rounded-xl animate-in slide-in-from-top-2 duration-300">
            <Label className="font-bold">対象コース</Label>
            <p className="text-xs text-muted-foreground mb-2">この過去問が対象とするコースを選択してください（複数選択可）。</p>

            <div className="flex flex-col gap-1">
              {/* 全コース共通 */}
              <div className="flex items-center gap-3 min-h-11">
                <input
                  id="all-courses-toggle"
                  type="checkbox"
                  checked={filteredCourses.length > 0 && filteredCourses.every(c => selectedCourseIds.includes(c.id))}
                  onChange={(e) => handleAllCoursesToggle(e.target.checked)}
                  className="size-5 accent-primary cursor-pointer"
                />
                <label htmlFor="all-courses-toggle" className="flex-1 text-sm font-bold cursor-pointer select-none py-2">
                  全コース共通
                </label>
              </div>

              <hr className="border-border my-1" />

              {/* 個別コース */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 pl-1">
                {filteredCourses.map(course => (
                  <div key={course.id} className="flex items-center gap-3 min-h-11">
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
                      className="size-5 accent-primary cursor-pointer"
                    />
                    <label htmlFor={`course-${course.id}`} className="flex-1 text-sm cursor-pointer select-none py-2">
                      {course.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            {errors.courseIds && <p className="text-sm text-red-700 mt-1">{errors.courseIds.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="year-input">開講年度</Label>
            <Input
              id="year-input"
              type="number"
              className={INPUT_CLASS}
              {...register('year', { valueAsNumber: true })}
            />
            {errors.year && <p className="text-sm text-red-700">{errors.year.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructor-input">担当教員</Label>
            <Input
              id="instructor-input"
              type="text"
              className={INPUT_CLASS}
              {...register('instructor')}
              placeholder="例: 佐藤 太郎"
            />
            {errors.instructor && <p className="text-sm text-red-700">{errors.instructor.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comment-input">備考・メモ（任意）</Label>
          <Textarea
            id="comment-input"
            {...register('comment')}
            placeholder="例: 中間試験の問題です。解答は含まれていません。持ち込み情報など自由に記載してください。"
            className="min-h-[88px] bg-card border-2 border-ink/80 rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.comment && <p className="text-sm text-red-700">{errors.comment.message}</p>}
        </div>

        <div className="space-y-3 pt-2">
          <Label>過去問ファイル</Label>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => setUploadMode('pdf')}
              aria-pressed={uploadMode === 'pdf'}
              className={`min-h-11 px-4 rounded-full border-2 border-ink font-bold cursor-pointer transition-colors ${
                uploadMode === 'pdf' ? 'bg-ink text-white' : 'bg-card text-foreground hover:bg-muted'
              }`}
            >
              PDFファイルをアップロード
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('images')}
              aria-pressed={uploadMode === 'images'}
              className={`min-h-11 px-4 rounded-full border-2 border-ink font-bold cursor-pointer transition-colors ${
                uploadMode === 'images' ? 'bg-ink text-white' : 'bg-card text-foreground hover:bg-muted'
              }`}
            >
              複数画像からPDFを生成
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            ファイルサイズの上限は{MAX_FILE_SIZE_MB}MBです（画像から生成する場合は、生成後のPDFが対象です）。
          </p>

          {uploadMode === 'pdf' ? (
            <div className="border-2 border-dashed border-ink/50 rounded-xl p-6 bg-muted hover:bg-secondary transition-colors cursor-pointer relative flex flex-col items-center justify-center min-h-[120px]">
              <Input
                type="file"
                accept="application/pdf"
                onChange={handlePdfChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="text-center">
                <p className="text-sm">
                  {pdfFile ? <span className="font-bold break-all">{pdfFile.name}</span> : 'クリックまたはドラッグ＆ドロップでPDFを選択'}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">PDFファイルのみ（{MAX_FILE_SIZE_MB}MBまで）</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-ink/50 rounded-xl p-6 bg-muted hover:bg-secondary transition-colors cursor-pointer relative flex flex-col items-center justify-center min-h-[120px]">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-center">
                  <p className="text-sm">
                    クリックまたはドラッグ＆ドロップで画像を追加
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">複数選択可 (JPEG, PNG等 / HEIC非対応)</p>
                </div>
              </div>

              {imageFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">選択された画像 ({imageFiles.length}枚)</span>
                    <button
                      type="button"
                      onClick={() => {
                        imageFiles.forEach(img => URL.revokeObjectURL(img.previewUrl));
                        setImageFiles([]);
                      }}
                      className="min-h-11 px-2 text-xs text-red-700 hover:text-red-800 hover:underline font-bold cursor-pointer"
                    >
                      すべてクリア
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3 bg-muted rounded-xl border border-border">
                    {imageFiles.map((img, index) => (
                      <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border bg-card p-2 flex flex-col justify-between">
                        <div className="aspect-[3/4] relative w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                          <img
                            src={img.previewUrl}
                            alt={`ページ ${index + 1}`}
                            className="object-contain w-full h-full"
                          />
                          <div className="absolute top-1 left-1 bg-ink/80 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                            {index + 1} ページ
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-between items-center mt-2 gap-1">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveImage(index, 'left')}
                              className="size-10 flex items-center justify-center rounded-lg bg-card border-2 border-ink hover:bg-muted disabled:opacity-30 disabled:hover:bg-card cursor-pointer"
                              title="前に移動"
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === imageFiles.length - 1}
                              onClick={() => handleMoveImage(index, 'right')}
                              className="size-10 flex items-center justify-center rounded-lg bg-card border-2 border-ink hover:bg-muted disabled:opacity-30 disabled:hover:bg-card cursor-pointer"
                              title="後ろに移動"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(img.id)}
                            className="size-10 flex items-center justify-center rounded-lg bg-card border-2 border-red-700 hover:bg-red-50 text-red-700 cursor-pointer"
                            title="削除"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ※左から右、上から下の順番でPDFのページになります。矢印ボタンで順番を変更できます。
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-start gap-3">
            <input
              id="agree-terms"
              type="checkbox"
              {...register('agreeTerms')}
              className="mt-1 size-5 shrink-0 accent-primary cursor-pointer"
            />
            <label htmlFor="agree-terms" className="text-sm leading-relaxed cursor-pointer select-none">
              ファイル内に<strong>個人情報（氏名・学籍番号など）</strong>が含まれていないこと、<br />
              および<button type="button" onClick={() => setIsGuidelineOpen(true)} className="text-primary underline font-bold hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer mx-1 inline">過去問共有のガイドライン</button>に同意します。
            </label>
          </div>
          {errors.agreeTerms && <p className="text-sm text-red-700">{errors.agreeTerms.message}</p>}
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-800 p-3 rounded-xl text-sm border-2 border-red-700 animate-in shake duration-300">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={isUploading}
          className="w-full mt-4 bg-primary text-primary-foreground edge-pop border-2 border-ink rounded-xl min-h-12 text-base font-bold cursor-pointer flex items-center justify-center gap-2"
        >
          {isUploading && <Loader2 className="w-5 h-5 animate-spin" />}
          {isUploading ? (uploadStatus || '処理中...') : 'アップロードを完了する'}
        </Button>
      </form>

      {isGuidelineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 animate-in fade-in duration-200">
          <div className="card-pop max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-4">過去問共有のガイドライン</h3>
            <div className="space-y-4 text-sm text-muted-foreground overflow-y-auto max-h-[60vh] pr-1">
              <div>
                <p className="font-bold text-foreground">1. 個人情報の完全な保護</p>
                <p className="pl-3 mt-1">
                  アップロードするファイル（問題用紙・解答・ノート等）に、自分や他の学生の<strong>氏名、学籍番号、連絡先、顔写真などの個人情報</strong>が一切含まれていないことを確認してください。必要に応じて黒塗りなどで完全に消去してください。
                </p>
              </div>

              <div>
                <p className="font-bold text-foreground">2. 著作権と配布の配慮</p>
                <p className="pl-3 mt-1">
                  教員が著作権を有し、外部への公開や配布を明示的に禁止している資料のアップロードは避けてください。本プラットフォームは学内における学習の助け合いを目的に運営されています。
                </p>
              </div>

              <div>
                <p className="font-bold text-foreground">3. 正確な情報の入力</p>
                <p className="pl-3 mt-1">
                  他の学生が正しく検索して対策できるよう、開講年度、担当教員、科目名を正しく入力してください。
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => setIsGuidelineOpen(false)}
                variant="outline"
                className="bg-card border-2 border-ink rounded-xl min-h-11 px-5 cursor-pointer font-bold"
              >
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
