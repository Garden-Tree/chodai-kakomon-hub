import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 環境変数に設定された簡易パスワード
  const expectedPassword = process.env.SITE_COMMON_PASSWORD || 'your_common_password_here';
  const providedPassword = request.cookies.get('site_common_password')?.value;

  // 正しいパスワードがCookieに保存されていればアクセス許可
  if (providedPassword === expectedPassword) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // 認証・アップロード関連のルートやログイン画面自体はリダイレクトしない
  const skipPaths = ['/login-common', '/upload', '/login', '/auth/callback'];
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // APIルートや静的アセットなどもスキップ（matcherでも指定しているが念のため）
  if (
    pathname.startsWith('/api/') ||
    pathname.includes('.') // ファイル拡張子が含まれるパス
  ) {
    return NextResponse.next();
  }

  // それ以外のパスは簡易パスワード入力画面へリダイレクト
  const url = request.nextUrl.clone();
  url.pathname = '/login-common';
  return NextResponse.redirect(url);
}

// すべてのルートでMiddlewareを実行（静的アセット以外）
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
