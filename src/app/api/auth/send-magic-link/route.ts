import { NextResponse } from 'next/server';
import { isUniversityEmail } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    // *.ac.jp の学内メールアドレスかをチェック（判定ロジックは @/lib/auth に集約）
    if (!email || typeof email !== 'string' || !isUniversityEmail(email)) {
      return NextResponse.json(
        { error: '大学のメールアドレス (*.ac.jp) を使用してください。個人のアドレスは許可されていません。' },
        { status: 400 }
      );
    }

    // メールアドレスの検証のみ行う
    // signInWithOtp はクライアント側（ブラウザ）で呼び出すことで
    // PKCE の code verifier がブラウザに正しく保存されるようにする
    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error('Validate email err:', err);
    return NextResponse.json({ error: 'サーバー内部エラーが発生しました。' }, { status: 500 });
  }
}
