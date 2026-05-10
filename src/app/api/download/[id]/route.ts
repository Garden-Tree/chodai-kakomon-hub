import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. パスワードの確認（MiddlewareでもブロックされるがAPI側でも念のため検証）
    const expectedPassword = process.env.SITE_COMMON_PASSWORD || 'your_common_password_here';
    const cookieStore = await cookies();
    const providedPassword = cookieStore.get('site_common_password')?.value;

    if (providedPassword !== expectedPassword) {
      return new NextResponse('Unauthorized: 簡易パスワードが認証されていません。', { status: 401 });
    }

    // 2. 教科および過去問データの取得
    const { id } = await params;
    const exam = await prisma.exam.findUnique({
      where: { id }
    });

    if (!exam) {
      return new NextResponse('Exam not found', { status: 404 });
    }

    // 3. Supabase Storage から Signed URL を生成 (期限: 60秒)
    // RLSが設定されているBucketであっても、Admin Keyを使用するためバイパス可能
    const isPreview = request.nextUrl.searchParams.get('preview') === 'true';

    const { data, error } = await supabaseAdmin
      .storage
      .from('exams')
      .createSignedUrl(exam.fileUrl, 60, {
        // プレビューモードならdownloadオプションを無効化、そうでなければファイル名を指定
        download: isPreview ? false : (exam.fileName || true)
      });

    if (error || !data?.signedUrl) {
      console.error('Failed to generate signed url:', error);
      return new NextResponse('Failed to generate download link', { status: 500 });
    }

    // 4. 生成した署名付きURLへリダイレクトしてダウンロード開始
    return NextResponse.redirect(data.signedUrl);

  } catch (err) {
    console.error('Download API error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
