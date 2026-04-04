'use client';

import { useState } from 'react';
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
  subjectId: z.string().min(1, '科目を選択してください'),
  newSubjectFacultyId: z.string().optional(),
  newSubjectName: z.string().optional(),
  year: z.number().int().min(1900, '正しい年を入力してください'),
  instructor: z.string().min(1, '担当教員を入力してください'),
}).superRefine((data, ctx) => {
  if (data.subjectId === 'new') {
    if (!data.newSubjectFacultyId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "学部を選択してください", path: ["newSubjectFacultyId"] });
    }
    if (!data.newSubjectName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "科目名を入力してください", path: ["newSubjectName"] });
    }
  }
});

type FormData = z.infer<typeof formSchema>;

export function UploadForm({ subjects, faculties }: { subjects: any[], faculties: any[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      year: new Date().getFullYear(),
    }
  });

  const subjectIdValue = watch('subjectId');

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
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>過去問ファイル情報</CardTitle>
        <CardDescription>
          アップロードする過去問の科目、年度、担当教員を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label>科目</Label>
            <select
              {...register('subjectId')}
              className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
            >
              <option value="">科目を選択してください</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.faculty.name} - {subject.name}
                </option>
              ))}
              <option value="new">+ 新しい科目を追加する</option>
            </select>
            {errors.subjectId && <p className="text-sm text-red-500">{errors.subjectId.message}</p>}
          </div>

          {/* 新規科目が選択されたときだけ表示される入力欄 */}
          {subjectIdValue === 'new' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 border border-slate-200 rounded-md">
              <div className="space-y-2">
                <Label>学部 (新規科目用)</Label>
                <select
                  {...register('newSubjectFacultyId')}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">学部を選択してください</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {errors.newSubjectFacultyId && <p className="text-sm text-red-500">{errors.newSubjectFacultyId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>科目名 (新規科目用)</Label>
                <Input
                  {...register('newSubjectName')}
                  placeholder="例: 線形代数学II"
                  className="bg-white"
                />
                {errors.newSubjectName && <p className="text-sm text-red-500">{errors.newSubjectName.message}</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>開講年度</Label>
              <Input
                type="number"
                {...register('year', { valueAsNumber: true })}
                className="w-full"
              />
              {errors.year && <p className="text-sm text-red-500">{errors.year.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>担当教員</Label>
              <Input
                type="text"
                {...register('instructor')}
                placeholder="例: 佐藤 太郎"
                className="w-full"
              />
              {errors.instructor && <p className="text-sm text-red-500">{errors.instructor.message}</p>}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label>過去問ファイル (PDF, 画像等)</Label>
            <div className="border border-slate-200 rounded-md p-1 bg-slate-50">
              <Input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="bg-white"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isUploading} className="w-full mt-4">
            {isUploading ? 'アップロード処理中...' : 'アップロードを完了する'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
