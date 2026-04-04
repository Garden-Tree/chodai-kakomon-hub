import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    // *.ac.jp の学内メールアドレスかを正規表現でチェック
    // 末尾がアットマーク以降で ac.jp で終わることを確認（例: s123456@edu.nagasaki-u.ac.jp など）
    const emailRegex = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.)?ac\.jp$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: '大学のメールアドレス (*.ac.jp) を使用してください。個人のアドレスは許可されていません。' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/upload`,
      },
    });

    if (error) {
      console.error('Magic link sign-in error:', error);
      return NextResponse.json({ error: 'メール送信に失敗しました。時間をおいて再試行してください。' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Send magic link err:', err);
    return NextResponse.json({ error: 'サーバー内部エラーが発生しました。' }, { status: 500 });
  }
}
