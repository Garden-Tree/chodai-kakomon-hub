import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // nextに指定されたURLへリダイレクト。デフォルトは /upload
  const next = searchParams.get('next') ?? '/upload'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('exchangeCodeForSession error:', error)
    }
  }

  // ログイン失敗時はログイン画面へ戻す
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
