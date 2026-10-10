import Link from 'next/link';

export type NewArrival = {
  id: string;
  subjectId: string;
  subjectName: string;
  facultyName: string;
  year: number;
  instructor: string;
  uploadedAtIso: string; // <time dateTime> 用
  uploadedAtLabel: string; // サーバー側で計算した相対表記（例: 3日前）
};

type Props = {
  items: NewArrival[];
};

// 新着の過去問（スマホでは横スクロール、md 以上では3列グリッド）
export function NewArrivals({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="new-arrivals-heading" className="space-y-3">
      <h2 id="new-arrivals-heading" className="text-xl font-extrabold tracking-tight">
        新着の過去問
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 no-scrollbar gap-4 overflow-x-auto px-4 pb-3 pt-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-1">
        {items.map(item => (
          <li key={item.id} className="w-64 shrink-0 snap-start md:w-auto">
            <Link
              href={`/subject/${item.subjectId}`}
              className="card-pop pop-interactive flex h-full flex-col gap-1 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="line-clamp-2 break-words text-base font-bold text-foreground">
                {item.subjectName}
              </span>
              <span className="text-sm text-muted-foreground">{item.facultyName}</span>
              <span className="mt-1 truncate text-sm text-foreground">
                {item.year}年度 · {item.instructor}
              </span>
              <time
                dateTime={item.uploadedAtIso}
                className="mt-auto pt-1 text-sm text-muted-foreground"
              >
                {item.uploadedAtLabel}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
