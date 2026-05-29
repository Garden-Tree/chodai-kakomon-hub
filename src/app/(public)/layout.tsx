import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
            過去問共有Hub
          </Link>
          <div className="flex gap-4 items-center">
            {user ? (
              <>
                <span className="text-xs text-slate-400 hidden sm:inline">{user.email}</span>
                <Link href="/mypage" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  マイページ
                </Link>
                <Link href="/upload" className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 px-4 py-2 rounded-md transition-colors">
                  アップロード
                </Link>
                <form action={signOut} className="m-0 flex items-center">
                  <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-900 transition-colors cursor-pointer bg-transparent border-0 p-0">
                    ログアウト
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  ログイン
                </Link>
                <Link href="/upload" className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 px-4 py-2 rounded-md transition-colors">
                  アップロード
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>
    </div>
  );
}
