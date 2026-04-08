'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as any;
  const next = searchParams.get('next') ?? '/upload';

  useEffect(() => {
    if (!token_hash || !type) {
      setErrorMessage('無効なリンクです。ログインページからやり直してください。');
      setStatus('error');
    }
  }, [token_hash, type]);

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
        router.push('/upload');
      } else {
        router.push(next);
      }
    }
  };

  if (status === 'error') {
    return (
      <div className="text-center space-y-4">
        <div className="text-red-600 bg-red-50 p-3 rounded-md border border-red-100 text-sm">
          {errorMessage}
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
