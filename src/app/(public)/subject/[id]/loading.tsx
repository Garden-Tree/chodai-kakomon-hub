export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">読み込み中...</span>

      {/* 科目ヘッダー */}
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-3">
        <div className="h-4 w-28 rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-64 max-w-full rounded-lg bg-muted animate-pulse" />
        <div className="flex flex-wrap gap-3 pt-1">
          <div className="h-8 w-28 rounded-full bg-muted animate-pulse" />
          <div className="h-11 w-60 max-w-full rounded-xl bg-muted animate-pulse" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div className="h-6 w-28 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-16 rounded-md bg-muted animate-pulse" />
        </div>

        {/* フィルタバー */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 overflow-hidden">
          <div className="h-4 w-10 rounded-md bg-muted animate-pulse" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-10 w-20 shrink-0 rounded-full bg-muted animate-pulse" />
            ))}
          </div>
          <div className="h-11 w-full sm:max-w-sm rounded-xl bg-muted animate-pulse" />
        </div>

        {/* 過去問カード */}
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl border-2 border-border bg-card p-4 md:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-28 rounded-md bg-muted animate-pulse" />
                <div className="h-4 w-8 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
              <div className="h-4 w-3/4 rounded-md bg-muted animate-pulse" />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="h-11 rounded-xl bg-muted animate-pulse" />
                <div className="h-11 rounded-xl bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
