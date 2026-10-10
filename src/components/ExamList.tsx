'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, Eye, EyeOff, Flag, AlertTriangle, CheckCircle, X, Loader2, ArrowUpDown, ChevronDown, Upload } from 'lucide-react';
import { createReport } from '@/app/actions/report';

type Course = {
  id: string;
  name: string;
  facultyId: string;
};

type Exam = {
  id: string;
  year: number;
  instructor: string;
  fileName: string | null;
  comment: string | null;
  isHidden: boolean; // 非公開（アップロード者本人・管理者にのみ表示される）
  createdAt: string; // サーバー側で整形済みの日付文字列
  courses: Course[];
};

type Subject = {
  id: string;
  name: string;
  faculty: {
    id: string;
    name: string;
    courses: Course[];
  };
};

type Props = {
  subject: Subject;
  exams: Exam[];
  currentUserEmail: string | null;
};

const REASONS = [
  '個人情報の掲載（氏名・学籍番号など）',
  '著作権侵害（教員から配布が禁止されている資料）',
  'ファイルの間違い（別科目のファイル、破損など）',
  'その他',
];

// フィルタ・並び順を保持する URL クエリのパラメータ名
const PARAM_YEAR = 'year';
const PARAM_INSTRUCTOR = 'instructor';
const PARAM_COURSE = 'course';
const PARAM_SORT = 'sort'; // 'asc' のとき年度が古い順（省略時は新しい順）
const PARAM_UPLOADED = 'uploaded'; // アップロード直後の完了バナー表示用
const FILTER_PARAMS = [PARAM_YEAR, PARAM_INSTRUCTOR, PARAM_COURSE];

// フィルタバーを表示する過去問の最小件数
const MIN_EXAMS_FOR_FILTER = 2;

const selectClassName =
  'h-10 w-full appearance-none rounded-xl border-2 border-ink bg-card pl-3 pr-9 text-base font-medium text-foreground transition-colors outline-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// 年度・コースのピル型フィルター
const pillBase =
  'inline-flex h-9 items-center rounded-full border-2 border-ink px-3 text-sm font-bold whitespace-nowrap transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const pillSelected = 'bg-ink text-white';
const pillIdle = 'bg-card text-foreground hover:bg-muted';

// 塗りつぶしの主ボタン（ダウンロード等）と枠線のみのボタン（プレビュー等）
const primaryButtonClassName =
  'edge-pop inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground text-center transition hover:brightness-110 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const outlineButtonClassName =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-ink bg-card px-4 text-sm font-bold text-foreground text-center transition-colors hover:bg-muted select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const courseBadgeClassName =
  'inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground';

