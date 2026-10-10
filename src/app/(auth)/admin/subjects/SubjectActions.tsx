'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renameSubject, mergeSubjects, deleteEmptySubject, setSubjectCourses } from '@/app/actions/admin-subjects';
import type { ActionResult } from '@/lib/action-result';

// 通信エラーなど、Server Action が結果を返せなかった場合のメッセージ
const NETWORK_ERROR_MESSAGE = '操作に失敗しました。時間をおいて再試行してください。';

export type SubjectOption = { id: string; name: string; examCount: number };
export type CourseOption = { id: string; name: string };

type Props = {
  subject: SubjectOption & { courseIds: string[] };
  // 同じ学部の科目（統合先の候補。自分自身を含んでいてもよい）
  facultySubjects: SubjectOption[];
  // 同じ学部のコース
  facultyCourses: CourseOption[];
  // 統合先として最初に選んでおく科目（重複候補から開いた場合など）
  suggestedTargetId?: string;
};

type Mode = 'idle' | 'rename' | 'merge' | 'courses';

// 科目単位の操作（名前の変更・統合・コースの編集・削除）
export function SubjectActions({ subject, facultySubjects, facultyCourses, suggestedTargetId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<Mode>('idle');

  const [name, setName] = useState(subject.name);
  const [targetId, setTargetId] = useState(suggestedTargetId ?? '');
  const [courseIds, setCourseIds] = useState<string[]>(subject.courseIds);

  const targets = facultySubjects
    .filter(s => s.id !== subject.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const run = <T,>(action: () => Promise<ActionResult<T>>, onSuccess: (data: T) => string, onDone?: (data: T) => void) => {
    setError('');
    setSuccess('');
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.message);
        } else {
          setSuccess(onSuccess(result.data));
          onDone?.(result.data);
        }
      } catch (err) {
        console.error(err);
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  };

  // 統合・削除が成功すると行ごと消えてしまうため、結果はページ上部のバナーに表示する（?done=...）。
  // URL には種類コードと件数だけを載せ、任意の文字列は表示しない。
  const showPageNotice = (done: 'merged' | 'deleted', moved?: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('done', done);
    if (moved !== undefined) params.set('moved', String(moved));
    else params.delete('moved');
    router.replace(`/admin/subjects?${params.toString()}`, { scroll: false });
  };

  const openMode = (next: Mode) => {
    setError('');
    setSuccess('');
    setName(subject.name);
    setCourseIds(subject.courseIds);
    setMode(next);
  };

  const handleRename = () => {
    run(() => renameSubject(subject.id, name), () => '名前を変更しました。', () => setMode('idle'));
  };

  const handleMerge = () => {
    const target = targets.find(s => s.id === targetId);
    if (!target) {
      setError('統合先の科目を選択してください。');
      return;
    }
    const message = `「${subject.name}」の過去問 ${subject.examCount} 件を「${target.name}」に移動し、「${subject.name}」を削除します。よろしいですか？`;
    if (!window.confirm(message)) return;
    run(
      () => mergeSubjects(subject.id, target.id),
      (data) => `「${target.name}」に統合しました（過去問 ${data.movedExams} 件を移動）。`,
      (data) => {
        setMode('idle');
        showPageNotice('merged', data.movedExams);
      },
    );
  };

  const handleSaveCourses = () => {
    run(() => setSubjectCourses(subject.id, courseIds), () => 'コースを更新しました。', () => setMode('idle'));
  };

  const handleDelete = () => {
    if (!window.confirm(`過去問のない科目「${subject.name}」を削除します。よろしいですか？`)) return;
    run(() => deleteEmptySubject(subject.id), () => '削除しました。', () => showPageNotice('deleted'));
  };

  const toggleCourse = (courseId: string, checked: boolean) => {
    setCourseIds(prev => (checked ? [...prev, courseId] : prev.filter(id => id !== courseId)));
  };

  return (
    <div className="flex flex-col gap-2 items-start sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={isPending || mode === 'rename'} onClick={() => openMode('rename')} className="cursor-pointer">
          名前を変更
        </Button>
        <Button variant="outline" size="sm" disabled={isPending || mode === 'merge' || targets.length === 0} onClick={() => openMode('merge')} className="cursor-pointer">
          統合
        </Button>
        <Button variant="outline" size="sm" disabled={isPending || mode === 'courses' || facultyCourses.length === 0} onClick={() => openMode('courses')} className="cursor-pointer">
          コースを編集
        </Button>
        {subject.examCount === 0 && (
          <Button variant="destructive" size="sm" disabled={isPending} onClick={handleDelete} className="cursor-pointer">
            削除
          </Button>
        )}
      </div>

      {mode === 'rename' && (
        <div className="flex w-full flex-col gap-2 sm:w-80">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            aria-label="新しい科目名"
            autoFocus
            className="w-full text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setMode('idle')} className="cursor-pointer">
              キャンセル
            </Button>
            <Button size="sm" disabled={isPending || name.trim() === ''} onClick={handleRename} className="cursor-pointer">
              保存
            </Button>
          </div>
        </div>
      )}

      {mode === 'merge' && (
        <div className="flex w-full flex-col gap-2 sm:w-80">
          <p className="text-xs text-slate-500">この科目の過去問を、選択した科目に移動して、この科目を削除します。</p>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            aria-label="統合先の科目"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">統合先を選択...</option>
            {targets.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.examCount}件）
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setMode('idle')} className="cursor-pointer">
              キャンセル
            </Button>
            <Button size="sm" disabled={isPending || targetId === ''} onClick={handleMerge} className="cursor-pointer">
              統合する
            </Button>
          </div>
        </div>
      )}

      {mode === 'courses' && (
        <div className="flex w-full flex-col gap-2 sm:w-80">
          <div className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2">
            {facultyCourses.map(course => (
              <label key={course.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={courseIds.includes(course.id)}
                  onChange={(e) => toggleCourse(course.id, e.target.checked)}
                  className="size-4 cursor-pointer"
                />
                {course.name}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setMode('idle')} className="cursor-pointer">
              キャンセル
            </Button>
            <Button size="sm" disabled={isPending} onClick={handleSaveCourses} className="cursor-pointer">
              保存
            </Button>
          </div>
        </div>
      )}

      {isPending && <p className="text-xs text-slate-500">処理中...</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {success && !error && <p role="status" className="text-xs text-emerald-600">{success}</p>}
    </div>
  );
}
