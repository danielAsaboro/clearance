-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('creator', 'fan', 'admin');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'submitted', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'live', 'ended');

-- CreateEnum
CREATE TYPE "RoundVerdict" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "VoteDecision" AS ENUM ('approve', 'reject');

-- CreateEnum
CREATE TYPE "RewardTier" AS ENUM ('participation', 'base', 'gold');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "displayName" TEXT,
    "profilePhoto" TEXT,
    "tiktokUsername" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'fan',
    "debtSources" JSONB,
    "willingToDeclare" BOOLEAN,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "privyId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "taskNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "hashtag" TEXT NOT NULL DEFAULT '#theclearanceNG',
    "deadline" TIMESTAMP(3) NOT NULL,
    "tiktokUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "rejectionNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklySession" (
    "id" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "lateJoinCutoff" TIMESTAMP(3),
    "collectionAddress" TEXT,

    CONSTRAINT "WeeklySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "tiktokUrl" TEXT NOT NULL,
    "tiktokEmbedData" JSONB,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "adminVerdict" "RoundVerdict",

    CONSTRAINT "SessionRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "decision" "VoteDecision" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "correctVotes" INTEGER NOT NULL DEFAULT 0,
    "tier" "RewardTier",
    "rewardAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nftMinted" BOOLEAN NOT NULL DEFAULT false,
    "nftTokenId" TEXT,
    "nftRevealed" BOOLEAN NOT NULL DEFAULT false,
    "walletAddress" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lateJoin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySession_weekNumber_key" ON "WeeklySession"("weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRound_taskId_key" ON "SessionRound"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRound_sessionId_roundNumber_key" ON "SessionRound"("sessionId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_roundId_key" ON "Vote"("userId", "roundId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_userId_sessionId_key" ON "GameResult"("userId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRound" ADD CONSTRAINT "SessionRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WeeklySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRound" ADD CONSTRAINT "SessionRound_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "SessionRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WeeklySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
