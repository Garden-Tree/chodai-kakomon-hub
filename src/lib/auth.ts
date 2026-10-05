import { createClient } from '@/lib/supabase/server';
import { ActionError } from '@/lib/action-result';

// *.ac.jp の学内メールアドレスかを判定する正規表現
// 末尾がアットマーク以降で ac.jp で終わることを確認（例: s123456@edu.nagasaki-u.ac.jp など）
const UNIVERSITY_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.)?ac\.jp$/;

export function isUniversityEmail(email: string): boolean {
  return UNIVERSITY_EMAIL_REGEX.test(email);
}

// ログイン中かつ大学のメールアドレス (*.ac.jp) のユーザーのみを返す
// 条件を満たさない場合は null
export async function getUniversityUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email || !isUniversityEmail(user.email)) {
    return null;
  }

  return { user, email: user.email };
}

// Server Action 等で大学ユーザーであることを必須とする
// 条件を満たさない場合は ActionError を投げる（runAction 内で fail() に変換される）
export async function requireUniversityUser() {
  const result = await getUniversityUser();

  if (!result) {
    throw new ActionError('認証されていません。大学のメールアドレスでログインしてください。');
  }

  return result;
}

// 環境変数 ADMIN_EMAILS（カンマ区切り）に含まれるメールアドレスかを判定する（大文字小文字は区別しない）
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(item => item !== '');

  return adminEmails.includes(email.trim().toLowerCase());
}

// 管理者として認証されているユーザーのみを返す
// 条件を満たさない場合は null
export async function getAdminUser() {
  const result = await getUniversityUser();

  if (!result || !isAdminEmail(result.email)) {
    return null;
  }

  return result;
}

// Server Action 等で管理者であることを必須とする
// 条件を満たさない場合は ActionError を投げる（runAction 内で fail() に変換される）
export async function requireAdminUser() {
  const result = await getAdminUser();

  if (!result) {
    throw new ActionError('管理者権限がありません。');
  }

  return result;
}
