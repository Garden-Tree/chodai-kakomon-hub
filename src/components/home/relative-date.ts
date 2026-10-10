// 日本時間（Asia/Tokyo）の暦日を基準に「3日前」のような相対表記を作る（サーバー側で使用）
const jstDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const DAY_MS = 24 * 60 * 60 * 1000;

// 日本時間での暦日を、日単位の通し番号に変換する
function toJstDayNumber(date: Date): number {
  const parts = jstDateParts.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day')) / DAY_MS;
}

export function formatRelativeDate(date: Date, now: Date = new Date()): string {
  const days = toJstDayNumber(now) - toJstDayNumber(date);

  if (days <= 0) return '今日';
  if (days === 1) return '昨日';
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}
