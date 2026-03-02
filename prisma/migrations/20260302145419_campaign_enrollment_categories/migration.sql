-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('upcoming', 'active', 'completed');

-- AlterTable: Add categories to User
ALTER TABLE "User" ADD COLUMN "categories" JSONB;

-- AlterTable: Add campaignId to WeeklySession
ALTER TABLE "WeeklySession" ADD COLUMN "campaignId" TEXT;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'upcoming',
    "durationWeeks" INTEGER NOT NULL,
    "sessionsPerCycle" INTEGER NOT NULL,
    "videosPerSession" INTEGER NOT NULL,
    "votingRoundDurationSecs" INTEGER NOT NULL DEFAULT 30,
    "tasksPerWeekPerCreator" INTEGER NOT NULL,
    "submissionDeadlineHours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_cycleNumber_key" ON "Campaign"("cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignEnrollment_userId_campaignId_key" ON "CampaignEnrollment"("userId", "campaignId");

-- AddForeignKey
ALTER TABLE "WeeklySession" ADD CONSTRAINT "WeeklySession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEnrollment" ADD CONSTRAINT "CampaignEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
