import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // nextに指定されたURLへリダイレクト。デフォルトは /upload
  const next = searchParams.get('next') ?? '/upload'

  // デバッグ用ログ（問題解決後に削除予定）
  console.log('[callback] URL params:', searchParams.toString())
  console.log('[callback] code:', code ? `あり (${code.substring(0, 8)}...)` : 'なし')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('[callback] 認証成功 → リダイレクト先:', `${origin}${next}`)
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('[callback] exchangeCodeForSession error:', JSON.stringify(error))
    }
  }

  // ログイン失敗時はログイン画面へ戻す
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
