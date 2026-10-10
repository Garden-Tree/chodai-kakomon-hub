import Link from 'next/link';
import { Upload } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SubjectList } from '@/components/SubjectList';
import { SearchHero } from '@/components/home/SearchHero';
import { NewArrivals, type NewArrival } from '@/components/home/NewArrivals';
import { FacultyTiles } from '@/components/home/FacultyTiles';
import { SubjectRow } from '@/components/home/SubjectRow';
import { formatRelativeDate } from '@/components/home/relative-date';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// 新着の過去問の表示件数
const NEW_ARRIVALS_COUNT = 6;

// 科目ごとの公開中の過去問の件数
const publicExamCount = {
  _count: { select: { exams: { where: { isHidden: false } } } },
} as const;

export default async function TopPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q.trim() : '';
  const facultyParam = typeof sp.faculty === 'string' ? sp.faculty : '';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SearchHero query={query} />
      {query !== '' ? (
        <SearchResults query={query} />
      ) : (
        <BrowseSections facultyParam={facultyParam} />
      )}
    </div>
  );
}

// 検索キーワードがないとき: 新着の過去問 + 学部タイル + 選択中の学部の科目一覧
async function BrowseSections({ facultyParam }: { facultyParam: string }) {
  const [latestExams, faculties, selectedFaculty] = await Promise.all([
    prisma.exam.findMany({
      where: { isHidden: false },
      orderBy: { createdAt: 'desc' },
      take: NEW_ARRIVALS_COUNT,
      include: {
        subject: {
          select: { name: true, faculty: { select: { name: true } } },
        },
      },
    }),
    prisma.faculty.findMany({
      select: { id: true, name: true, _count: { select: { subjects: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    facultyParam
      ? prisma.faculty.findUnique({
          where: { id: facultyParam },
          include: {
            courses: { orderBy: { name: 'asc' } },
            subjects: {
              include: { courses: true, ...publicExamCount },
              orderBy: { name: 'asc' },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const newArrivals: NewArrival[] = latestExams.map(exam => ({
    id: exam.id,
    subjectId: exam.subjectId,
    subjectName: exam.subject.name,
    facultyName: exam.subject.faculty.name,
    year: exam.year,
    instructor: exam.instructor,
    uploadedAtIso: exam.createdAt.toISOString(),
    uploadedAtLabel: formatRelativeDate(exam.createdAt),
  }));

  return (
    <>
      <NewArrivals items={newArrivals} />

      <FacultyTiles
        faculties={faculties.map(f => ({
          id: f.id,
          name: f.name,
          subjectCount: f._count.subjects,
        }))}
        selectedFacultyId={selectedFaculty?.id ?? null}
      />

      {selectedFaculty && (
        <section id="faculty" aria-labelledby="faculty-heading" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="faculty-heading" className="text-xl font-extrabold tracking-tight md:text-2xl">
              {selectedFaculty.name}
            </h2>
            <span className="text-sm text-muted-foreground">
              {selectedFaculty.subjects.length}科目
            </span>
          </div>
          <SubjectList
            key={selectedFaculty.id}
            courses={selectedFaculty.courses.map(c => ({ id: c.id, name: c.name }))}
            subjects={selectedFaculty.subjects.map(s => ({
              id: s.id,
              name: s.name,
              examCount: s._count.exams,
              courses: s.courses.map(c => ({ id: c.id, name: c.name })),
            }))}
          />
        </section>
      )}
    </>
  );
}

// 検索キーワードがあるとき: 一致した科目を学部ごとに表示する
async function SearchResults({ query }: { query: string }) {
  const nameFilter = { name: { contains: query, mode: 'insensitive' as const } };

  // 一致する科目がある学部のみ取得する
  const faculties = await prisma.faculty.findMany({
    where: { subjects: { some: nameFilter } },
    include: {
      subjects: {
        where: nameFilter,
        include: publicExamCount,
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const total = faculties.reduce((sum, f) => sum + f.subjects.length, 0);

  return (
    <section aria-labelledby="search-results-heading" className="space-y-6">
      <h2
        id="search-results-heading"
        className="break-words text-xl font-extrabold tracking-tight"
      >
        「{query}」の検索結果 <span className="whitespace-nowrap">{total}件</span>
      </h2>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-ink/40 bg-secondary px-4 py-8 text-center">
          <p className="text-base text-secondary-foreground">
            「{query}」に一致する科目はありません
          </p>
          <p className="text-sm text-muted-foreground">
            手元に過去問があれば、アップロードして共有しませんか？
          </p>
          <Link
            href="/upload"
            className="edge-pop inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Upload className="size-4" aria-hidden="true" />
            過去問をアップロードする
          </Link>
          <Link
            href="/"
            className="text-sm font-bold text-primary underline underline-offset-4"
          >
            検索をやめて学部から探す
          </Link>
        </div>
      ) : (
        faculties.map(faculty => (
          <div key={faculty.id} className="space-y-3">
            <h3 className="flex items-baseline gap-2 text-base font-bold">
              {faculty.name}
              <span className="text-sm font-normal text-muted-foreground">
                {faculty.subjects.length}科目
              </span>
            </h3>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {faculty.subjects.map(subject => (
                <li key={subject.id}>
                  <SubjectRow
                    id={subject.id}
                    name={subject.name}
                    examCount={subject._count.exams}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
