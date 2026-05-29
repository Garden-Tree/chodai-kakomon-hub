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
  comment: z.string().max(1000).optional(),
  courseIds: z.array(z.string()).optional(),
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
          courses: {
            connect: (validated.courseIds || []).map(id => ({ id }))
          }
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
      comment: validated.comment || null,
      courses: {
        connect: (validated.courseIds || []).map(id => ({ id }))
      },
      uploadedBy: user.email, // 認証済みユーザーのメールアドレスを記録
    }
  });

  return { success: true, examId: exam.id, subjectId: finalSubjectId };
}

const editFormSchema = z.object({
  examId: z.string().uuid(),
  year: z.number().int().min(1900).max(new Date().getFullYear()),
  instructor: z.string().min(1).max(100),
  comment: z.string().max(1000).optional(),
  courseIds: z.array(z.string()).optional(),
});

export async function updateExamData(data: z.infer<typeof editFormSchema>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    throw new Error('認証されていません。再度ログインしてください。');
  }

  const validated = editFormSchema.parse(data);

  // 過去問がユーザー自身のものであるか確認
  const existingExam = await prisma.exam.findUnique({
    where: { id: validated.examId }
  });

  if (!existingExam) {
    throw new Error('過去問が見つかりません。');
  }

  if (existingExam.uploadedBy !== user.email) {
    throw new Error('他のユーザーがアップロードした過去問は編集できません。');
  }

  // アップデート
  await prisma.exam.update({
    where: { id: validated.examId },
    data: {
      year: validated.year,
      instructor: validated.instructor,
      comment: validated.comment || null,
      courses: {
        set: (validated.courseIds || []).map(id => ({ id }))
      }
    }
  });

  return { success: true };
}

export async function deleteExamData(examId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    throw new Error('認証されていません。再度ログインしてください。');
  }

  // 過去問がユーザー自身のものであるか確認
  const existingExam = await prisma.exam.findUnique({
    where: { id: examId }
  });

  if (!existingExam) {
    throw new Error('過去問が見つかりません。');
  }

  if (existingExam.uploadedBy !== user.email) {
    throw new Error('他のユーザーがアップロードした過去問は削除できません。');
  }

  // 1. Supabase Storageからファイルを削除
  const { error: storageError } = await supabase.storage
    .from('exams')
    .remove([existingExam.fileUrl]);

  if (storageError) {
    console.error('Failed to delete file from storage:', storageError);
  }

  // 2. DBから削除
  await prisma.exam.delete({
    where: { id: examId }
  });

  return { success: true };
}
