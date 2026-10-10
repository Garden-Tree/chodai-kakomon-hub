// サイト閲覧用の学内共通簡易パスワードを取得する
// 未設定やプレースホルダーのままの場合は、誰でも推測できるパスワードで公開されてしまうため起動時ではなく利用時にエラーとする
const PLACEHOLDER_PASSWORD = 'your_common_password_here';

export function getSitePassword(): string {
  const password = process.env.SITE_COMMON_PASSWORD;

  if (!password || password === PLACEHOLDER_PASSWORD) {
    throw new Error(
      '環境変数 SITE_COMMON_PASSWORD が未設定、またはプレースホルダー値 (your_common_password_here) のままです。.env に推測されにくいパスワードを設定してください。'
    );
  }

  return password;
}