export function ExamList({ subject, exams, currentUserEmail }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const yearGroupLabelId = useId();
  const courseGroupLabelId = useId();
  const instructorSelectId = useId();

  // URL クエリを更新する（null / 空文字を渡したパラメータは削除する）
  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // フィルタ候補（実際に存在する値のみ）
  const yearOptions = useMemo(
    () => Array.from(new Set(exams.map(e => e.year))).sort((a, b) => b - a),
    [exams],
  );
  const instructorOptions = useMemo(
    () => Array.from(new Set(exams.map(e => e.instructor))).sort((a, b) => a.localeCompare(b, 'ja')),
    [exams],
  );
  // この科目の過去問に1件でも紐づいているコースのみを、学部のコース順で並べる
  const courseOptions = useMemo(() => {
    const usedCourseIds = new Set(exams.flatMap(e => e.courses.map(c => c.id)));
    return subject.faculty.courses.filter(c => usedCourseIds.has(c.id));
  }, [exams, subject.faculty.courses]);

  const showFilters = exams.length >= MIN_EXAMS_FOR_FILTER;

  // URL の値を検証する（候補にない値は「すべて」として扱う）
  const rawYear = searchParams.get(PARAM_YEAR) ?? '';
  const rawInstructor = searchParams.get(PARAM_INSTRUCTOR) ?? '';
  const rawCourse = searchParams.get(PARAM_COURSE) ?? '';
  const yearFilter = yearOptions.some(y => String(y) === rawYear) ? rawYear : '';
  const instructorFilter = instructorOptions.includes(rawInstructor) ? rawInstructor : '';
  const courseFilter = courseOptions.some(c => c.id === rawCourse) ? rawCourse : '';
  const sortAsc = searchParams.get(PARAM_SORT) === 'asc';

  const hasActiveFilter = showFilters && (yearFilter !== '' || instructorFilter !== '' || courseFilter !== '');

  const visibleExams = useMemo(() => {
    if (!showFilters) return exams;
    const filtered = exams.filter(e =>
      (!yearFilter || String(e.year) === yearFilter) &&
      (!instructorFilter || e.instructor === instructorFilter) &&
      (!courseFilter || e.courses.some(c => c.id === courseFilter)),
    );
    // sort は安定ソートなので、同じ年度内ではサーバー側の並びが保たれる
    return [...filtered].sort((a, b) => (sortAsc ? a.year - b.year : b.year - a.year));
  }, [exams, showFilters, yearFilter, instructorFilter, courseFilter, sortAsc]);

  const clearFilters = () => {
    updateParams(Object.fromEntries(FILTER_PARAMS.map(key => [key, null])));
  };

  // アップロード完了バナー（?uploaded=1）
  const showUploadedBanner = searchParams.get(PARAM_UPLOADED) === '1';
  const dismissUploadedBanner = () => updateParams({ [PARAM_UPLOADED]: null });

  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [showModal, setShowModal] = useState(false);
  const titleId = useId();
  
  // Form states
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleReportClick = (exam: Exam) => {
    setSelectedExam(exam);
    setShowModal(true);
    setReason('');
    setDetails('');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedExam(null);
  };

  // Escapeキーでモーダルを閉じる
  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setShowModal(false);
        setSelectedExam(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showModal, isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    if (!reason) {
      setSubmitError('通報理由を選択してください。');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createReport({
        examId: selectedExam.id,
        reason,
        details: details.trim() || undefined,
      });

      if (result.ok) {
        setSubmitSuccess(true);
      } else {
        setSubmitError(result.message);
      }
    } catch (err) {
      // 通信エラーなど、Server Action が結果を返せなかった場合
      console.error(err);
      setSubmitError('通報の送信に失敗しました。通信環境を確認して再度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {showUploadedBanner && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border-2 border-ink bg-highlight p-3 text-sm font-bold text-highlight-foreground"
        >
          <CheckCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="flex-1">アップロードが完了しました。ありがとうございます！</span>
          <button
            type="button"
            onClick={dismissUploadedBanner}
            aria-label="メッセージを閉じる"
            className="shrink-0 rounded-md p-0.5 hover:bg-black/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-foreground">過去問一覧</h2>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {showFilters ? `${visibleExams.length}件 / 全${exams.length}件` : `${exams.length}件`}
        </span>
      </div>

      {showFilters && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3 md:p-4">
          <div className="space-y-1.5">
            <span id={yearGroupLabelId} className="block text-xs font-bold text-muted-foreground">年度</span>
            <div
              role="group"
              aria-labelledby={yearGroupLabelId}
              className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 md:-mx-4 md:px-4"
            >
              {[{ value: '', label: 'すべて' }, ...yearOptions.map(y => ({ value: String(y), label: `${y}年度` }))].map(option => {
                const pressed = yearFilter === option.value;
                return (
                  <button
                    key={option.value || 'all'}
                    type="button"
                    onClick={() => updateParams({ [PARAM_YEAR]: option.value })}
                    aria-pressed={pressed}
                    className={`${pillBase} shrink-0 ${pressed ? pillSelected : pillIdle}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {courseOptions.length > 0 && (
            <div className="space-y-1.5">
              <span id={courseGroupLabelId} className="block text-xs font-bold text-muted-foreground">コース</span>
              <div
                role="group"
                aria-labelledby={courseGroupLabelId}
                className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 md:-mx-4 md:px-4"
              >
                {[{ id: '', name: 'すべて' }, ...courseOptions].map(course => {
                  const pressed = courseFilter === course.id;
                  return (
                    <button
                      key={course.id || 'all'}
                      type="button"
                      onClick={() => updateParams({ [PARAM_COURSE]: course.id })}
                      aria-pressed={pressed}
                      className={`${pillBase} shrink-0 ${pressed ? pillSelected : pillIdle}`}
                    >
                      {course.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 items-end gap-2">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor={instructorSelectId} className="block text-xs font-bold text-muted-foreground">担当教員</label>
              <div className="relative">
                <select
                  id={instructorSelectId}
                  value={instructorFilter}
                  onChange={(e) => updateParams({ [PARAM_INSTRUCTOR]: e.target.value })}
                  className={selectClassName}
                >
                  <option value="">すべて</option>
                  {instructorOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateParams({ [PARAM_SORT]: sortAsc ? null : 'asc' })}
              className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-card px-2 text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowUpDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">並び替え: {sortAsc ? '古い順' : '新しい順'}</span>
            </button>
          </div>

          {hasActiveFilter && (
            <div className="flex justify-end border-t border-border pt-2">
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-9 px-1 text-sm font-bold text-primary underline underline-offset-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded"
              >
                条件をクリア
              </button>
            </div>
          )}
        </div>
      )}

      {exams.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-ink/40 bg-secondary px-4 py-8 text-center">
          <p className="text-base text-secondary-foreground">この科目の過去問はまだアップロードされていません。</p>
          <Link
            href={`/upload?subject=${encodeURIComponent(subject.id)}`}
            className={primaryButtonClassName}
          >
            <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
            最初の過去問をアップロードする
          </Link>
        </div>
      ) : visibleExams.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-ink/40 bg-secondary px-4 py-8 text-center">
          <p className="text-base text-secondary-foreground">条件に一致する過去問はありません</p>
          <button
            type="button"
            onClick={clearFilters}
            className={`${primaryButtonClassName} cursor-pointer`}
          >
            条件をクリア
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleExams.map(exam => (
            <article key={exam.id} className="card-pop flex flex-col gap-3 p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                  {exam.year}年度
                </h3>
                <span className="rounded bg-red-100 px-1.5 text-xs font-bold text-red-900">PDF</span>
                {exam.isHidden && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-600/20">
                    <EyeOff className="w-3 h-3" aria-hidden="true" />
                    非公開
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-base text-foreground">
                  <span className="text-muted-foreground">担当:</span> {exam.instructor}
                </p>
                {exam.courses && exam.courses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {subject.faculty.courses.length > 0 && exam.courses.length === subject.faculty.courses.length ? (
                      <span className={courseBadgeClassName}>全コース共通</span>
                    ) : (
                      exam.courses.map(course => (
                        <span key={course.id} className={courseBadgeClassName}>
                          {course.name}
                        </span>
                      ))
                    )}
                  </div>
                )}
                {exam.comment && (
                  <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {exam.comment}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">アップロード日付: {exam.createdAt}</p>
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`/api/download/${exam.id}`}
                    className={primaryButtonClassName}
                  >
                    <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                    ダウンロード
                  </a>
                  <a
                    href={`/api/download/${exam.id}?preview=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={outlineButtonClassName}
                  >
                    <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                    プレビュー
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => handleReportClick(exam)}
                  aria-label="不適切なコンテンツを通報"
                  className="inline-flex min-h-8 items-center gap-1 self-end rounded px-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                  通報
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="card-pop max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 id={titleId} className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Flag className="w-5 h-5 text-destructive shrink-0" aria-hidden="true" />
                不適切なコンテンツの通報
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="閉じる"
                className="inline-flex size-10 items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {!currentUserEmail ? (
                // Guest Error / Login Prompt
                <div className="space-y-4 py-2 text-center sm:text-left">
                  <div className="mx-auto sm:mx-0 p-3 bg-amber-50 text-amber-600 rounded-full w-fit">
                    <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">通報するにはログインが必要です</h4>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      スパム対策と信頼性向上のため、通報機能はログイン中のユーザー（大学のアカウント）のみ利用できます。
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end shrink-0">
                    <button
                      type="button"
                      onClick={closeModal}
                      className={`${outlineButtonClassName} w-full sm:w-auto cursor-pointer`}
                    >
                      キャンセル
                    </button>
                    <a
                      href={`/login`}
                      className={`${primaryButtonClassName} w-full sm:w-auto`}
                    >
                      ログイン画面へ
                    </a>
                  </div>
                </div>
              ) : submitSuccess ? (
                // Success State
                <div className="space-y-4 py-6 text-center">
                  <div className="mx-auto p-3 bg-emerald-50 text-emerald-600 rounded-full w-fit">
                    <CheckCircle className="w-8 h-8" aria-hidden="true" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-foreground">通報を送信しました</h4>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">
                      ご協力ありがとうございます。運営チームが内容を確認し、必要に応じて削除等の対応を行います。
                    </p>
                  </div>
                  <div className="pt-4 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex w-full min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              ) : (
                // Reporting Form
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="bg-muted p-3 rounded-xl border border-border">
                    <span className="text-xs text-muted-foreground font-bold tracking-wider">対象の過去問</span>
                    <div className="text-sm font-bold text-foreground mt-0.5">
                      {selectedExam?.year}年度 / {selectedExam?.instructor} 先生
                    </div>
                  </div>

                  <fieldset className="space-y-2 border-0 p-0 m-0 min-w-0">
                    <legend className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-2">
                      通報理由 <span className="text-xs text-destructive font-normal">（必須）</span>
                    </legend>
                    <div className="grid gap-2">
                      {REASONS.map((reasonOpt) => (
                        <label
                          key={reasonOpt}
                          className={`flex items-start gap-3 p-3 rounded-xl border-2 text-sm transition-colors cursor-pointer select-none ${
                            reason === reasonOpt
                              ? 'border-ink bg-secondary text-foreground font-bold'
                              : 'border-border bg-card hover:border-ink/40 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <input
                            type="radio"
                            name="reason"
                            value={reasonOpt}
                            checked={reason === reasonOpt}
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                          />
                          <span>{reasonOpt}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="space-y-1.5">
                    <label htmlFor="details" className="text-sm font-bold text-foreground">
                      補足説明 <span className="text-xs text-muted-foreground font-normal">（任意）</span>
                    </label>
                    <Textarea
                      id="details"
                      placeholder="具体的な問題点（例：2枚目に別の学生の氏名が写り込んでいる、など）をご記入ください。"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="w-full resize-none rounded-xl"
                    />
                    <div className="text-right text-xs text-muted-foreground">
                      {details.length}/1000文字
                    </div>
                  </div>

                  {submitError && (
                    <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={isSubmitting}
                      className={`${outlineButtonClassName} cursor-pointer disabled:opacity-50 disabled:pointer-events-none`}
                    >
                      キャンセル
                    </button>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={isSubmitting || !reason}
                      className="min-h-11 rounded-xl px-5 font-bold cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          送信中...
                        </>
                      ) : (
                        '通報を送信する'
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
