'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

type Course = {
  id: string;
  name: string;
};

type Subject = {
  id: string;
  name: string;
  courses: Course[];
};

type Props = {
  subjects: Subject[];
  courses: Course[];
};

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
    <div className="space-y-4 pt-2">
      {/* コース選択のピル型フィルター（コースが存在する場合のみ表示） */}
      {courses.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
          <button
            onClick={() => setSelectedCourseId(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
              selectedCourseId === null
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            すべて ({getSubjectCountForCourse(null)})
          </button>
          
          {courses.map(course => {
            const count = getSubjectCountForCourse(course.id);
            return (
              <button
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                  selectedCourseId === course.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {course.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* 科目一覧グリッド */}
      {filteredSubjects.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
          該当する科目がありません。
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map(subject => (
            <Link key={subject.id} href={`/subject/${subject.id}`}>
              <Card className="hover:border-slate-800 hover:shadow-md transition-all cursor-pointer h-full border-slate-200 group bg-white">
                <CardHeader className="py-4">
                  <CardTitle className="text-base font-medium text-slate-800 group-hover:text-slate-900 transition-colors">
                    {subject.name}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
