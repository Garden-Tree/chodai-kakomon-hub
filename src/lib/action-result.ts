import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';

// Server Action の結果型
// 本番環境では Server Action で throw したエラーのメッセージはクライアントに届かない（digest のみ）ため、
// ユーザーに見せたい失敗は例外ではなくこの型で返す。
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

export const UNEXPECTED_ERROR_MESSAGE = '予期せぬエラーが発生しました。時間をおいて再度お試しください。';

export function ok(): { ok: true; data: undefined };
export function ok<T>(data: T): { ok: true; data: T };
export function ok<T>(data?: T) {
  return { ok: true as const, data };
}

export function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// 想定内の失敗（認証・権限・入力不正など）を表す例外
// ネストしたヘルパー関数から throw すると、runAction がメッセージをそのまま fail() に変換する
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

// Server Action の本体を実行し、例外を ActionResult に変換する
// - ActionError: メッセージをそのままユーザーに返す
// - Next.js 内部のエラー（redirect / notFound など）: 再 throw して Next.js に処理させる
// - それ以外: ログを出力し、汎用メッセージを返す
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);

    if (err instanceof ActionError) {
      return fail(err.message);
    }

    console.error('Server Action failed:', err);
    return fail(UNEXPECTED_ERROR_MESSAGE);
  }
}

// Zod スキーマで入力を検証する。失敗した場合は最初の問題を読みやすい日本語にして ActionError を投げる
// labels を渡すと、エラーメッセージ中の項目名（例: instructor）を日本語の表示名に置き換える
export function parseInput<S extends z.ZodType>(
  schema: S,
  data: unknown,
  labels: Record<string, string> = {},
): z.output<S> {
  const result = schema.safeParse(data, { error: z.locales.ja().localeError });

  if (!result.success) {
    const issue = result.error.issues[0];
    const key = issue?.path.map(String).join('.') ?? '';
    const label = labels[key] ?? key;
    const message = issue?.message ?? '入力内容が正しくありません。';
    throw new ActionError(label ? `${label}: ${message}` : message);
  }

  return result.data;
}
