'use server';

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const reportSchema = z.object({
  examId: z.string().uuid('有効な過去問IDを指定してください。'),
  reason: z.string().min(1, '通報理由を選択してください。').max(100),
  details: z.string().max(1000, '補足説明は1000文字以内で入力してください。').optional(),
});

export async function createReport(data: z.infer<typeof reportSchema>) {
  // 認証の確認
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    throw new Error('通報するにはログインが必要です。');
  }

  // データのバリデーション
  const validated = reportSchema.parse(data);

  // 対象の過去問が存在するか確認
  const exam = await prisma.exam.findUnique({
    where: { id: validated.examId }
  });

  if (!exam) {
    throw new Error('対象の過去問が見つかりません。');
  }

  // レポートの作成
  const report = await prisma.report.create({
    data: {
      examId: validated.examId,
      reason: validated.reason,
      details: validated.details || null,
      reportedBy: user.email,
    }
  });

  return { success: true, reportId: report.id };
}
