import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  // 初期状態のレスポンスオブジェクトを作成
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // リクエストのクッキーを更新
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          
          // 新しいレスポンスオブジェクトを再作成
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          
          // レスポンスにクッキーをセット（ブラウザに保存させるため）
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() を呼ぶことで、期限切れのアクセストークン（JWT）を
  // リフレッシュトークンを使って自動的に再取得（リフレッシュ）します。
  // これによりユーザーが「ログインしっぱなし」の恩恵を受けられます。
  await supabase.auth.getUser();

  return supabaseResponse;
}
