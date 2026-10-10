import Link from 'next/link';
import { ChevronDown, Upload } from 'lucide-react';

export type FacultyTile = {
  id: string;
  name: string;
  subjectCount: number;
};

type Props = {
  faculties: FacultyTile[];
  selectedFacultyId: string | null;
};

// 学部から探す（科目のある学部はタイル、科目のない学部は1つの点線タイルにまとめる）
export function FacultyTiles({ faculties, selectedFacultyId }: Props) {
  const withSubjects = faculties.filter(f => f.subjectCount > 0);
  const empty = faculties.filter(f => f.subjectCount === 0);

  return (
    <section aria-labelledby="faculty-tiles-heading" className="space-y-3">
      <h2 id="faculty-tiles-heading" className="text-xl font-extrabold tracking-tight">
        学部から探す
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {withSubjects.map(faculty => {
          const selected = faculty.id === selectedFacultyId;
          return (
            <Link
              key={faculty.id}
              href={`/?faculty=${encodeURIComponent(faculty.id)}#faculty`}
              aria-current={selected ? 'true' : undefined}
              className={`card-pop pop-interactive flex min-h-28 flex-col justify-between gap-2 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                selected ? 'bg-highlight! text-highlight-foreground' : 'text-foreground'
              }`}
            >
              <span className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold leading-none tabular-nums">
                  {faculty.subjectCount}
                </span>
                <span className="text-sm font-bold">科目</span>
              </span>
              <span className="break-words text-base font-bold leading-snug">
                {faculty.name}
              </span>
            </Link>
          );
        })}

        {empty.length > 0 && (
          <details className="group col-span-2 rounded-xl border-2 border-dashed border-ink/40 bg-secondary text-secondary-foreground">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                まだ過去問がない学部
                <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-card px-2 text-sm font-bold text-foreground">
                  {empty.length}
                </span>
              </span>
              <ChevronDown
                className="size-5 shrink-0 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-3 px-4 pb-4">
              <ul className="flex flex-wrap gap-2">
                {empty.map(faculty => (
                  <li
                    key={faculty.id}
                    className="rounded-full bg-card px-3 py-1 text-sm text-foreground"
                  >
                    {faculty.name}
                  </li>
                ))}
              </ul>
              <Link
                href="/upload"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-ink bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Upload className="size-4" aria-hidden="true" />
                最初の過去問をアップロード
              </Link>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
