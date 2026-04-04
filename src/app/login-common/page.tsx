import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function LoginCommonPage() {
  async function submitPassword(formData: FormData) {
    'use server';
    const password = formData.get('password') as string;
    const expectedPassword = process.env.SITE_COMMON_PASSWORD || 'your_common_password_here';

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
            <div className="space-y-2">
              <Input
                type="password"
                name="password"
                placeholder="パスワード"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              閲覧する
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
