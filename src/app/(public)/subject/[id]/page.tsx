import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail, isUniversityEmail } from '@/lib/auth';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExamList } from '@/components/ExamList';
import Link from 'next/link';
import { ChevronLeft, Upload } from 'lucide-react';

type Props = {
  params: Promise<{ id: string }>
}

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id },
    select: { name: true, faculty: { select: { name: true } } },
  });

  if (!subject) {
    return { title: '科目が見つかりません | 長大過去問ハブ' };
  }

  return {
    title: `${subject.name} の過去問 | 長大過去問ハブ`,
    description: `長崎大学 ${subject.faculty.name} の科目「${subject.name}」の過去問を閲覧・ダウンロードできます。`,
  };
}

export default async function SubjectPage({ params }: Props) {
  const { id } = await params;

  // 認証の確認（任意、ログインしていない場合は null）
  let currentUserEmail: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    currentUserEmail = user?.email || null;
  } catch (e) {
    console.error('Failed to retrieve user session:', e);
  }

  // 非公開の過去問は、アップロード者本人と管理者にのみ表示する
  const isAdmin = currentUserEmail !== null
    && isUniversityEmail(currentUserEmail)
    && isAdminEmail(currentUserEmail);
  const visibilityFilter = isAdmin
    ? {}
    : currentUserEmail
      ? { OR: [{ isHidden: false }, { uploadedBy: currentUserEmail }] }
      : { isHidden: false };

  // 科目とその過去問を年度の降順で取得
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      faculty: {
        include: {
          courses: true
        }
      },
      exams: {
        where: visibilityFilter,
        include: {
          courses: true
        },
        orderBy: { year: 'desc' }
      }
    }
  });

  if (!subject) {
    notFound();
  }

  // Dateオブジェクトをシリアライズしてクライアントコンポーネントに渡す
  const serializedExams = subject.exams.map(exam => ({
    id: exam.id,
    year: exam.year,
    instructor: exam.instructor,
    fileName: exam.fileName,
    comment: exam.comment,
    isHidden: exam.isHidden,
    createdAt: dateFormatter.format(exam.createdAt),
    courses: exam.courses.map(course => ({
      id: course.id,
      name: course.name,
      facultyId: course.facultyId
    }))
  }));

  const serializedSubject = {
    id: subject.id,
    name: subject.name,
    faculty: {
      id: subject.faculty.id,
      name: subject.faculty.name,
      courses: subject.faculty.courses.map(course => ({
        id: course.id,
        name: course.name,
        facultyId: course.facultyId
      }))
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="rounded-2xl border border-border bg-card p-4 md:p-6">
        <Link
          href={`/?faculty=${encodeURIComponent(subject.faculty.id)}#faculty`}
          className="-ml-1 inline-flex min-h-8 items-center gap-0.5 rounded-md px-1 text-sm font-bold text-primary hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
          {subject.faculty.name}
        </Link>
        <h1 className="mt-1 break-words text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
          {subject.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-8 items-center rounded-full border-2 border-ink bg-highlight px-3 text-sm font-bold text-highlight-foreground">
            過去問 {subject.exams.length}件
          </span>
          <Link
            href={`/upload?subject=${encodeURIComponent(subject.id)}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-ink bg-card px-3 sm:px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Upload className="size-4 shrink-0" aria-hidden="true" />
            <span aria-hidden="true" className="sm:hidden">アップロード</span>
            <span className="sr-only sm:not-sr-only">この科目の過去問をアップロード</span>
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {/* ExamList は useSearchParams（フィルタ・完了バナー）を使うため Suspense で囲む */}
        <Suspense fallback={null}>
          <ExamList
            subject={serializedSubject}
            exams={serializedExams}
            currentUserEmail={currentUserEmail}
          />
        </Suspense>
      </div>
    </div>
  );
}
