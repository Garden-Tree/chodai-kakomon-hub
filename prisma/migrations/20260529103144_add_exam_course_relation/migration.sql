-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- AlterTable
ALTER TABLE "Exam" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- AlterTable
ALTER TABLE "Faculty" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- AlterTable
ALTER TABLE "Subject" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- CreateTable
CREATE TABLE "_CourseToExam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CourseToExam_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CourseToExam_B_index" ON "_CourseToExam"("B");

-- AddForeignKey
ALTER TABLE "_CourseToExam" ADD CONSTRAINT "_CourseToExam_A_fkey" FOREIGN KEY ("A") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseToExam" ADD CONSTRAINT "_CourseToExam_B_fkey" FOREIGN KEY ("B") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
