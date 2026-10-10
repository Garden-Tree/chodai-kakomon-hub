'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-background">
      <div className="card-pop max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center bg-red-50 text-red-700 border-2 border-red-700 rounded-full">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold">問題が発生しました</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          予期せぬエラーが発生しました。時間をおいて再度お試しください。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 min-h-11 bg-primary text-primary-foreground edge-pop border-2 border-ink rounded-xl text-sm font-bold"
          >
            トップページへ戻る
          </Link>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center justify-center px-5 min-h-11 bg-card border-2 border-ink rounded-xl text-sm font-bold hover:bg-muted transition-colors cursor-pointer"
          >
            もう一度試す
          </button>
        </div>
      </div>
    </div>
  );
}
