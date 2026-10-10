import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-background">
      <div className="card-pop max-w-md w-full p-8 text-center space-y-4">
        <p className="text-7xl font-black text-primary leading-none">404</p>
        <h2 className="text-2xl font-extrabold">ページが見つかりません</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          お探しのページは存在しないか、移動または削除された可能性があります。
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 min-h-11 bg-primary text-primary-foreground edge-pop border-2 border-ink rounded-xl text-sm font-bold"
        >
          トップページへ戻る
        </Link>
      </div>
    </div>
  );
}
