'use server';

import { Prisma } from '@prisma/client';
import { requireUniversityUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabase';
import { STORAGE_BUCKET, removeExamFileIfUnreferenced } from '@/lib/exam-storage';
import { ActionError, fail, ok, parseInput, runAction, type ActionResult } from '@/lib/action-result';
import { z } from 'zod';
import { normalizeInstructor } from '@/lib/normalize-instructor';

// クライアント（UploadForm）がアップロードする Storage 上のパス形式: `<科目UUID>/<ランダムUUID>.pdf`
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// 拡張子は元ファイル名から取得されるため、大文字の「.PDF」も許容する
const FILE_URL_REGEX = new RegExp(`^(${UUID_PATTERN})/(${UUID_PATTERN}\\.(?:pdf|PDF))$`);

// 年度の上限は呼び出し時点の年で判定するため、スキーマは関数内で生成する
function yearSchema() {
  return z.number().int().min(1900).max(new Date().getFullYear());
}

function getFormSchema() {
  return z.object({
    facultyId: z.string().min(1),
    subjectId: z.string().min(1),
    targetSubjectId: z.string().uuid().optional(),
    newSubjectName: z.string().trim().max(100).optional(),
    year: yearSchema(),
    instructor: z.string().min(1).max(100),
    fileUrl: z.string().regex(FILE_URL_REGEX, 'ファイルのパスが不正です。'),
    fileName: z.string().max(255).optional(),
    comment: z.string().max(1000).optional(),
    courseIds: z.array(z.string()).optional(),
  });
}

function getEditFormSchema() {
  return z.object({
    examId: z.string().uuid(),
    year: yearSchema(),
    instructor: z.string().min(1).max(100),
    comment: z.string().max(1000).optional(),
    courseIds: z.array(z.string()).optional(),
  });
}

type SaveExamInput = z.input<ReturnType<typeof getFormSchema>>;
type UpdateExamInput = z.input<ReturnType<typeof getEditFormSchema>>;

// エラーメッセージ中の項目名を日本語に置き換えるための表示名
const FIELD_LABELS: Record<string, string> = {
  facultyId: '学部',
  subjectId: '科目',
  targetSubjectId: '科目',
  newSubjectName: '新しい科目名',
  year: '開講年度',
  instructor: '担当教員',
  fileUrl: 'ファイル',
  fileName: 'ファイル名',
  comment: '備考・メモ',
  courseIds: '対象コース',
  examId: '過去問',
};

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// 指定されたコースがすべて指定学部に属しているか検証する
async function assertCoursesBelongToFaculty(courseIds: string[], facultyId: string) {
  if (courseIds.length === 0) return;

  const count = await prisma.course.count({
    where: { id: { in: courseIds }, facultyId },
  });

  if (count !== courseIds.length) {
    throw new ActionError('選択されたコースが不正です。');
  }
}

// 科目にコースを紐付ける（既に紐付いている場合は何もしない）
async function connectCoursesToSubject(subjectId: string, courseIds: string[]) {
  if (courseIds.length === 0) return;

  await prisma.subject.update({
    where: { id: subjectId },
    data: {
      courses: {
        connect: courseIds.map(id => ({ id })),
      },
    },
  });
}

// Storage 上にファイルが実在するか確認する
async function assertFileExistsInStorage(folder: string, fileName: string) {
  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(STORAGE_BUCKET)
    .list(folder, { search: fileName });

  if (error) {
    console.error('Failed to list storage objects:', error);
    throw new ActionError('アップロードされたファイルが見つかりません。');
  }

  if (!data || !data.some(file => file.name === fileName)) {
    throw new ActionError('アップロードされたファイルが見つかりません。');
  }
}

export async function saveExamData(
  data: SaveExamInput,
): Promise<ActionResult<{ examId: string; subjectId: string }>> {
  return runAction(async () => {
    // 認証の確認（大学のメールアドレスでログインしているユーザーのみ許可）
    const { email } = await requireUniversityUser();

    // データのバリデーション
    const validated = parseInput(getFormSchema(), data, FIELD_LABELS);
    const courseIds = Array.from(new Set(validated.courseIds || []));
    const newSubjectName = validated.newSubjectName || undefined; // trim後の空文字は未入力扱い
    // 全角・半角スペースの違いによる表記ゆれを防ぐため、担当教員名は正規化して保存する
    const instructor = normalizeInstructor(validated.instructor);
    if (!instructor) {
      return fail('担当教員を入力してください。');
    }

    // 学部の存在確認
    const faculty = await prisma.faculty.findUnique({
      where: { id: validated.facultyId },
    });

    if (!faculty) {
      return fail('指定された学部が見つかりません。');
    }

    // コースが学部に属しているか確認
    await assertCoursesBelongToFaculty(courseIds, faculty.id);

    // ファイルパスの検証: フォルダ名は科目ID（新規科目の場合は事前に払い出したID）と一致する必要がある
    const match = FILE_URL_REGEX.exec(validated.fileUrl);
    if (!match) {
      return fail('ファイルのパスが不正です。');
    }
    const [, folder, storedFileName] = match;
    const expectedFolder = validated.subjectId === 'new' ? validated.targetSubjectId : validated.subjectId;

    if (!expectedFolder || folder !== expectedFolder) {
      return fail('ファイルのパスが不正です。');
    }

    // 同じファイルが既に別の過去問として登録されていないか確認
    const duplicated = await prisma.exam.findFirst({
      where: { fileUrl: validated.fileUrl },
      select: { id: true },
    });

    if (duplicated) {
      return fail('このファイルはすでに登録されています。');
    }

    // Storage にファイルが実在するか確認
    await assertFileExistsInStorage(folder, storedFileName);

    let finalSubjectId = validated.subjectId;

    if (validated.subjectId === 'new') {
      // 新規科目の作成処理が選択された場合
      if (!newSubjectName || !validated.targetSubjectId) {
        return fail('新規科目の情報が不足しています。');
      }

      const subjectKey = {
        name_facultyId: {
          name: newSubjectName,
          facultyId: faculty.id,
        },
      };

      // 同じ学部内に同名の科目が重複作成されるのを防ぐ処理
      let subject = await prisma.subject.findUnique({ where: subjectKey });

      if (!subject) {
        try {
          subject = await prisma.subject.create({
            data: {
              id: validated.targetSubjectId,
              name: newSubjectName,
              facultyId: faculty.id,
            }
          });
        } catch (err) {
          // 同時リクエストで同名科目が先に作成された場合は既存の科目を使用する
          if (!isUniqueViolation(err)) throw err;
          subject = await prisma.subject.findUnique({ where: subjectKey });
          if (!subject) throw err;
        }
      }
      finalSubjectId = subject.id; // 作成された（または既存の）科目のIDを適用
    } else {
      // 既存科目の場合: 科目が存在し、指定学部に属しているか確認
      const subject = await prisma.subject.findUnique({
        where: { id: validated.subjectId },
        select: { id: true, facultyId: true },
      });

      if (!subject || subject.facultyId !== faculty.id) {
        return fail('指定された科目が見つかりません。');
      }
    }

    // 科目と対象コースを紐付ける（既存科目・既存の同名科目の場合も反映する）
    await connectCoursesToSubject(finalSubjectId, courseIds);

    // DBに過去問データを保存
    const exam = await prisma.exam.create({
      data: {
        subjectId: finalSubjectId,
        year: validated.year,
        instructor,
        fileUrl: validated.fileUrl,
        fileName: validated.fileName,
        comment: validated.comment || null,
        courses: {
          connect: courseIds.map(id => ({ id }))
        },
        uploadedBy: email, // 認証済みユーザーのメールアドレスを記録
      }
    });

    return ok({ examId: exam.id, subjectId: finalSubjectId });
  });
}

export async function updateExamData(data: UpdateExamInput): Promise<ActionResult> {
  return runAction(async () => {
    // 認証の確認（大学のメールアドレスでログインしているユーザーのみ許可）
    const { email } = await requireUniversityUser();

    const validated = parseInput(getEditFormSchema(), data, FIELD_LABELS);
    const courseIds = Array.from(new Set(validated.courseIds || []));
    const instructor = normalizeInstructor(validated.instructor);
    if (!instructor) {
      return fail('担当教員を入力してください。');
    }

    // 過去問がユーザー自身のものであるか確認
    const existingExam = await prisma.exam.findUnique({
      where: { id: validated.examId },
      include: { subject: { select: { id: true, facultyId: true } } },
    });

    if (!existingExam) {
      return fail('過去問が見つかりません。');
    }

    if (existingExam.uploadedBy !== email) {
      return fail('他のユーザーがアップロードした過去問は編集できません。');
    }

    // コースが科目の学部に属しているか確認
    await assertCoursesBelongToFaculty(courseIds, existingExam.subject.facultyId);

    // アップデート
    await prisma.exam.update({
      where: { id: validated.examId },
      data: {
        year: validated.year,
        instructor,
        comment: validated.comment || null,
        courses: {
          set: courseIds.map(id => ({ id }))
        }
      }
    });

    // 科目にも対象コースを紐付ける
    await connectCoursesToSubject(existingExam.subject.id, courseIds);

    return ok();
  });
}

export async function deleteExamData(examId: string): Promise<ActionResult> {
  return runAction(async () => {
    // 認証の確認（大学のメールアドレスでログインしているユーザーのみ許可）
    const { email } = await requireUniversityUser();

    const validatedExamId = parseInput(z.string().min(1).max(100), examId);

    // 過去問がユーザー自身のものであるか確認
    const existingExam = await prisma.exam.findUnique({
      where: { id: validatedExamId }
    });

    if (!existingExam) {
      return fail('過去問が見つかりません。');
    }

    if (existingExam.uploadedBy !== email) {
      return fail('他のユーザーがアップロードした過去問は削除できません。');
    }

    // 1. DBから削除（先にDBを消すことで、ファイルだけ消えてリンク切れになる状態を防ぐ）
    await prisma.exam.delete({
      where: { id: existingExam.id }
    });

    // 2. Supabase Storageからファイルを削除（失敗してもDB削除は完了しているため、ログのみ出力）
    await removeExamFileIfUnreferenced(existingExam.fileUrl);

    return ok();
  });
}
