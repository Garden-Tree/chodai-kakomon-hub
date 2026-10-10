import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeSubjectName } from '@/lib/subject-name';
import { Input } from '@/components/ui/input';
import { AdminNav } from '../AdminNav';
import { SubjectActions, type CourseOption, type SubjectOption } from './SubjectActions';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AdminSubjectsPage({ searchParams }: Props) {
  // 管理者以外はトップページへ
  const admin = await getAdminUser();
  if (!admin) {
    redirect('/');
  }

  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q.trim() : '';
  const normalizedQuery = normalizeSubjectName(query);

  // トップページと同じ並び順（作成日の古い順）で学部を取得する
  const faculties = await prisma.faculty.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      courses: { orderBy: { name: 'asc' } },
      subjects: {
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { exams: true } },
          courses: { orderBy: { name: 'asc' } },
        },
      },
    },
  });

  const facultyData = faculties.map(faculty => {
    const courses: CourseOption[] = faculty.courses.map(c => ({ id: c.id, name: c.name }));
    const subjects = faculty.subjects.map(s => ({
      id: s.id,
      name: s.name,
      examCount: s._count.exams,
      courseIds: s.courses.map(c => c.id),
      courseNames: s.courses.map(c => c.name),
    }));
    const options: SubjectOption[] = subjects.map(s => ({ id: s.id, name: s.name, examCount: s.examCount }));

    // 正規化した科目名が同じものをグループ化し、2件以上あるものを重複候補とする
    const byKey = new Map<string, typeof subjects>();
    for (const subject of subjects) {
      const key = normalizeSubjectName(subject.name);
      const group = byKey.get(key);
      if (group) group.push(subject);
      else byKey.set(key, [subject]);
    }
    const duplicateGroups = Array.from(byKey.values()).filter(group => group.length >= 2);

    const visibleSubjects = normalizedQuery
      ? subjects.filter(s => normalizeSubjectName(s.name).includes(normalizedQuery))
      : subjects;

    return { id: faculty.id, name: faculty.name, courses, options, duplicateGroups, visibleSubjects };
  });

  const duplicateSections = facultyData.filter(f => f.duplicateGroups.length > 0);
  const totalGroups = duplicateSections.reduce((sum, f) => sum + f.duplicateGroups.length, 0);
  // 統合・削除の結果表示（SubjectActions から ?done=merged&moved=N / ?done=deleted で渡される）
  const done = typeof sp.done === 'string' ? sp.done : '';
  const movedCount = Number(typeof sp.moved === 'string' ? sp.moved : '');
  const notice =
    done === 'merged'
      ? `科目を統合しました${Number.isInteger(movedCount) && movedCount >= 0 ? `（過去問 ${movedCount} 件を移動）` : ''}。`
      : done === 'deleted'
        ? '科目を削除しました。'
        : '';

  const visibleFaculties = query !== '' ? facultyData.filter(f => f.visibleSubjects.length > 0) : facultyData;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <AdminNav />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">科目の管理</h1>
          <p className="text-sm text-muted-foreground mt-1 break-all">ログイン中: {admin.email}</p>
        </div>
        <form className="flex gap-2 w-full md:w-auto">
          <Input
            type="search"
            name="q"
            placeholder="科目を検索..."
            defaultValue={query}
            className="w-full md:w-[300px] bg-card border-2 border-ink rounded-xl min-h-11 edge-pop focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border-2 border-ink bg-highlight px-4 py-3 text-sm font-bold text-highlight-foreground">
          {notice}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          重複候補
          <span className="text-xs font-bold text-muted-foreground bg-muted border border-border px-2.5 py-0.5 rounded-full">{totalGroups} グループ</span>
        </h2>
        {totalGroups === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center bg-card rounded-xl border-2 border-dashed border-ink/30">
            重複している可能性のある科目はありません。
          </p>
        ) : (
          duplicateSections.map(faculty => (
            <div key={faculty.id} className="card-pop p-4 md:p-5 space-y-4">
              <span className="inline-block text-xs font-bold text-muted-foreground bg-muted border border-border px-2.5 py-0.5 rounded-full">{faculty.name}</span>
              {faculty.duplicateGroups.map(group => {
                // 過去問が最も多い科目を統合先の初期候補にする
                const primary = group.reduce((best, s) => (s.examCount > best.examCount ? s : best), group[0]);
                return (
                  <ul key={group.map(s => s.id).join('-')} className="space-y-2">
                    {group.map(subject => (
                      <li
                        key={subject.id}
                        className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 bg-card rounded-xl border border-amber-400 px-3 py-2"
                      >
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="font-bold break-words">{subject.name}</span>
                          <Link href={`/subject/${subject.id}`} className="text-xs font-bold text-primary hover:underline py-2">
                            過去問 {subject.examCount} 件
                          </Link>
                        </div>
                        <SubjectActions
                          subject={subject}
                          facultySubjects={faculty.options}
                          facultyCourses={faculty.courses}
                          suggestedTargetId={subject.id === primary.id ? undefined : primary.id}
                        />
                      </li>
                    ))}
                  </ul>
                );
              })}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">すべての科目</h2>
        {query !== '' && visibleFaculties.length === 0 && (
          <p className="text-muted-foreground text-sm py-8 text-center bg-card rounded-xl border-2 border-dashed border-ink/30">
            「{query}」に一致する科目はありません
          </p>
        )}
        {visibleFaculties.map(faculty => (
          <div key={faculty.id} className="card-pop p-4 md:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold">{faculty.name}</h3>
              <span className="text-xs font-bold text-muted-foreground bg-muted border border-border px-2.5 py-0.5 rounded-full">
                {faculty.visibleSubjects.length} 科目
              </span>
            </div>
            {faculty.visibleSubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">科目がありません。</p>
            ) : (
              <ul className="divide-y divide-border">
                {faculty.visibleSubjects.map(subject => (
                  <li key={subject.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold break-words">{subject.name}</span>
                        <Link href={`/subject/${subject.id}`} className="text-xs font-bold text-primary hover:underline py-2">
                          過去問 {subject.examCount} 件
                        </Link>
                      </div>
                      {subject.courseNames.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {subject.courseNames.map(courseName => (
                            <span key={courseName} className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
                              {courseName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <SubjectActions
                      subject={subject}
                      facultySubjects={faculty.options}
                      facultyCourses={faculty.courses}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
