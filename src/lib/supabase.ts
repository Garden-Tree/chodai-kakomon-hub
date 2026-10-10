import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// バックエンド専用（API Routes / Server Actions等）のSupabaseクライアント
// セキュアなバックエンド処理（RLSバイパス、Signed URL発行等）のためサービスロールキーを使用する
// import 時に例外が発生しないよう、初回利用時に遅延生成する
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('環境変数 NEXT_PUBLIC_SUPABASE_URL が設定されていません。');
  }
  if (!supabaseServiceKey) {
    throw new Error('環境変数 SUPABASE_SERVICE_ROLE_KEY が設定されていません。Supabaseのサービスロールキーを .env に設定してください。');
  }

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });

  return adminClient;
}
