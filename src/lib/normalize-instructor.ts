// 担当教員名の表記ゆれ（全角・半角スペースの違いなど）を吸収するための正規化。
// NFKC で全角スペース（U+3000）も半角スペースに変換されるが、念のため空白類を明示的に1つの半角スペースへまとめる。
export function normalizeInstructor(name: string): string {
  return name.normalize('NFKC').replace(/[\s　]+/g, ' ').trim();
}
