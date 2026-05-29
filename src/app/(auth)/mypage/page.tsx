import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { MyPageClient } from './MyPageClient';

export default async function MyPage() {
  // 認証の確認
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect('/login');
  }

  // ログインユーザー自身がアップロードした過去問を取得
  const exams = await prisma.exam.findMany({
    where: {
      uploadedBy: user.email,
    },
    include: {
      subject: {
        include: {
          faculty: true,
        },
      },
      courses: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // 全てのコース情報を取得（編集時の選択肢用）
  const allCourses = await prisma.course.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <MyPageClient exams={exams} allCourses={allCourses} email={user.email} />
    </div>
  );
}
