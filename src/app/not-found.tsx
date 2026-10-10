import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-4">
        <p className="text-6xl font-bold text-slate-300">404</p>
        <h2 className="text-xl font-bold text-slate-900">ページが見つかりません</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          お探しのページは存在しないか、移動または削除された可能性があります。
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
