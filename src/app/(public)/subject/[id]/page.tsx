import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ExamList } from '@/components/ExamList';

type Props = {
  params: Promise<{ id: string }>
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
    fileUrl: exam.fileUrl,
    fileName: exam.fileName,
    comment: exam.comment,
    uploadedBy: exam.uploadedBy,
    createdAt: exam.createdAt.toISOString(),
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
        <ExamList 
          subject={serializedSubject}
          exams={serializedExams}
          currentUserEmail={currentUserEmail}
        />
      </div>
    </div>
  );
}
