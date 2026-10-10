import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SubmitButton } from './submit-button';
import { getSitePassword } from '@/lib/site-password';

export default async function LoginCommonPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { error } = await searchParams;
  const hasError = error !== undefined;

  async function submitPassword(formData: FormData) {
    'use server';
    const password = formData.get('password') as string;
    const expectedPassword = getSitePassword();

    if (password === expectedPassword) {
      const cookieStore = await cookies();
      cookieStore.set('site_common_password', password, {
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      redirect('/');
    }

    // パスワードが誤っている場合はエラー表示付きでログイン画面に戻す
    redirect('/login-common?error=1');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="card-pop w-full max-w-md p-6 md:p-8 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-highlight-foreground">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            <span className="font-extrabold tracking-tight">過去問ハブ</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">過去問共有サイト</h1>
          <p className="text-sm text-muted-foreground">学内共通の簡易パスワードを入力してください。</p>
        </div>
        <form action={submitPassword} className="space-y-4">
          {hasError && (
            <div className="text-red-800 bg-red-50 p-3 rounded-xl border-2 border-red-700 text-sm">
              パスワードが正しくありません。もう一度入力してください。
            </div>
          )}
          <div className="space-y-2">
            <Input
              type="password"
              name="password"
              placeholder="パスワード"
              required
              className="bg-card border-2 border-ink/80 rounded-xl min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
