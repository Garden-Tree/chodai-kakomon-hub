-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "comment" TEXT,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- AlterTable
ALTER TABLE "Faculty" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- AlterTable
ALTER TABLE "Subject" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
