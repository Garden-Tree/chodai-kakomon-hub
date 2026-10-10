'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateExamData, deleteExamData } from '@/app/actions/upload';
import { Calendar, User, MessageSquare, Edit2, Trash2, Eye, Download, BookOpen, X, CheckCircle, AlertTriangle } from 'lucide-react';

// B案のボタン・入力欄スタイル（主要ボタンは1画面に1つだけ）
const PRIMARY_BUTTON_CLASS =
  'bg-primary text-primary-foreground edge-pop border-2 border-ink rounded-xl min-h-11 font-bold cursor-pointer';
const OUTLINE_BUTTON_CLASS = 'bg-card border-2 border-ink rounded-xl min-h-11 font-bold cursor-pointer hover:bg-muted';
const INPUT_CLASS = 'bg-card border-2 border-ink/80 rounded-xl min-h-11 focus-visible:ring-2 focus-visible:ring-ring';

type Course = {
  id: string;
  name: string;
  facultyId: string;
};

type Exam = {
  id: string;
  subjectId: string;
  year: number;
  instructor: string;
  fileUrl: string;
  fileName: string | null;
  uploadedBy: string;
  comment: string | null;
  isHidden: boolean;
  hiddenReason: string | null;
  createdAt: Date | string;
  subject: {
    id: string;
    name: string;
    facultyId: string;
    faculty: {
      id: string;
      name: string;
    };
  };
  courses: Course[];
};

type Props = {
  exams: Exam[];
  allCourses: Course[];
  email: string;
};

