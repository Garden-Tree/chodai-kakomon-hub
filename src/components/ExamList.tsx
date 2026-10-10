'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, Eye, Flag, AlertTriangle, CheckCircle, X, Loader2, ArrowUpDown } from 'lucide-react';
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
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

export function ExamList({ subject, exams, currentUserEmail }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const yearSelectId = useId();
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
          className="flex items-start gap-2 p-3 rounded-md text-sm border bg-emerald-50 text-emerald-700 border-emerald-100"
        >
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">アップロードが完了しました。ありがとうございます！</span>
          <button
            type="button"
            onClick={dismissUploadedBanner}
            aria-label="メッセージを閉じる"
            className="shrink-0 rounded p-0.5 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3 border-b pb-2">
        <h2 className="text-xl font-semibold text-slate-800">過去問一覧</h2>
        <span className="text-sm text-slate-500" aria-live="polite">
          {showFilters ? `${visibleExams.length}件 / 全${exams.length}件` : `${exams.length}件`}
        </span>
      </div>

      {showFilters && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={yearSelectId} className="text-xs font-semibold text-slate-600">年度</label>
              <select
                id={yearSelectId}
                value={yearFilter}
                onChange={(e) => updateParams({ [PARAM_YEAR]: e.target.value })}
                className={selectClassName}
              >
                <option value="">すべて</option>
                {yearOptions.map(y => (
                  <option key={y} value={String(y)}>{y}年度</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={instructorSelectId} className="text-xs font-semibold text-slate-600">担当教員</label>
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
            </div>
          </div>

          {courseOptions.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">コース</span>
              <div className="flex flex-wrap gap-2">
                {[{ id: '', name: 'すべて' }, ...courseOptions].map(course => {
                  const pressed = courseFilter === course.id;
                  return (
                    <button
                      key={course.id || 'all'}
                      type="button"
                      onClick={() => updateParams({ [PARAM_COURSE]: course.id })}
                      aria-pressed={pressed}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                        pressed
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {course.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => updateParams({ [PARAM_SORT]: sortAsc ? null : 'asc' })}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              並び替え: {sortAsc ? '年度が古い順' : '年度が新しい順'}
            </button>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
              >
                条件をクリア
              </button>
            )}
          </div>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="text-slate-500 py-6 bg-slate-50 px-4 rounded-md flex flex-col items-start gap-3">
          <p>この科目の過去問はまだアップロードされていません。</p>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white transition-colors"
          >
            最初の過去問をアップロードする
          </Link>
        </div>
      ) : visibleExams.length === 0 ? (
        <div className="text-slate-500 py-6 bg-slate-50 px-4 rounded-md flex flex-col items-start gap-3">
          <p>条件に一致する過去問はありません</p>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
          >
            条件をクリア
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleExams.map(exam => (
            <Card key={exam.id} className="border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between p-5 gap-4 hover:shadow-md transition-shadow bg-white relative">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                  {exam.year}年度
                  {exam.isHidden && (
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                      非公開
                    </span>
                  )}
                </h3>
                <div className="text-sm text-slate-500 mt-1 flex gap-3 flex-wrap items-center">
                  <span>担当: <span className="text-slate-700">{exam.instructor}</span></span>
                  <span>アップロード日付: {exam.createdAt}</span>
                  {exam.courses && exam.courses.length > 0 && (
                    <span className="inline-flex gap-1.5 flex-wrap">
                      {subject.faculty.courses.length > 0 && exam.courses.length === subject.faculty.courses.length ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">全コース共通</span>
                      ) : (
                        exam.courses.map(course => (
                          <span key={course.id} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                            {course.name}
                          </span>
                        ))
                      )}
                    </span>
                  )}
                </div>
                {exam.comment && (
                  <div className="text-sm text-slate-600 mt-2.5 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed">
                    {exam.comment}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-3 justify-between items-end self-stretch shrink-0 min-h-[5.5rem] w-full sm:w-auto">
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <a 
                    href={`/api/download/${exam.id}?preview=true`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 h-10 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 text-slate-700 w-1/2 sm:w-auto text-center cursor-pointer select-none"
                  >
                    <Eye className="w-4 h-4 mr-2 shrink-0" />
                    プレビュー
                  </a>
                  <a 
                    href={`/api/download/${exam.id}`} 
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 h-10 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white w-1/2 sm:w-auto text-center cursor-pointer select-none"
                  >
                    <Download className="w-4 h-4 mr-2 shrink-0" />
                    ダウンロード
                  </a>
                </div>
                
                <button
                  onClick={() => handleReportClick(exam)}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer font-medium mt-auto self-start sm:self-end"
                >
                  <Flag className="w-3.5 h-3.5" />
                  不適切なコンテンツを通報
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 id={titleId} className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500 shrink-0" />
                不適切なコンテンツの通報
              </h3>
              <button 
                type="button"
                onClick={closeModal}
                aria-label="閉じる"
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer rounded-lg p-1 hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {!currentUserEmail ? (
                // Guest Error / Login Prompt
                <div className="space-y-4 py-2 text-center sm:text-left">
                  <div className="mx-auto sm:mx-0 p-3 bg-amber-50 text-amber-600 rounded-full w-fit">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">通報するにはログインが必要です</h4>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      スパム対策と信頼性向上のため、通報機能はログイン中のユーザー（大学のアカウント）のみ利用できます。
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end shrink-0">
                    <button
                      onClick={closeModal}
                      className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <a
                      href={`/login`}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium text-center transition-colors cursor-pointer"
                    >
                      ログイン画面へ
                    </a>
                  </div>
                </div>
              ) : submitSuccess ? (
                // Success State
                <div className="space-y-4 py-6 text-center">
                  <div className="mx-auto p-3 bg-emerald-50 text-emerald-600 rounded-full w-fit">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">通報を送信しました</h4>
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-sm mx-auto">
                      ご協力ありがとうございます。運営チームが内容を確認し、必要に応じて削除等の対応を行います。
                    </p>
                  </div>
                  <div className="pt-4 max-w-xs mx-auto">
                    <button
                      onClick={closeModal}
                      className="w-full px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              ) : (
                // Reporting Form
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">対象の過去問</span>
                    <div className="text-sm font-semibold text-slate-700 mt-0.5">
                      {selectedExam?.year}年度 / {selectedExam?.instructor} 先生
                    </div>
                  </div>

                  <fieldset className="space-y-2 border-0 p-0 m-0 min-w-0">
                    <legend className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-2">
                      通報理由 <span className="text-xs text-red-500 font-normal">（必須）</span>
                    </legend>
                    <div className="grid gap-2">
                      {REASONS.map((reasonOpt) => (
                        <label
                          key={reasonOpt}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 text-sm transition-all cursor-pointer select-none ${
                            reason === reasonOpt
                              ? 'border-slate-900 bg-slate-50/50 text-slate-900 font-medium'
                              : 'border-slate-100 bg-white hover:border-slate-200 text-slate-600 hover:text-slate-950'
                          }`}
                        >
                          <input
                            type="radio"
                            name="reason"
                            value={reasonOpt}
                            checked={reason === reasonOpt}
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-0.5 h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                          <span>{reasonOpt}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="space-y-1.5">
                    <label htmlFor="details" className="text-sm font-semibold text-slate-800">
                      補足説明 <span className="text-xs text-slate-400 font-normal">（任意）</span>
                    </label>
                    <Textarea
                      id="details"
                      placeholder="具体的な問題点（例：2枚目に別の学生の氏名が写り込んでいる、など）をご記入ください。"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="w-full resize-none"
                    />
                    <div className="text-right text-xs text-slate-400">
                      {details.length}/1000文字
                    </div>
                  </div>

                  {submitError && (
                    <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={isSubmitting}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      キャンセル
                    </button>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={isSubmitting || !reason}
                      className="px-5 py-2 font-medium cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
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
