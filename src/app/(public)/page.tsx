import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function TopPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : '';
  
  // 学部ごとに科目を検索して取得
  const faculties = await prisma.faculty.findMany({
    include: {
      subjects: {
        where: {
          name: {
            contains: query,
          }
        },
        orderBy: { name: 'asc' }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between bg-white p-6 rounded-lg shadow-sm border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">科目から探す</h1>
          <p className="text-slate-500 text-sm mt-1">過去問を閲覧したい科目を選択してください。</p>
        </div>
        
        {/* 科目検索用のシンプルなフォーム */}
        <form className="flex gap-2 w-full md:w-auto">
          <Input 
            type="search" 
            name="q" 
            placeholder="科目を検索..." 
            defaultValue={query} 
            className="w-full md:w-[300px]"
          />
        </form>
      </div>

      <div className="space-y-8">
        {faculties.map(faculty => (
          <section key={faculty.id} className="space-y-4">
            <h2 className="text-xl font-semibold border-b pb-2 text-slate-800 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-slate-800 rounded-full inline-block"></span>
              {faculty.name}
            </h2>
            {faculty.subjects.length === 0 ? (
              <p className="text-slate-500 text-sm py-4">該当する科目がありません。</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {faculty.subjects.map(subject => (
                  <Link key={subject.id} href={`/subject/${subject.id}`}>
                    <Card className="hover:border-slate-400 hover:shadow-md transition-all cursor-pointer h-full border-slate-200">
                      <CardHeader className="py-5">
                        <CardTitle className="text-lg font-medium text-slate-800">{subject.name}</CardTitle>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
