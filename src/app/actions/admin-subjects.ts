'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fail, ok, parseInput, runAction, type ActionResult } from '@/lib/action-result';

// ID は UUID に限らない（手動で登録された ID も許容する）。存在確認は各アクション側で行う
const subjectIdSchema = z.string().min(1, '有効な科目IDを指定してください。').max(100, '有効な科目IDを指定してください。');
const courseIdsSchema = z
  .array(z.string().min(1, '有効なコースIDを指定してください。').max(100, '有効なコースIDを指定してください。'))
  .max(200);
const subjectNameSchema = z
  .string()
  .trim()
  .min(1, '科目名を入力してください。')
  .max(100, '科目名は100文字以内で入力してください。');

// 管理画面・トップページ・科目ページの表示を更新する
function revalidateSubjectViews() {
  revalidatePath('/admin/subjects');
  revalidatePath('/');
  revalidatePath('/subject/[id]', 'page');
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

const DUPLICATE_NAME_MESSAGE = '同じ学部に同名の科目がすでに存在します。';

// 科目名を変更する
export async function renameSubject(subjectId: string, newName: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdminUser();

    const validatedId = parseInput(subjectIdSchema, subjectId);
    const validatedName = parseInput(subjectNameSchema, newName, { '': '科目名' });

    const subject = await prisma.subject.findUnique({
      where: { id: validatedId },
      select: { id: true, name: true, facultyId: true },
    });

    if (!subject) {
      return fail('科目が見つかりません。');
    }

    if (subject.name === validatedName) {
      return ok();
    }

    const duplicate = await prisma.subject.findUnique({
      where: { name_facultyId: { name: validatedName, facultyId: subject.facultyId } },
      select: { id: true },
    });

    if (duplicate) {
      return fail(DUPLICATE_NAME_MESSAGE);
    }

    try {
      await prisma.subject.update({
        where: { id: subject.id },
        data: { name: validatedName },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return fail(DUPLICATE_NAME_MESSAGE);
      }
      throw err;
    }

    revalidateSubjectViews();

    return ok();
  });
}

// 科目 source を科目 target に統合する（過去問とコースを target に移し、source を削除する）
export async function mergeSubjects(sourceId: string, targetId: string): Promise<ActionResult<{ movedExams: number }>> {
  return runAction(async () => {
    await requireAdminUser();

    const validatedSourceId = parseInput(subjectIdSchema, sourceId);
    const validatedTargetId = parseInput(subjectIdSchema, targetId);

    if (validatedSourceId === validatedTargetId) {
      return fail('統合元と統合先に同じ科目は指定できません。');
    }

    const result = await prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.subject.findUnique({
          where: { id: validatedSourceId },
          select: { id: true, facultyId: true, courses: { select: { id: true } } },
        }),
        tx.subject.findUnique({
          where: { id: validatedTargetId },
          select: { id: true, facultyId: true },
        }),
      ]);

      if (!source || !target) {
        return { error: '科目が見つかりません。', movedExams: 0 };
      }

      if (source.facultyId !== target.facultyId) {
        return { error: '異なる学部の科目は統合できません。', movedExams: 0 };
      }

      // Storage 上のファイルは移動しない。fileUrl は過去問ごとに保存されているため、
      // 科目を付け替えても旧パスのままダウンロードできる。
      const moved = await tx.exam.updateMany({
        where: { subjectId: source.id },
        data: { subjectId: target.id },
      });

      if (source.courses.length > 0) {
        await tx.subject.update({
          where: { id: target.id },
          data: { courses: { connect: source.courses.map((course) => ({ id: course.id })) } },
        });
      }

      await tx.subject.delete({ where: { id: source.id } });

      return { error: null, movedExams: moved.count };
    });

    if (result.error) {
      return fail(result.error);
    }

    revalidateSubjectViews();

    return ok({ movedExams: result.movedExams });
  });
}

// 過去問が1件もない科目を削除する
export async function deleteEmptySubject(subjectId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdminUser();

    const validatedId = parseInput(subjectIdSchema, subjectId);

    const error = await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.findUnique({
        where: { id: validatedId },
        select: { id: true, _count: { select: { exams: true } } },
      });

      if (!subject) {
        return '科目が見つかりません。';
      }

      if (subject._count.exams > 0) {
        return '過去問が登録されている科目は削除できません。';
      }

      await tx.subject.delete({ where: { id: subject.id } });
      return null;
    });

    if (error) {
      return fail(error);
    }

    revalidateSubjectViews();

    return ok();
  });
}

// 科目に紐づくコースを置き換える（同じ学部のコースのみ指定可能）
export async function setSubjectCourses(subjectId: string, courseIds: string[]): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdminUser();

    const validatedId = parseInput(subjectIdSchema, subjectId);
    const validatedCourseIds = Array.from(new Set(parseInput(courseIdsSchema, courseIds)));

    const subject = await prisma.subject.findUnique({
      where: { id: validatedId },
      select: { id: true, facultyId: true },
    });

    if (!subject) {
      return fail('科目が見つかりません。');
    }

    const validCourses = await prisma.course.count({
      where: { id: { in: validatedCourseIds }, facultyId: subject.facultyId },
    });

    if (validCourses !== validatedCourseIds.length) {
      return fail('この科目の学部に属さないコースが含まれています。');
    }

    await prisma.subject.update({
      where: { id: subject.id },
      data: { courses: { set: validatedCourseIds.map((id) => ({ id })) } },
    });

    revalidateSubjectViews();

    return ok();
  });
}
