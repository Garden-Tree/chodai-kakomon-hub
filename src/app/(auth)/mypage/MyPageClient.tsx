'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateExamData, deleteExamData } from '@/app/actions/upload';
import { Calendar, User, MessageSquare, Edit2, Trash2, Eye, Download, BookOpen, X } from 'lucide-react';

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

  // 編集モーダルのフォーム入力状態
  const [editYear, setEditYear] = useState<number>(new Date().getFullYear());
  const [editInstructor, setEditInstructor] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editCourseIds, setEditCourseIds] = useState<string[]>([]);

  // 編集開始
  const handleStartEdit = (exam: Exam) => {
    setEditingExam(exam);
    setEditYear(exam.year);
    setEditInstructor(exam.instructor);
    setEditComment(exam.comment || '');
    setEditCourseIds(exam.courses.map(c => c.id));
    setError('');
  };

  // 編集モーダルのキャンセル
  const handleCancelEdit = () => {
    setEditingExam(null);
    setError('');
  };

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

    if (filteredCourses.length > 0 && editCourseIds.length === 0) {
      setError('少なくとも1つの対象コースを選択してください。');
      return;
    }

    setIsUpdating(true);
    setError('');

    try {
      await updateExamData({
        examId: editingExam.id,
        year: editYear,
        instructor: editInstructor,
        comment: editComment,
        courseIds: editCourseIds,
      });

      setEditingExam(null);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || '更新中にエラーが発生しました');
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
    try {
      await deleteExamData(examId);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || '削除中にエラーが発生しました');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ユーザーヘッダー */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">マイページ</h1>
          <p className="text-slate-500 text-sm mt-1">
            ログイン中アカウント: <span className="font-semibold text-slate-700">{email}</span>
          </p>
        </div>
        <Link href="/upload">
          <Button className="font-bold cursor-pointer">
            過去問を新しくアップロード
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 border-b pb-2">アップロード済みの過去問 ({exams.length}件)</h2>

        {exams.length === 0 ? (
          <Card className="border-slate-200 shadow-sm bg-white py-12 text-center">
            <CardContent className="space-y-4">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-slate-600 font-medium">まだ過去問がアップロードされていません</p>
                <p className="text-sm text-slate-400">あなたがこれまでに共有した過去問がここに一覧表示されます。</p>
              </div>
              <Link href="/upload" className="inline-block pt-2">
                <Button variant="outline" className="font-bold cursor-pointer">過去問をアップロードする</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {exams.map(exam => (
              <Card key={exam.id} className="border-slate-200 shadow-sm flex flex-col justify-between p-5 gap-4 hover:shadow-md transition-shadow bg-white">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {exam.subject.faculty.name}
                      </span>
                      <Link 
                        href={`/subject/${exam.subjectId}`} 
                        className="text-lg font-bold text-slate-800 hover:text-blue-600 hover:underline transition-colors truncate block"
                      >
                        {exam.subject.name}
                      </Link>
                    </div>

                    <h3 className="text-base font-semibold text-slate-700">{exam.year}年度</h3>

                    <div className="text-sm text-slate-500 flex gap-4 flex-wrap items-center">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> 担当: <span className="text-slate-700 font-medium">{exam.instructor}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> アップロード日付: {new Date(exam.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>

                    {exam.courses && exam.courses.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap pt-0.5">
                        {exam.courses.length === allCourses.filter(c => c.facultyId === exam.subject.facultyId).length ? (
                          <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                            全コース共通
                          </span>
                        ) : (
                          exam.courses.map(course => (
                            <span key={course.id} className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                              {course.name}
                            </span>
                          ))
                        )}
                      </div>
                    )}

                    {exam.comment && (
                      <div className="text-sm text-slate-600 mt-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 whitespace-pre-wrap flex items-start gap-1.5">
                        <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{exam.comment}</span>
                      </div>
                    )}

                    {exam.fileName && (
                      <p className="text-xs text-slate-400 pt-1">
                        ファイル名: <span className="font-mono text-slate-500">{exam.fileName}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0 md:flex-col lg:flex-row">
                    <a 
                      href={`/api/download/${exam.id}?preview=true`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 h-10 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 text-slate-700 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      プレビュー
                    </a>
                    <a 
                      href={`/api/download/${exam.id}`} 
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 h-10 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 text-slate-700 cursor-pointer"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      DL
                    </a>
                    <Button 
                      onClick={() => handleStartEdit(exam)} 
                      variant="outline"
                      className="h-10 px-4 py-2 text-slate-700 border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      編集
                    </Button>
                    <Button 
                      onClick={() => handleDelete(exam.id)} 
                      variant="destructive"
                      disabled={deletingId === exam.id}
                      className="h-10 px-4 py-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deletingId === exam.id ? '削除中...' : '削除'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <Card className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl relative animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <button 
              type="button" 
              onClick={handleCancelEdit} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <CardHeader className="p-0 pb-4 mb-4 border-b">
              <CardTitle className="text-xl">過去問情報の編集</CardTitle>
              <CardDescription>
                科目の登録情報（{editingExam.subject.name}）を編集します。
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-year">開講年度</Label>
                  <Input
                    id="edit-year"
                    type="number"
                    value={editYear}
                    onChange={(e) => setEditYear(parseInt(e.target.value) || new Date().getFullYear())}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-instructor">担当教員</Label>
                  <Input
                    id="edit-instructor"
                    type="text"
                    value={editInstructor}
                    onChange={(e) => setEditInstructor(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* コースの編集 */}
              {filteredCourses.length > 0 && (
                <div className="space-y-2 border border-slate-200 bg-slate-50 p-4 rounded-lg">
                  <Label className="font-semibold text-slate-800">対象コース</Label>
                  <p className="text-xs text-slate-500 mb-2">この過去問が対象とするコースを選択してください（複数選択可）。</p>
                  
                  <div className="flex flex-col gap-2.5">
                    {/* 全コース共通 */}
                    <div className="flex items-center gap-2">
                      <input
                        id="modal-all-courses-toggle"
                        type="checkbox"
                        checked={isAllCoursesChecked}
                        onChange={(e) => handleAllCoursesToggle(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="modal-all-courses-toggle" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                        全コース共通
                      </label>
                    </div>

                    <hr className="border-slate-200 my-1" />

                    {/* 個別コース */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                      {filteredCourses.map(course => (
                        <div key={course.id} className="flex items-center gap-2">
                          <input
                            id={`modal-course-${course.id}`}
                            type="checkbox"
                            checked={editCourseIds.includes(course.id)}
                            onChange={(e) => handleCourseToggle(course.id, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <label htmlFor={`modal-course-${course.id}`} className="text-sm text-slate-600 cursor-pointer select-none">
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
                  className="min-h-[80px]"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-100">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <Button 
                  type="button" 
                  onClick={handleCancelEdit} 
                  variant="outline"
                  className="cursor-pointer font-bold"
                  disabled={isUpdating}
                >
                  キャンセル
                </Button>
                <Button 
                  type="submit" 
                  className="cursor-pointer font-bold"
                  disabled={isUpdating}
                >
                  {isUpdating ? '保存中...' : '変更を保存する'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
