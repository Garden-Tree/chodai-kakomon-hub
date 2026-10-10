import { getUniversityUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { UploadForm } from './UploadForm';

export default async function UploadPage() {
  // 認証チェック（大学のメールアドレスでログインしているユーザーのみ許可）
  const authUser = await getUniversityUser();

  if (!authUser) {
    redirect('/login');
  }
  const { email } = authUser;

  // 科目一覧を取得してフォームに渡す
  const subjects = await prisma.subject.findMany({
    include: { faculty: true },
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

  return (
    <div className="w-full max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">過去問のアップロード</h1>
        <p className="text-slate-500 mt-2">
          ログイン中: <span className="font-medium text-slate-700">{email}</span>
        </p>
      </div>
      <UploadForm subjects={subjects} faculties={faculties} courses={courses} />
    </div>
  );
}
