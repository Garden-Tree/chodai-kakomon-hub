'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { hideExam, unhideExam, dismissReport, adminDeleteExam } from '@/app/actions/admin';
import type { ActionResult } from '@/lib/action-result';

// 通信エラーなど、Server Action が結果を返せなかった場合のメッセージ
const NETWORK_ERROR_MESSAGE = '操作に失敗しました。時間をおいて再試行してください。';

// 過去問単位の操作（非公開・公開に戻す・削除）
export function ExamActions({ examId, isHidden }: { examId: string; isHidden: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // 非公開にする理由の入力欄（「非公開にする」を押すと開く）
  const [isHiding, setIsHiding] = useState(false);
  const [reason, setReason] = useState('');

  const run = (action: () => Promise<ActionResult>, successMessage: string) => {
    setError('');
    setSuccess('');
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.message);
        else setSuccess(successMessage);
      } catch (err) {
        console.error(err);
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  };

  const handleHideConfirm = () => {
    const trimmed = reason.trim();
    setIsHiding(false);
    setReason('');
    run(
      () => hideExam(examId, trimmed || undefined),
      '非公開にしました。未対応一覧からは外れ、「すべて」タブで確認できます。',
    );
  };

  const handleHideCancel = () => {
    setIsHiding(false);
    setReason('');
  };

  const handleDelete = () => {
    if (!window.confirm('この過去問を完全に削除します。ファイルも削除され、元に戻せません。よろしいですか？')) return;
    run(() => adminDeleteExam(examId), '削除しました。');
  };

  return (
    <div className="flex flex-col gap-2 items-start sm:items-end">
      <div className="flex flex-wrap gap-2">
        {isHidden ? (
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => run(() => unhideExam(examId), '公開に戻しました。')} className="cursor-pointer">
            公開に戻す
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || isHiding}
            onClick={() => setIsHiding(true)}
            className="cursor-pointer"
          >
            非公開にする
          </Button>
        )}
        <Button variant="destructive" size="sm" disabled={isPending} onClick={handleDelete} className="cursor-pointer">
          過去問を削除
        </Button>
      </div>
      {!isHidden && isHiding && (
        <div className="flex w-full flex-col gap-2 sm:w-72">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="非公開の理由（任意。アップロード者にも表示されます）"
            maxLength={200}
            rows={3}
            aria-label="非公開の理由"
            autoFocus
            className="w-full resize-none text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">{reason.length}/200文字</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={isPending} onClick={handleHideCancel} className="cursor-pointer">
                キャンセル
              </Button>
              <Button size="sm" disabled={isPending} onClick={handleHideConfirm} className="cursor-pointer">
                確定
              </Button>
            </div>
          </div>
        </div>
      )}
      {isPending && <p className="text-xs text-slate-500">処理中...</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {success && !error && <p role="status" className="text-xs text-emerald-600">{success}</p>}
    </div>
  );
}

// 通報単位の操作（却下）
export function DismissReportButton({ reportId }: { reportId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDismiss = () => {
    setError('');
    setSuccess('');
    startTransition(async () => {
      try {
        const result = await dismissReport(reportId);
        if (!result.ok) setError(result.message);
        else setSuccess('却下しました。');
      } catch (err) {
        console.error(err);
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1 items-start sm:items-end shrink-0">
      <Button variant="outline" size="xs" disabled={isPending} onClick={handleDismiss} className="cursor-pointer">
        {isPending ? '処理中...' : '却下'}
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {success && !error && <p role="status" className="text-xs text-emerald-600">{success}</p>}
    </div>
  );
}
