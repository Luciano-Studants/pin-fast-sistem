-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('STARTED', 'DATA_IMPORTED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "data_migrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'STARTED',
    "expectedAttachments" INTEGER NOT NULL DEFAULT 0,
    "uploadedAttachments" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_migrations_userId_source_version_key"
ON "data_migrations"("userId", "source", "version");

-- CreateIndex
CREATE INDEX "data_migrations_userId_status_idx"
ON "data_migrations"("userId", "status");

-- AddForeignKey
ALTER TABLE "data_migrations"
ADD CONSTRAINT "data_migrations_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
