import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminNav } from '../AdminNav';
import { ExamActions, DismissReportButton } from './ReportActions';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_LABELS = {
  PENDING: { label: '未対応', className: 'bg-amber-50 text-amber-800 ring-amber-600/30' },
  RESOLVED: { label: '対応済み', className: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30' },
  DISMISSED: { label: '却下', className: 'bg-muted text-muted-foreground ring-border' },
} as const;

export default async function AdminReportsPage({ searchParams }: Props) {
  // 管理者以外はトップページへ
  const admin = await getAdminUser();
  if (!admin) {
    redirect('/');
  }

  const sp = await searchParams;
  const showAll = sp.status === 'all';

  // 未対応（PENDING）を先頭に、新しい通報順で取得する（enum は定義順でソートされる）
  const reports = await prisma.report.findMany({
    where: showAll ? undefined : { status: 'PENDING' },
    include: {
      exam: {
        include: {
          subject: { include: { faculty: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  // 過去問ごとにまとめる（最初に出現した順 = 未対応の通報がある過去問が先頭）
  const groups = new Map<string, { exam: (typeof reports)[number]['exam']; reports: typeof reports }>();
  for (const report of reports) {
    const group = groups.get(report.examId);
    if (group) {
      group.reports.push(report);
    } else {
      groups.set(report.examId, { exam: report.exam, reports: [report] });
    }
  }

  const tabClass = (active: boolean) =>
    `inline-flex items-center justify-center min-h-11 px-5 rounded-full border-2 border-ink text-sm font-bold transition-colors ${
      active ? 'bg-ink text-white' : 'bg-card text-foreground hover:bg-muted'
    }`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <AdminNav />

      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">通報の管理</h1>
        <p className="text-sm text-muted-foreground mt-1 break-all">ログイン中: {admin.email}</p>
      </div>

      <div className="flex gap-2">
        <Link href="/admin/reports?status=pending" className={tabClass(!showAll)}>未対応のみ</Link>
        <Link href="/admin/reports?status=all" className={tabClass(showAll)}>すべて</Link>
      </div>

      {groups.size === 0 ? (
        <p className="text-muted-foreground text-sm py-12 text-center bg-card rounded-xl border-2 border-dashed border-ink/30">
          {showAll ? '通報はありません。' : '未対応の通報はありません。'}
        </p>
      ) : (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([examId, { exam, reports: examReports }]) => (
            <section key={examId} className="card-pop p-4 md:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-muted-foreground bg-muted border border-border px-2.5 py-0.5 rounded-full">
                      {exam.subject.faculty.name}
                    </span>
                    <Link href={`/subject/${exam.subjectId}`} className="text-lg font-bold hover:text-primary hover:underline">
                      {exam.subject.name}
                    </Link>
                    {exam.isHidden && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-800 ring-1 ring-inset ring-red-600/30">
                        非公開
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    {exam.year}年度 / 担当: {exam.instructor}
                  </div>
                  <div className="text-xs text-muted-foreground break-all">アップロード者: {exam.uploadedBy}</div>
                  {exam.isHidden && exam.hiddenReason && (
                    <div className="text-xs text-red-700">非公開の理由: {exam.hiddenReason}</div>
                  )}
                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>通報 {examReports.length} 件</span>
                    <a
                      href={`/api/download/${exam.id}?preview=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-bold hover:underline py-2"
                    >
                      ファイルをプレビュー
                    </a>
                  </div>
                </div>
                <ExamActions examId={exam.id} isHidden={exam.isHidden} />
              </div>

              <ul className="space-y-2 border-t border-border pt-3">
                {examReports.map(report => {
                  const status = STATUS_LABELS[report.status];
                  return (
                    <li key={report.id} className="flex items-start justify-between gap-3 bg-card rounded-xl border border-border px-3 py-2">
                      <div className="space-y-1 min-w-0 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="font-bold">{report.reason}</span>
                        </div>
                        {report.details && (
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed break-words">{report.details}</p>
                        )}
                        <p className="text-xs text-muted-foreground break-all">
                          通報者: {report.reportedBy} / {dateTimeFormatter.format(report.createdAt)}
                          {report.resolvedAt && (
                            <> / 対応: {report.resolvedBy ?? '不明'}（{dateTimeFormatter.format(report.resolvedAt)}）</>
                          )}
                        </p>
                      </div>
                      {report.status === 'PENDING' && <DismissReportButton reportId={report.id} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
