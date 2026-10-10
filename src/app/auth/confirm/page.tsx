'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
        <div className="text-red-600 bg-red-50 p-3 rounded-md border border-red-100 text-sm">
          {isInvalidLink ? '無効なリンクです。ログインページからやり直してください。' : errorMessage}
        </div>
        <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
          ログイン画面へ戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">
        セキュリティシステム（大学のメールスキャナー等）によるリンクの自動消費を防ぐため、<br/>
        以下のボタンをクリックしてログインを完了してください。
      </p>
      <Button 
        onClick={handleConfirm} 
        className="w-full font-bold" 
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-center">認証の確認</CardTitle>
          <CardDescription className="text-center">
            ご本人確認を完了します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-center py-4 text-sm text-slate-500">読み込み中...</div>}>
            <ConfirmContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
