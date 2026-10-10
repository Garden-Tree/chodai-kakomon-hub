'use server';

import { Prisma } from '@prisma/client';
import { requireUniversityUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail, ok, parseInput, runAction, type ActionResult } from '@/lib/action-result';
import { z } from 'zod';

// 通報理由の選択肢（src/components/ExamList.tsx の REASONS と一致させること）
const REPORT_REASONS = [
  '個人情報の掲載（氏名・学籍番号など）',
  '著作権侵害（教員から配布が禁止されている資料）',
  'ファイルの間違い（別科目のファイル、破損など）',
  'その他',
] as const;

const reportSchema = z.object({
  examId: z.string().uuid('有効な過去問IDを指定してください。'),
  reason: z.enum(REPORT_REASONS, { message: '通報理由を選択してください。' }),
  details: z.string().max(1000, '補足説明は1000文字以内で入力してください。').optional(),
});

// クライアントからは任意の文字列が送られうるため、入力型は緩く受けてZodで検証する
type CreateReportInput = {
  examId: string;
  reason: string;
  details?: string;
};

export async function createReport(data: CreateReportInput): Promise<ActionResult<{ reportId: string }>> {
  return runAction(async () => {
    // 認証の確認（大学のメールアドレスでログインしているユーザーのみ許可）
    const { email } = await requireUniversityUser();

    // データのバリデーション
    const validated = parseInput(reportSchema, data, {
      examId: '過去問',
      reason: '通報理由',
      details: '補足説明',
    });

    // 対象の過去問が存在するか確認
    const exam = await prisma.exam.findUnique({
      where: { id: validated.examId }
    });

    if (!exam) {
      return fail('対象の過去問が見つかりません。');
    }

    // レポートの作成（同一ユーザーによる同一過去問への重複通報はDBの一意制約で防ぐ）
    try {
      const report = await prisma.report.create({
        data: {
          examId: validated.examId,
          reason: validated.reason,
          details: validated.details || null,
          reportedBy: email,
        }
      });

      return ok({ reportId: report.id });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return fail('この過去問はすでに通報済みです。');
      }
      throw err;
    }
  });
}
