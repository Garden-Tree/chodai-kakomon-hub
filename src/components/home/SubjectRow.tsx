import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type Props = {
  id: string;
  name: string;
  examCount: number;
};

// 科目一覧の1行（学部の科目一覧・検索結果で共通）
export function SubjectRow({ id, name, examCount }: Props) {
  return (
    <Link
      href={`/subject/${id}`}
      className="group flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="min-w-0 flex-1 break-words text-base font-bold text-foreground">
        {name}
      </span>
      <span className="shrink-0 text-sm text-muted-foreground">
        過去問 {examCount}件
      </span>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}
