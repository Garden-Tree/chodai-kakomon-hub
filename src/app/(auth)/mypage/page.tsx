import { getUniversityUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { MyPageClient } from './MyPageClient';

export default async function MyPage() {
  // 認証の確認（大学のメールアドレスでログインしているユーザーのみ許可）
  const authUser = await getUniversityUser();

  if (!authUser) {
    redirect('/login');
  }
  const { email } = authUser;

  // ログインユーザー自身がアップロードした過去問を取得
  const exams = await prisma.exam.findMany({
    where: {
      uploadedBy: email,
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
    <MyPageClient exams={exams} allCourses={allCourses} email={email} />
  );
}
