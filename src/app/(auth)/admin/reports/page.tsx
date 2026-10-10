import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
  PENDING: { label: '未対応', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  RESOLVED: { label: '対応済み', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  DISMISSED: { label: '却下', className: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
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
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">通報の管理</h1>
        <p className="text-sm text-slate-500 mt-1">ログイン中: {admin.email}</p>
      </div>

      <div className="flex gap-2">
        <Link href="/admin/reports?status=pending" className={tabClass(!showAll)}>未対応のみ</Link>
        <Link href="/admin/reports?status=all" className={tabClass(showAll)}>すべて</Link>
      </div>

      {groups.size === 0 ? (
        <p className="text-slate-500 text-sm py-12 text-center bg-white rounded-lg border border-dashed border-slate-200">
          {showAll ? '通報はありません。' : '未対応の通報はありません。'}
        </p>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([examId, { exam, reports: examReports }]) => (
            <section key={examId} className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {exam.subject.faculty.name}
                    </span>
                    <Link href={`/subject/${exam.subjectId}`} className="text-lg font-bold text-slate-800 hover:text-blue-600 hover:underline">
                      {exam.subject.name}
                    </Link>
                    {exam.isHidden && (
                      <span className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                        非公開
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600">
                    {exam.year}年度 / 担当: {exam.instructor}
                  </div>
                  <div className="text-xs text-slate-500">アップロード者: {exam.uploadedBy}</div>
                  {exam.isHidden && exam.hiddenReason && (
                    <div className="text-xs text-red-600">非公開の理由: {exam.hiddenReason}</div>
                  )}
                  <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                    <span>通報 {examReports.length} 件</span>
                    <a
                      href={`/api/download/${exam.id}?preview=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      ファイルをプレビュー
                    </a>
                  </div>
                </div>
                <ExamActions examId={exam.id} isHidden={exam.isHidden} />
              </div>

              <ul className="space-y-2 border-t border-slate-100 pt-3">
                {examReports.map(report => {
                  const status = STATUS_LABELS[report.status];
                  return (
                    <li key={report.id} className="flex items-start justify-between gap-3 bg-slate-50 rounded-md border border-slate-100 px-3 py-2">
                      <div className="space-y-1 min-w-0 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}>
                            {status.label}
                          </span>
                          <span className="font-medium text-slate-800">{report.reason}</span>
                        </div>
                        {report.details && (
                          <p className="text-slate-600 whitespace-pre-wrap leading-relaxed break-words">{report.details}</p>
                        )}
                        <p className="text-xs text-slate-400">
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
