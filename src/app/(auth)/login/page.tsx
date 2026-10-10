'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      // Step 1: サーバー側でメールアドレスを検証（*.ac.jp チェック）
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '不明なエラーが発生しました');
      }

      // Step 2: ブラウザの Supabase クライアントで signInWithOtp を呼ぶ
      // ※ PKCE の code verifier をブラウザ側で生成・保存するために必須
      const supabase = createClient();
      // シンプルなURLにして Supabase の Redirect URLs マッチングを確実にする
      const emailRedirectTo = `${window.location.origin}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
        },
      });

      if (otpError) {
        console.error('signInWithOtp error:', otpError);
        throw new Error('メール送信に失敗しました。時間をおいて再試行してください。');
      }

      setStatus('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-8 bg-background">
      <div className="card-pop w-full max-w-md p-6 md:p-8 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-highlight-foreground">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            <span className="font-extrabold tracking-tight">過去問ハブ</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">アップロード用ログイン</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            過去問をアップロードするには、大学のメールアドレス (*.ac.jp) でログインしてください。パスワードは不要です。
          </p>
        </div>
        <div>
          {status === 'success' ? (
            <div className="bg-highlight text-highlight-foreground p-4 rounded-xl border-2 border-ink">
              <p className="font-bold">メールを送信しました！</p>
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
                  className="w-full bg-card border-2 border-ink/80 rounded-xl min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>

              {status === 'error' && (
                <div role="alert" className="text-red-800 text-sm bg-red-50 p-3 rounded-xl border-2 border-red-700">
                  {errorMessage}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground edge-pop border-2 border-ink rounded-xl min-h-11 font-bold cursor-pointer"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? '送信中...' : 'マジックリンクを送信'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
