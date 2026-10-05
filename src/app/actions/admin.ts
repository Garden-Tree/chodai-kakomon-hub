'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { removeExamFileIfUnreferenced } from '@/lib/exam-storage';
import { fail, ok, parseInput, runAction, type ActionResult } from '@/lib/action-result';
import { z } from 'zod';

const examIdSchema = z.string().uuid('有効な過去問IDを指定してください。');
const reportIdSchema = z.string().uuid('有効な通報IDを指定してください。');
const reasonSchema = z.string().trim().max(500, '非公開の理由は500文字以内で入力してください。').optional();

// 管理画面と、公開側の科目ページの表示を更新する
function revalidateAdminViews() {
  revalidatePath('/admin/reports');
  revalidatePath('/subject/[id]', 'page');
  revalidatePath('/mypage');
}

// 過去問を非公開にし、その過去問に対する未対応の通報をすべて「対応済み」にする
export async function hideExam(examId: string, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const { email } = await requireAdminUser();

    const validatedExamId = parseInput(examIdSchema, examId);
    const validatedReason = parseInput(reasonSchema, reason) || null;

    const exam = await prisma.exam.findUnique({
      where: { id: validatedExamId },
      select: { id: true },
    });

    if (!exam) {
      return fail('過去問が見つかりません。');
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.exam.update({
        where: { id: validatedExamId },
        data: { isHidden: true, hiddenReason: validatedReason },
      }),
      prisma.report.updateMany({
        where: { examId: validatedExamId, status: 'PENDING' },
        data: { status: 'RESOLVED', resolvedAt: now, resolvedBy: email },
      }),
    ]);

    revalidateAdminViews();

    return ok();
  });
}

// 非公開にした過去問を公開に戻す
export async function unhideExam(examId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdminUser();

    const validatedExamId = parseInput(examIdSchema, examId);

    const exam = await prisma.exam.findUnique({
      where: { id: validatedExamId },
      select: { id: true },
    });

    if (!exam) {
      return fail('過去問が見つかりません。');
    }

    await prisma.exam.update({
      where: { id: validatedExamId },
      data: { isHidden: false, hiddenReason: null },
    });

    revalidateAdminViews();

    return ok();
  });
}

// 通報を却下する（過去問はそのまま公開）
export async function dismissReport(reportId: string): Promise<ActionResult> {
  return runAction(async () => {
    const { email } = await requireAdminUser();

    const validatedReportId = parseInput(reportIdSchema, reportId);

    const report = await prisma.report.findUnique({
      where: { id: validatedReportId },
      select: { id: true },
    });

    if (!report) {
      return fail('通報が見つかりません。');
    }

    await prisma.report.update({
      where: { id: validatedReportId },
      data: { status: 'DISMISSED', resolvedAt: new Date(), resolvedBy: email },
    });

    revalidateAdminViews();

    return ok();
  });
}

// 過去問を完全に削除する（DBの行とStorage上のファイル。通報は Cascade で一緒に削除される）
export async function adminDeleteExam(examId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdminUser();

    const validatedExamId = parseInput(examIdSchema, examId);

    const exam = await prisma.exam.findUnique({
      where: { id: validatedExamId },
    });

    if (!exam) {
      return fail('過去問が見つかりません。');
    }

    // 1. DBから削除（先にDBを消すことで、ファイルだけ消えてリンク切れになる状態を防ぐ）
    await prisma.exam.delete({
      where: { id: exam.id },
    });

    // 2. Supabase Storageからファイルを削除（失敗してもDB削除は完了しているため、ログのみ出力）
    await removeExamFileIfUnreferenced(exam.fileUrl);

    revalidateAdminViews();

    return ok();
  });
}
