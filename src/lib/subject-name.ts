// 科目名の表記ゆれを吸収するための正規化キーを返す（重複候補の検出・検索用）
// - NFKC 正規化（全角英数 → 半角、「Ⅰ」→「I」など）
// - 小文字化
// - 末尾の独立したローマ数字（I〜X）をアラビア数字に変換
// - 空白をすべて除去
// 例: 「線形代数学Ⅰ」「線形代数学 I」「線形代数学1」はすべて同じキーになる

const ROMAN_TO_DIGIT: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
};

// 直前が英字でない（= 単語の一部ではない）末尾のローマ数字だけを対象にする
const TRAILING_ROMAN = /(?<![a-z])(viii|vii|vi|iv|ix|iii|ii|i|v|x)$/;

export function normalizeSubjectName(name: string): string {
  const base = name.normalize('NFKC').toLowerCase().trim();
  const withDigit = base.replace(TRAILING_ROMAN, (roman) => ROMAN_TO_DIGIT[roman] ?? roman);
  return withDigit.replace(/\s+/g, '');
}
