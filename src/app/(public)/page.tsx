import { prisma } from '@/lib/prisma';
import { Input } from '@/components/ui/input';
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { SubjectList } from '@/components/SubjectList';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function TopPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : '';
  
  // 学部ごとに科目を検索して取得
  const faculties = await prisma.faculty.findMany({
    include: {
      courses: {
        orderBy: { name: 'asc' }
      },
      subjects: {
        where: {
          name: {
            contains: query,
          }
        },
        include: {
          courses: true
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
                <SubjectList subjects={faculty.subjects} courses={faculty.courses} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </AccordionRoot>
      </div>
    </div>
  );
}
