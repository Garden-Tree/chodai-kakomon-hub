import Link from 'next/link';
import { BookOpen, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions/auth';
import { isAdminEmail } from '@/lib/auth';

// テキストリンク（スマホではアイコンのみ表示し、ラベルはスクリーンリーダー向けに残す）
const navLinkClassName =
  'inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-bold whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

// サイト共通ヘッダー（(public) / (auth) 両方のレイアウトから利用する）
export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b-2 border-ink bg-white">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span
            className="flex size-8 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-ink"
            aria-hidden="true"
          >
            <BookOpen className="size-4" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-foreground">過去問ハブ</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1 sm:gap-x-2">
          {user ? (
            <>
              <span className="mr-1 hidden max-w-56 truncate text-xs text-muted-foreground md:inline">
                {user.email}
              </span>
              {isAdminEmail(user.email) && (
                <Link href="/admin/reports" className={navLinkClassName}>
                  <ShieldCheck className="size-5 sm:hidden" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">管理</span>
                </Link>
              )}
              <Link href="/mypage" className={navLinkClassName}>
                <UserRound className="size-5 sm:hidden" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">マイページ</span>
              </Link>
              <form action={signOut} className="m-0 flex items-center">
                <button
                  type="submit"
                  className={`${navLinkClassName} cursor-pointer border-0 bg-transparent hover:text-destructive`}
                >
                  <LogOut className="size-5 sm:hidden" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">ログアウト</span>
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={navLinkClassName}>
              ログイン
            </Link>
          )}
          <Link
            href="/upload"
            className="edge-pop inline-flex min-h-10 items-center rounded-full bg-primary px-3 sm:px-4 text-sm font-bold whitespace-nowrap text-primary-foreground transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            アップロード
          </Link>
        </nav>
      </div>
    </header>
  );
}
