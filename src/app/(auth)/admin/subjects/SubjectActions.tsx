'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { renameSubject, mergeSubjects, deleteEmptySubject, setSubjectCourses } from '@/app/actions/admin-subjects';
import type { ActionResult } from '@/lib/action-result';

// 通信エラーなど、Server Action が結果を返せなかった場合のメッセージ
const NETWORK_ERROR_MESSAGE = '操作に失敗しました。時間をおいて再試行してください。';

// B案のボタン・入力欄スタイル（主要ボタンは各入力欄の確定ボタンだけ）
const OUTLINE_BUTTON_CLASS = 'bg-card border-2 border-ink rounded-xl min-h-11 px-4 text-sm font-bold cursor-pointer hover:bg-muted';
const DANGER_BUTTON_CLASS =
  'bg-card border-2 border-red-700 text-red-700 hover:bg-red-50 hover:text-red-800 rounded-xl min-h-11 px-4 text-sm font-bold cursor-pointer';
const PRIMARY_BUTTON_CLASS =
  'bg-primary text-primary-foreground edge-pop border-2 border-ink rounded-xl min-h-11 px-4 text-sm font-bold cursor-pointer';

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

  // 別の操作が成功したときは、前回の統合・削除の結果バナー（?done=...&moved=...）を URL から取り除く
  const clearPageNotice = () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('done') && !params.has('moved')) return;
    params.delete('done');
    params.delete('moved');
    const qs = params.toString();
    router.replace(qs ? `/admin/subjects?${qs}` : '/admin/subjects', { scroll: false });
  };

  const openMode = (next: Mode) => {
    setError('');
    setSuccess('');
    setName(subject.name);
    setCourseIds(subject.courseIds);
    setMode(next);
  };

  const handleRename = () => {
    run(
      () => renameSubject(subject.id, name),
      () => '名前を変更しました。',
      () => {
        setMode('idle');
        clearPageNotice();
      },
    );
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
    run(
      () => setSubjectCourses(subject.id, courseIds),
      () => 'コースを更新しました。',
      () => {
        setMode('idle');
        clearPageNotice();
      },
    );
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
        <Button variant="outline" disabled={isPending || mode === 'rename'} onClick={() => openMode('rename')} className={OUTLINE_BUTTON_CLASS}>
          名前を変更
        </Button>
        <Button variant="outline" disabled={isPending || mode === 'merge' || targets.length === 0} onClick={() => openMode('merge')} className={OUTLINE_BUTTON_CLASS}>
          統合
        </Button>
        <Button variant="outline" disabled={isPending || mode === 'courses' || facultyCourses.length === 0} onClick={() => openMode('courses')} className={OUTLINE_BUTTON_CLASS}>
          コースを編集
        </Button>
        {subject.examCount === 0 && (
          <Button variant="outline" disabled={isPending} onClick={handleDelete} className={DANGER_BUTTON_CLASS}>
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
            className="w-full text-sm bg-card border-2 border-ink/80 rounded-xl min-h-11 focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={isPending} onClick={() => setMode('idle')} className={OUTLINE_BUTTON_CLASS}>
              キャンセル
            </Button>
            <Button disabled={isPending || name.trim() === ''} onClick={handleRename} className={PRIMARY_BUTTON_CLASS}>
              保存
            </Button>
          </div>
        </div>
      )}

      {mode === 'merge' && (
        <div className="flex w-full flex-col gap-2 sm:w-80">
          <p className="text-xs text-muted-foreground">この科目の過去問を、選択した科目に移動して、この科目を削除します。</p>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            aria-label="統合先の科目"
            className="min-h-11 w-full rounded-xl border-2 border-ink/80 bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">統合先を選択...</option>
            {targets.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.examCount}件）
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={isPending} onClick={() => setMode('idle')} className={OUTLINE_BUTTON_CLASS}>
              キャンセル
            </Button>
            <Button disabled={isPending || targetId === ''} onClick={handleMerge} className={PRIMARY_BUTTON_CLASS}>
              統合する
            </Button>
          </div>
        </div>
      )}

      {mode === 'courses' && (
        <div className="flex w-full flex-col gap-2 sm:w-80">
          <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-2">
            {facultyCourses.map(course => (
              <label key={course.id} className="flex items-center gap-3 min-h-11 px-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={courseIds.includes(course.id)}
                  onChange={(e) => toggleCourse(course.id, e.target.checked)}
                  className="size-5 accent-primary cursor-pointer"
                />
                {course.name}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={isPending} onClick={() => setMode('idle')} className={OUTLINE_BUTTON_CLASS}>
              キャンセル
            </Button>
            <Button disabled={isPending} onClick={handleSaveCourses} className={PRIMARY_BUTTON_CLASS}>
              保存
            </Button>
          </div>
        </div>
      )}

      {isPending && <p className="text-xs text-muted-foreground">処理中...</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {success && !error && <p role="status" className="text-xs text-emerald-700">{success}</p>}
    </div>
  );
}
