import { NextResponse } from 'next/server';

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

    // メールアドレスの検証のみ行う
    // signInWithOtp はクライアント側（ブラウザ）で呼び出すことで
    // PKCE の code verifier がブラウザに正しく保存されるようにする
    return NextResponse.json({ valid: true });
  } catch (err) {
    console.error('Validate email err:', err);
    return NextResponse.json({ error: 'サーバー内部エラーが発生しました。' }, { status: 500 });
  }
}
