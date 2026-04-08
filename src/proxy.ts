import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  // まずSupabaseのセッションクッキーの期限切れをチェックし、必要ならリフレッシュ処理を行う
  const response = await updateSession(request);

  // 環境変数に設定された簡易パスワード
  const expectedPassword = process.env.SITE_COMMON_PASSWORD || 'your_common_password_here';
  const providedPassword = request.cookies.get('site_common_password')?.value;

  // 正しいパスワードがCookieに保存されていればアクセス許可
  if (providedPassword === expectedPassword) {
    return response;
  }

  const { pathname } = request.nextUrl;

  // 認証・アップロード関連のルートやログイン画面自体はリダイレクトしない
  const skipPaths = ['/login-common', '/upload', '/login', '/auth/confirm'];
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return response;
  }

  // APIルートや静的アセットなどもスキップ（matcherでも指定しているが念のため）
  if (
    pathname.startsWith('/api/') ||
    pathname.includes('.') // ファイル拡張子が含まれるパス
  ) {
    return response;
  }

  // それ以外のパスは簡易パスワード入力画面へリダイレクト
  const url = request.nextUrl.clone();
  url.pathname = '/login-common';
  const redirectResponse = NextResponse.redirect(url);
  
  // セッション更新によって付与されたクッキーを、リダイレクト時のレスポンスにも引き継ぐ
  response.cookies.getAll().forEach((c) => {
    redirectResponse.cookies.set(c.name, c.value, c as any);
  });
  
  return redirectResponse;
}

// すべてのルートでMiddlewareを実行（静的アセット以外）
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
