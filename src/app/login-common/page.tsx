import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-xl font-bold">過去問共有サイト</CardTitle>
          <CardDescription>学内共通の簡易パスワードを入力してください。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitPassword} className="space-y-4">
            {hasError && (
              <div className="text-red-600 bg-red-50 p-3 rounded-md border border-red-100 text-sm">
                パスワードが正しくありません。もう一度入力してください。
              </div>
            )}
            <div className="space-y-2">
              <Input
                type="password"
                name="password"
                placeholder="パスワード"
                required
              />
            </div>
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
