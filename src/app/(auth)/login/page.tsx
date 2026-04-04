'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '不明なエラーが発生しました');
      }

      setStatus('success');
    } catch (err: any) {
      setErrorMessage(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold">アップロード用ログイン</CardTitle>
          <CardDescription>
            過去問をアップロードするには、大学のメールアドレス (*.ac.jp) でログインしてください。パスワードは不要です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'success' ? (
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-md border border-emerald-100">
              <p className="font-medium">メールを送信しました！</p>
              <p className="text-sm mt-2 leading-relaxed">
                受信トレイをご確認いただき、記載されたリンクをクリックしてログインを完了してください。<br/>
                ※メールが届かない場合は迷惑メールフォルダもご確認ください。
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="example@your-univ.ac.jp"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                  className="w-full"
                  required
                />
              </div>

              {status === 'error' && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-100">
                  {errorMessage}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={status === 'loading'}>
                {status === 'loading' ? '送信中...' : 'マジックリンクを送信'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
