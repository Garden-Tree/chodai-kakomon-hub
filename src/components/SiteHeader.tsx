import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';
import { isAdminEmail } from '@/lib/auth';

// サイト共通ヘッダー（(public) / (auth) 両方のレイアウトから利用する）
export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Link href="/" className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
          過去問共有Hub
        </Link>
        <nav className="flex flex-wrap gap-x-3 gap-y-1 sm:gap-4 items-center justify-end">
          {user ? (
            <>
              <span className="text-xs text-slate-400 hidden sm:inline">{user.email}</span>
              {isAdminEmail(user.email) && (
                <Link href="/admin/reports" className="text-sm whitespace-nowrap font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  管理
                </Link>
              )}
              <Link href="/mypage" className="text-sm whitespace-nowrap font-medium text-slate-600 hover:text-slate-900 transition-colors">
                マイページ
              </Link>
              <Link href="/upload" className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md whitespace-nowrap transition-colors">
                アップロード
              </Link>
              <form action={signOut} className="m-0 flex items-center">
                <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-900 transition-colors cursor-pointer bg-transparent border-0 p-0 whitespace-nowrap">
                  ログアウト
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm whitespace-nowrap font-medium text-slate-600 hover:text-slate-900 transition-colors">
                ログイン
              </Link>
              <Link href="/upload" className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md whitespace-nowrap transition-colors">
                アップロード
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
