import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabase';

// Supabase 無料プランは一定期間アクセスがないとプロジェクトが自動停止するため、
// Vercel Cron（vercel.json）から1日1回呼び出して DB と Storage API に軽いアクセスを発生させる。
//
// 環境変数 CRON_SECRET を設定すると、Vercel Cron は `Authorization: Bearer <CRON_SECRET>` を付けて呼び出す。
// 設定されている場合はこのヘッダーを必須とし、第三者からの呼び出しを拒否する。
// 未設定の場合も動作はする（実行するのは SELECT 1 とバケット情報の取得のみで、データは返さない）。
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    const { error } = await getSupabaseAdmin().storage.getBucket('exams');
    if (error) {
      console.error('[keepalive] storage check failed:', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    console.error('[keepalive] database check failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
