'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import type { EmailOtpType } from '@supabase/supabase-js';

// verifyOtp に渡せる type のみ許可する
const ALLOWED_OTP_TYPES: readonly EmailOtpType[] = [
  'email',
  'magiclink',
  'recovery',
  'signup',
  'invite',
  'email_change',
];

function parseOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null;
  return (ALLOWED_OTP_TYPES as readonly string[]).includes(value) ? (value as EmailOtpType) : null;
}

// オープンリダイレクト対策: サイト内の相対パスのみ許可し、それ以外はトップページへ
function sanitizeNext(value: string | null): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/';
  }
  return value;
}

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const token_hash = searchParams.get('token_hash');
  const type = parseOtpType(searchParams.get('type'));
  const next = sanitizeNext(searchParams.get('next'));

  // token_hash / type が不正なリンクはその場でエラー表示する
  const isInvalidLink = !token_hash || !type;

  const handleConfirm = async () => {
    if (!token_hash || !type) return;

    setStatus('loading');
    const supabase = createClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (error) {
      console.error('verifyOtp error:', error);
      setErrorMessage('認証に失敗しました。リンクがすでに使用されたか、期限切れです。');
      setStatus('error');
    } else {
      if (next.includes('/auth/callback')) {
        router.push('/');
      } else {
        router.push(next);
      }
    }
  };

  if (isInvalidLink || status === 'error') {
    return (
      <div className="text-center space-y-4">
        <div role="alert" className="text-red-800 bg-red-50 p-3 rounded-xl border-2 border-red-700 text-sm">
          {isInvalidLink ? '無効なリンクです。ログインページからやり直してください。' : errorMessage}
        </div>
        <Button
          onClick={() => router.push('/login')}
          variant="outline"
          className="w-full bg-card border-2 border-ink rounded-xl min-h-11 font-bold cursor-pointer hover:bg-muted"
        >
          ログイン画面へ戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        セキュリティシステム（大学のメールスキャナー等）によるリンクの自動消費を防ぐため、<br/>
        以下のボタンをクリックしてログインを完了してください。
      </p>
      <Button
        onClick={handleConfirm}
        className="w-full bg-primary text-primary-foreground edge-pop border-2 border-ink rounded-xl min-h-12 font-bold cursor-pointer"
        size="lg"
        disabled={status === 'loading' || !token_hash || !type}
      >
        {status === 'loading' ? '認証中...' : 'ログイン認証を完了する'}
      </Button>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="card-pop w-full max-w-md p-6 md:p-8 space-y-5">
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-highlight-foreground">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            <span className="font-extrabold tracking-tight">過去問ハブ</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">認証の確認</h1>
          <p className="text-sm text-muted-foreground">
            ご本人確認を完了します
          </p>
        </div>
        <div>
          <Suspense fallback={<div className="text-center py-4 text-sm text-muted-foreground">読み込み中...</div>}>
            <ConfirmContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
