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

const formSchema = z.object({
  facultyId: z.string().min(1, '学部を選択してください'),
  subjectId: z.string().min(1, '科目を選択してください'),
  newSubjectName: z.string().optional(),
  year: z.number().int().min(1900, '正しい年を入力してください'),
  instructor: z.string().min(1, '担当教員を入力してください'),
}).superRefine((data, ctx) => {
  if (data.subjectId === 'new' && !data.newSubjectName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "科目名を入力してください",
      path: ["newSubjectName"]
    });
  }
});

type FormData = z.infer<typeof formSchema>;

export function UploadForm({ subjects, faculties }: { subjects: any[], faculties: any[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      facultyId: '',
      subjectId: '',
    }
  });

  const facultyIdValue = watch('facultyId');
  const subjectIdValue = watch('subjectId');

  // 学部が変更されたら科目の選択をリセットする
  useEffect(() => {
    setValue('subjectId', '');
  }, [facultyIdValue, setValue]);

  // 選択された学部の科目のみを抽出
  const filteredSubjects = subjects.filter(s => s.facultyId === facultyIdValue);

  const onSubmit = async (data: FormData) => {
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const supabase = createClient();
      // 保存やStorageパスに使うためのSubject IDを決定（新規科目の場合はここでUUIDを採番）
      const targetSubjectId = data.subjectId === 'new' ? crypto.randomUUID() : data.subjectId;
      const fileExt = file.name.split('.').pop() || '';
      const fileName = `${crypto.randomUUID()}${fileExt ? `.${fileExt}` : ''}`;
      const filePath = `${targetSubjectId}/${fileName}`;

      // クライアント側から直接Supabase Storageにアップロード（Vercel上限を回避）
      const { error: uploadError } = await supabase.storage
        .from('exams')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`ファイルのアップロードに失敗しました: ${uploadError.message}`);
      }

      // DBにメタデータを保存 (Server Action実行)
      const result = await saveExamData({
        ...data,
        targetSubjectId,
        fileUrl: filePath,
        fileName: file.name,
      });

      // 完了後、アップロードした科目のページへリダイレクト
      router.push(`/subject/${result.subjectId}`);

    } catch (err: any) {
      console.error(err);
      setError(err.message || '予期せぬエラーが発生しました');
      setIsUploading(false);
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

          <div className="space-y-2 pt-2">
            <Label>ファイル</Label>
            <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
              <Input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="text-center">
                <p className="text-sm text-slate-600">
                  {file ? <span className="font-medium text-slate-900">{file.name}</span> : 'クリックまたはドラッグ＆ドロップで選択'}
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF または 画像ファイル</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100 animate-in shake duration-300">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isUploading} className="w-full mt-4 h-11 text-base font-bold">
            {isUploading ? 'アップロード中...' : 'アップロードを完了する'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
