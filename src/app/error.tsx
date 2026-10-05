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
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg shadow-sm p-8 text-center space-y-4">
        <div className="mx-auto p-3 bg-red-50 text-red-600 rounded-full w-fit">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">問題が発生しました</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          予期せぬエラーが発生しました。時間をおいて再度お試しください。
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            もう一度試す
          </button>
          <Link
            href="/"
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700 transition-colors"
          >
            トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
