-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedBy" TEXT,
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");
