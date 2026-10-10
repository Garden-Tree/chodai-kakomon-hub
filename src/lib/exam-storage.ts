import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabase';

export const STORAGE_BUCKET = 'exams';

// Supabase Storage から過去問ファイルを削除する
// 同じファイルを参照する過去問が残っている場合は削除しない。
// DB 削除は完了している前提のため、失敗してもエラーは投げずログのみ出力する。
export async function removeExamFileIfUnreferenced(fileUrl: string) {
  try {
    const stillReferenced = await prisma.exam.findFirst({
      where: { fileUrl },
      select: { id: true },
    });

    if (stillReferenced) {
      console.warn('Storage file is still referenced by another exam, skip removal:', fileUrl);
      return;
    }

    const { data: removed, error: storageError } = await getSupabaseAdmin()
      .storage
      .from(STORAGE_BUCKET)
      .remove([fileUrl]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
    } else if (!removed || removed.length === 0) {
      console.warn('No file was removed from storage (already missing?):', fileUrl);
    }
  } catch (err) {
    console.error('Failed to delete file from storage:', err);
  }
}
