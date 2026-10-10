import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div
      className="flex-1 flex items-center justify-center p-12 text-slate-400"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">読み込み中...</span>
    </div>
  );
}
