import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail, isUniversityEmail } from '@/lib/auth';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExamList } from '@/components/ExamList';

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
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="text-sm text-slate-500 mb-2">{subject.faculty.name}</div>
        <h1 className="text-3xl font-bold text-slate-900">{subject.name}</h1>
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