export function MyPageClient({ exams, allCourses, email }: Props) {
  const router = useRouter();
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // 開講年度の入力欄の下に表示するエラー
  const [yearError, setYearError] = useState('');
  // 担当教員の入力欄の下に表示するエラー
  const [instructorError, setInstructorError] = useState('');
  // 一覧上部に表示する結果メッセージ（数秒で自動的に消える）
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const titleId = useId();

  // 編集モーダルのフォーム入力状態（年は入力途中の状態を保つため文字列で保持し、送信時に検証する）
  const [editYear, setEditYear] = useState<string>(String(new Date().getFullYear()));
  const [editInstructor, setEditInstructor] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editCourseIds, setEditCourseIds] = useState<string[]>([]);

  // 編集開始
  const handleStartEdit = (exam: Exam) => {
    setEditingExam(exam);
    setEditYear(String(exam.year));
    setEditInstructor(exam.instructor);
    setEditComment(exam.comment || '');
    setEditCourseIds(exam.courses.map(c => c.id));
    setError('');
    setYearError('');
    setInstructorError('');
  };

  // 編集モーダルのキャンセル
  const handleCancelEdit = () => {
    setEditingExam(null);
    setError('');
    setYearError('');
    setInstructorError('');
  };

  // 結果メッセージを3秒後に自動で消す
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Escapeキーで編集モーダルを閉じる
  const isModalOpen = editingExam !== null;
  useEffect(() => {
    if (!isModalOpen || isUpdating) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingExam(null);
        setError('');
        setYearError('');
        setInstructorError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, isUpdating]);

  // 選択している学部のコースリストを抽出
  const facultyId = editingExam?.subject.facultyId;
  const filteredCourses = allCourses.filter(c => c.facultyId === facultyId);

  // 全選択・解除
  const isAllCoursesChecked =
    filteredCourses.length > 0 && filteredCourses.every(c => editCourseIds.includes(c.id));

  const handleAllCoursesToggle = (checked: boolean) => {
    if (checked) {
      setEditCourseIds(filteredCourses.map(c => c.id));
    } else {
      setEditCourseIds([]);
    }
  };

  // 個別チェックの切り替え
  const handleCourseToggle = (courseId: string, checked: boolean) => {
    if (checked) {
      setEditCourseIds([...editCourseIds, courseId]);
    } else {
      setEditCourseIds(editCourseIds.filter(id => id !== courseId));
    }
  };

  // 編集の保存処理
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;

    const currentYear = new Date().getFullYear();
    const trimmedYear = editYear.trim();
    const parsedYear = Number(trimmedYear);
    if (!trimmedYear) {
      setYearError('開講年度を入力してください。');
      return;
    }
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > currentYear) {
      setYearError(`開講年度は1900〜${currentYear}の整数で入力してください。`);
      return;
    }
    setYearError('');

    if (!editInstructor.trim()) {
      setInstructorError('担当教員を入力してください。');
      return;
    }
    setInstructorError('');

    if (filteredCourses.length > 0 && editCourseIds.length === 0) {
      setError('少なくとも1つの対象コースを選択してください。');
      return;
    }

    setIsUpdating(true);
    setError('');

    try {
      const result = await updateExamData({
        examId: editingExam.id,
        year: parsedYear,
        instructor: editInstructor,
        comment: editComment,
        courseIds: editCourseIds,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setEditingExam(null);
      setNotice({ type: 'success', text: '更新しました' });
      router.refresh();
    } catch (err) {
      // 通信エラーなど、Server Action が結果を返せなかった場合
      console.error(err);
      setError('更新中にエラーが発生しました。通信環境を確認して再度お試しください。');
    } finally {
      setIsUpdating(false);
    }
  };

  // 削除処理
  const handleDelete = async (examId: string) => {
    if (!confirm('この過去問データを本当に削除しますか？\n（アップロードされたファイルも完全に削除されます）')) {
      return;
    }

    setDeletingId(examId);
    setNotice(null);
    try {
      const result = await deleteExamData(examId);

      if (!result.ok) {
        setNotice({ type: 'error', text: result.message });
        return;
      }

      setNotice({ type: 'success', text: '削除しました' });
      router.refresh();
    } catch (err) {
      // 通信エラーなど、Server Action が結果を返せなかった場合
      console.error(err);
      setNotice({ type: 'error', text: '削除中にエラーが発生しました。通信環境を確認して再度お試しください。' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ユーザーヘッダー */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">マイページ</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ログイン中アカウント: <span className="font-bold text-foreground break-all">{email}</span>
          </p>
        </div>
        <Link href="/upload" className="shrink-0">
          <Button className={`${PRIMARY_BUTTON_CLASS} w-full md:w-auto px-5`}>
            過去問を新しくアップロード
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg md:text-xl font-bold border-b-2 border-ink pb-2">アップロード済みの過去問 ({exams.length}件)</h2>

        {notice && (
          <div
            role={notice.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2 p-3 rounded-xl text-sm border-2 ${
              notice.type === 'success'
                ? 'bg-highlight text-highlight-foreground border-ink'
                : 'bg-red-50 text-red-800 border-red-700'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {exams.length === 0 ? (
          <div className="card-pop py-12 px-6 text-center space-y-4">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <p className="font-bold">まだ過去問がアップロードされていません</p>
              <p className="text-sm text-muted-foreground">あなたがこれまでに共有した過去問がここに一覧表示されます。</p>
            </div>
            <Link href="/upload" className="inline-block pt-2">
              <Button variant="outline" className={`${OUTLINE_BUTTON_CLASS} px-5`}>過去問をアップロードする</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {exams.map(exam => (
              <div key={exam.id} className="card-pop flex flex-col justify-between p-4 md:p-5 gap-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-muted-foreground bg-muted border border-border px-2.5 py-0.5 rounded-full">
                        {exam.subject.faculty.name}
                      </span>
                      <Link
                        href={`/subject/${exam.subjectId}`}
                        className="text-lg font-bold hover:text-primary hover:underline transition-colors break-words"
                      >
                        {exam.subject.name}
                      </Link>
                    </div>

                    <h3 className="text-base font-bold">{exam.year}年度</h3>

                    {exam.isHidden && (
                      <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold">
                          非公開（運営により非表示）
                        </span>
                        {exam.hiddenReason && (
                          <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">理由: {exam.hiddenReason}</p>
                        )}
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground flex gap-x-4 gap-y-1 flex-wrap items-center">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> 担当: <span className="text-foreground font-bold">{exam.instructor}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> アップロード日付: {new Date(exam.createdAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                      </span>
                    </div>

                    {exam.courses && exam.courses.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap pt-0.5">
                        {exam.courses.length === allCourses.filter(c => c.facultyId === exam.subject.facultyId).length ? (
                          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
                            全コース共通
                          </span>
                        ) : (
                          exam.courses.map(course => (
                            <span key={course.id} className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground">
                              {course.name}
                            </span>
                          ))
                        )}
                      </div>
                    )}

                    {exam.comment && (
                      <div className="text-sm mt-2 bg-muted px-3 py-2 rounded-xl border border-border whitespace-pre-wrap flex items-start gap-1.5">
                        <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{exam.comment}</span>
                      </div>
                    )}

                    {exam.fileName && (
                      <p className="text-xs text-muted-foreground pt-1 break-all">
                        ファイル名: <span className="font-mono">{exam.fileName}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:shrink-0 md:flex md:flex-col lg:flex-row">
                    <a
                      href={`/api/download/${exam.id}?preview=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center bg-card border-2 border-ink rounded-xl min-h-11 px-4 text-sm font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      プレビュー
                    </a>
                    <a
                      href={`/api/download/${exam.id}`}
                      className="inline-flex items-center justify-center bg-card border-2 border-ink rounded-xl min-h-11 px-4 text-sm font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      DL
                    </a>
                    <Button
                      onClick={() => handleStartEdit(exam)}
                      variant="outline"
                      className={`${OUTLINE_BUTTON_CLASS} px-4`}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      編集
                    </Button>
                    <Button
                      onClick={() => handleDelete(exam.id)}
                      variant="outline"
                      disabled={deletingId === exam.id}
                      className="bg-card border-2 border-red-700 text-red-700 hover:bg-red-50 hover:text-red-800 rounded-xl min-h-11 px-4 font-bold cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deletingId === exam.id ? '削除中...' : '削除'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="card-pop max-w-lg w-full p-5 md:p-6 relative animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]"
          >
            <button
              type="button"
              onClick={handleCancelEdit}
              aria-label="閉じる"
              className="absolute top-2 right-2 size-11 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="pb-4 mb-4 border-b border-border pr-10">
              <h2 id={titleId} className="text-xl font-bold">過去問情報の編集</h2>
              <p className="text-sm text-muted-foreground mt-1">
                科目の登録情報（{editingExam.subject.name}）を編集します。
              </p>
            </div>
            <form onSubmit={handleSaveEdit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-year">開講年度</Label>
                  <Input
                    id="edit-year"
                    type="number"
                    value={editYear}
                    onChange={(e) => {
                      setEditYear(e.target.value);
                      if (yearError) setYearError('');
                    }}
                    required
                    aria-invalid={yearError ? true : undefined}
                    aria-describedby={yearError ? 'edit-year-error' : undefined}
                    className={INPUT_CLASS}
                  />
                  {yearError && (
                    <p id="edit-year-error" role="alert" className="text-sm text-red-700">{yearError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-instructor">担当教員</Label>
                  <Input
                    id="edit-instructor"
                    type="text"
                    value={editInstructor}
                    onChange={(e) => {
                      setEditInstructor(e.target.value);
                      if (instructorError) setInstructorError('');
                    }}
                    required
                    aria-invalid={instructorError ? true : undefined}
                    aria-describedby={instructorError ? 'edit-instructor-error' : undefined}
                    className={INPUT_CLASS}
                  />
                  {instructorError && (
                    <p id="edit-instructor-error" role="alert" className="text-sm text-red-700">{instructorError}</p>
                  )}
                </div>
              </div>

              {/* コースの編集 */}
              {filteredCourses.length > 0 && (
                <div className="space-y-2 bg-card border border-border p-4 rounded-xl">
                  <Label className="font-bold">対象コース</Label>
                  <p className="text-xs text-muted-foreground mb-2">この過去問が対象とするコースを選択してください（複数選択可）。</p>

                  <div className="flex flex-col gap-1">
                    {/* 全コース共通 */}
                    <div className="flex items-center gap-3 min-h-11">
                      <input
                        id="modal-all-courses-toggle"
                        type="checkbox"
                        checked={isAllCoursesChecked}
                        onChange={(e) => handleAllCoursesToggle(e.target.checked)}
                        className="size-5 accent-primary cursor-pointer"
                      />
                      <label htmlFor="modal-all-courses-toggle" className="flex-1 text-sm font-bold cursor-pointer select-none py-2">
                        全コース共通
                      </label>
                    </div>

                    <hr className="border-border my-1" />

                    {/* 個別コース */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 pl-1">
                      {filteredCourses.map(course => (
                        <div key={course.id} className="flex items-center gap-3 min-h-11">
                          <input
                            id={`modal-course-${course.id}`}
                            type="checkbox"
                            checked={editCourseIds.includes(course.id)}
                            onChange={(e) => handleCourseToggle(course.id, e.target.checked)}
                            className="size-5 accent-primary cursor-pointer"
                          />
                          <label htmlFor={`modal-course-${course.id}`} className="flex-1 text-sm cursor-pointer select-none py-2">
                            {course.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-comment">備考・メモ（任意）</Label>
                <Textarea
                  id="edit-comment"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="min-h-[88px] bg-card border-2 border-ink/80 rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-800 p-3 rounded-xl text-sm border-2 border-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
                <Button
                  type="button"
                  onClick={handleCancelEdit}
                  variant="outline"
                  className={`${OUTLINE_BUTTON_CLASS} px-5`}
                  disabled={isUpdating}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  className={`${PRIMARY_BUTTON_CLASS} px-5`}
                  disabled={isUpdating}
                >
                  {isUpdating ? '保存中...' : '変更を保存する'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
