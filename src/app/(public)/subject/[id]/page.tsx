import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Download } from 'lucide-react';

type Props = {
  params: Promise<{ id: string }>
}

export default async function SubjectPage({ params }: Props) {
  const { id } = await params;

  // 科目とその過去問を年度の降順で取得
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      faculty: true,
      exams: {
        orderBy: { year: 'desc' }
      }
    }
  });

  if (!subject) {
    notFound();
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="text-sm text-slate-500 mb-2">{subject.faculty.name}</div>
        <h1 className="text-3xl font-bold text-slate-900">{subject.name}</h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-800 border-b pb-2">過去問一覧 ({subject.exams.length}件)</h2>
        
        {subject.exams.length === 0 ? (
          <p className="text-slate-500 py-4 bg-slate-50 px-4 rounded-md">
            この科目の過去問はまだアップロードされていません。
          </p>
        ) : (
          <div className="grid gap-4">
            {subject.exams.map(exam => (
              <Card key={exam.id} className="border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 hover:shadow-md transition-shadow bg-white">
                <div>
                  <h3 className="text-lg font-medium text-slate-900">{exam.year}年度</h3>
                  <div className="text-sm text-slate-500 mt-1 flex gap-3 flex-wrap">
                    <span>担当: <span className="text-slate-700">{exam.instructor}</span></span>
                    <span>アップロード日付: {new Date(exam.createdAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                </div>
                <a 
                  href={`/api/download/${exam.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 h-10 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  ダウンロード
                </a>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
