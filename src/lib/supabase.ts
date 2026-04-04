import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// セキュアなバックエンド処理（RLSバイパス、Signed URL発行等）のためのサービスロールキー
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// バックエンド専用（API Routes / Server Actions等）のSupabaseクライアント
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});
