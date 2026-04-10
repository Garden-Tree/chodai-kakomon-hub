'use server';

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const formSchema = z.object({
  facultyId: z.string().min(1),
  subjectId: z.string().min(1),
  targetSubjectId: z.string().uuid().optional(),
  newSubjectName: z.string().optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear()),
  instructor: z.string().min(1).max(100),
  fileUrl: z.string().min(1),
  fileName: z.string().optional(),
});

export async function saveExamData(data: z.infer<typeof formSchema>) {
  // 認証の確認
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    throw new Error('認証されていません。再度ログインしてください。');
  }

  // データのバリデーション
  const validated = formSchema.parse(data);

  let finalSubjectId = validated.subjectId;

  // 新規科目の作成処理が選択された場合
  if (validated.subjectId === 'new') {
    if (!validated.newSubjectName || !validated.facultyId || !validated.targetSubjectId) {
      throw new Error('新規科目の情報が不足しています。');
    }
    
    // 同じ学部内に同名の科目が重複作成されるのを防ぐ処理
    let subject = await prisma.subject.findUnique({
      where: {
        name_facultyId: {
          name: validated.newSubjectName,
          facultyId: validated.facultyId,
        }
      }
    });

    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          id: validated.targetSubjectId,
          name: validated.newSubjectName,
          facultyId: validated.facultyId,
        }
      });
    }
    finalSubjectId = subject.id; // 作成された（または既存の）科目のIDを適用
  }

  // DBに過去問データを保存
  const exam = await prisma.exam.create({
    data: {
      subjectId: finalSubjectId,
      year: validated.year,
      instructor: validated.instructor,
      fileUrl: validated.fileUrl,
      fileName: validated.fileName,
      uploadedBy: user.email, // 認証済みユーザーのメールアドレスを記録
    }
  });

  return { success: true, examId: exam.id, subjectId: finalSubjectId };
}
