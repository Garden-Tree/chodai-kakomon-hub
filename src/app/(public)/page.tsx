import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

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

      <div className="space-y-4">
        <AccordionRoot>
          {faculties.map(faculty => (
            <AccordionItem key={faculty.id} value={faculty.id}>
              <AccordionTrigger value={faculty.id}>
                <span className="flex items-center gap-2">
                  {faculty.name}
                  <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {faculty.subjects.length} 科目
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent value={faculty.id}>
                {faculty.subjects.length === 0 ? (
                  <p className="text-slate-500 text-sm py-8 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    該当する科目がありません。
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {faculty.subjects.map(subject => (
                      <Link key={subject.id} href={`/subject/${subject.id}`}>
                        <Card className="hover:border-slate-800 hover:shadow-md transition-all cursor-pointer h-full border-slate-200 group">
                          <CardHeader className="py-4">
                            <CardTitle className="text-base font-medium text-slate-800 group-hover:text-slate-900 transition-colors">
                              {subject.name}
                            </CardTitle>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </AccordionRoot>
      </div>
    </div>
  );
}
