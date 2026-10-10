'use client';

import { useState } from 'react';
import { SubjectRow } from '@/components/home/SubjectRow';

type Course = {
  id: string;
  name: string;
};

type Subject = {
  id: string;
  name: string;
  examCount: number; // 公開中の過去問の件数
  courses: Course[];
};

type Props = {
  subjects: Subject[];
  courses: Course[];
};

const pillBase =
  'inline-flex min-h-10 items-center rounded-full border-2 border-ink px-3.5 text-sm font-bold transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const pillSelected = 'bg-ink text-white';
const pillIdle = 'bg-card text-foreground hover:bg-muted';

export function SubjectList({ subjects, courses }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // コースごとの科目の件数を計算
  const getSubjectCountForCourse = (courseId: string | null) => {
    if (!courseId) return subjects.length;
    return subjects.filter(s => s.courses.some(c => c.id === courseId)).length;
  };

  // 選択されたコースに基づいて科目をフィルタリング
  const filteredSubjects = selectedCourseId
    ? subjects.filter(s => s.courses.some(c => c.id === selectedCourseId))
    : subjects;

  return (
    <div className="space-y-4">
      {/* コース選択のピル型フィルター（コースが存在する場合のみ表示） */}
      {courses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCourseId(null)}
            aria-pressed={selectedCourseId === null}
            className={`${pillBase} ${selectedCourseId === null ? pillSelected : pillIdle}`}
          >
            すべて ({getSubjectCountForCourse(null)})
          </button>

          {courses.map(course => {
            const count = getSubjectCountForCourse(course.id);
            return (
              <button
                key={course.id}
                type="button"
                onClick={() => setSelectedCourseId(course.id)}
                aria-pressed={selectedCourseId === course.id}
                className={`${pillBase} ${selectedCourseId === course.id ? pillSelected : pillIdle}`}
              >
                {course.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* 科目一覧 */}
      {filteredSubjects.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-ink/40 bg-secondary py-8 text-center text-base text-secondary-foreground">
          該当する科目がありません。
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {filteredSubjects.map(subject => (
            <li key={subject.id}>
              <SubjectRow id={subject.id} name={subject.name} examCount={subject.examCount} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
