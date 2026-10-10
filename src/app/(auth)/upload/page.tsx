import { getUniversityUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { UploadForm } from './UploadForm';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function UploadPage({ searchParams }: Props) {
  // 認証チェック（大学のメールアドレスでログインしているユーザーのみ許可）
  const authUser = await getUniversityUser();

  if (!authUser) {
    redirect('/login');
  }
  const { email } = authUser;

  // 科目一覧を取得してフォームに渡す
  const subjects = await prisma.subject.findMany({
    include: { faculty: true, courses: { select: { id: true } } },
    orderBy: [{ faculty: { name: 'asc' } }, { name: 'asc' }]
  });

  // 学部一覧も取得して新規科目作成用にフォームに渡す
  const faculties = await prisma.faculty.findMany({
    orderBy: { name: 'asc' }
  });

  // コース一覧も取得
  const courses = await prisma.course.findMany({
    orderBy: { name: 'asc' }
  });

  // /upload?subject=<subjectId> で科目を事前選択する（存在しない ID は無視する）
  const sp = await searchParams;
  const subjectParam = typeof sp.subject === 'string' ? sp.subject : '';
  const initialSubjectId = subjects.some(s => s.id === subjectParam) ? subjectParam : undefined;

  // フォームには必要な項目だけを渡す（科目の現在のコースはコースの初期選択に使う）
  const subjectOptions = subjects.map(s => ({
    id: s.id,
    name: s.name,
    facultyId: s.facultyId,
    courseIds: s.courses.map(c => c.id),
  }));

  return (
    <div className="w-full max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">過去問のアップロード</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          ログイン中: <span className="font-bold text-foreground break-all">{email}</span>
        </p>
      </div>
      <UploadForm
        key={initialSubjectId ?? 'none'}
        subjects={subjectOptions}
        faculties={faculties}
        courses={courses}
        initialSubjectId={initialSubjectId}
      />
    </div>
  );
}
