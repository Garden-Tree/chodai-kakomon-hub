export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-live="polite">
      <span className="sr-only">読み込み中...</span>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-3">
        <div className="h-4 w-24 bg-slate-200 rounded" />
        <div className="h-8 w-64 max-w-full bg-slate-200 rounded" />
      </div>

      <div className="space-y-4">
        <div className="h-6 w-40 bg-slate-200 rounded" />
        <div className="grid gap-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 flex flex-col sm:flex-row justify-between gap-4"
            >
              <div className="flex-1 space-y-3">
                <div className="h-5 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-3/4 bg-slate-100 rounded" />
                <div className="h-10 w-full bg-slate-100 rounded" />
              </div>
              <div className="flex gap-2 sm:w-auto w-full">
                <div className="h-10 w-28 bg-slate-200 rounded-md" />
                <div className="h-10 w-32 bg-slate-200 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
