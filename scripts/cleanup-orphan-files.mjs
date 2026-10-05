// Supabase Storage の孤児ファイル（Exam レコードから参照されていないファイル）を一覧・削除する
// 使い方:
//   node --env-file=.env scripts/cleanup-orphan-files.mjs          # 一覧のみ（dry run）
//   node --env-file=.env scripts/cleanup-orphan-files.mjs --delete # 削除を実行
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BUCKET = 'exams';
const doDelete = process.argv.includes('--delete');

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const referenced = new Set((await prisma.exam.findMany({ select: { fileUrl: true } })).map((e) => e.fileUrl));
const { data: folders, error: folderErr } = await admin.storage.from(BUCKET).list('', { limit: 1000 });
if (folderErr) throw folderErr;

const orphans = [];
let total = 0;
for (const folder of folders) {
  if (folder.id) continue; // ルート直下のファイルは対象外（フォルダのみ）
  const { data: files, error } = await admin.storage.from(BUCKET).list(folder.name, { limit: 1000 });
  if (error) throw error;
  for (const f of files) {
    total++;
    const path = `${folder.name}/${f.name}`;
    if (!referenced.has(path)) orphans.push({ path, created: f.created_at?.slice(0, 10), kb: Math.round((f.metadata?.size ?? 0) / 1024) });
  }
}

console.log(`Exam レコード: ${referenced.size} 件 / Storage ファイル: ${total} 件 / 孤児: ${orphans.length} 件`);
for (const o of orphans) console.log(`  ${o.path}  (${o.created}, ${o.kb} KB)`);

if (doDelete && orphans.length > 0) {
  const { data, error } = await admin.storage.from(BUCKET).remove(orphans.map((o) => o.path));
  if (error) throw error;
  console.log(`削除完了: ${data.length} 件`);
} else if (orphans.length > 0) {
  console.log('--delete を付けると削除します。');
}
await prisma.$disconnect();
