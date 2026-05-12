-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT,
    "rawSize" INTEGER NOT NULL DEFAULT 0,
    "ticketCount" INTEGER NOT NULL DEFAULT 0,
    "parseErrors" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "date" TIMESTAMP(3),
    "rawDate" TEXT,
    "environment" TEXT,
    "segment" TEXT,
    "system" TEXT,
    "hostname" TEXT,
    "technology" TEXT,
    "operatingSystem" TEXT DEFAULT 'Linux/Unix',
    "description" TEXT,
    "status" TEXT,
    "priority" TEXT,
    "responders" TEXT,
    "tags" TEXT,
    "urls" TEXT,
    "solverGroup" TEXT,
    "isRestart" BOOLEAN NOT NULL DEFAULT false,
    "analyst" TEXT,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importId" TEXT,
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "imports_createdAt_idx" ON "imports"("createdAt");
CREATE INDEX "tickets_ticketId_idx" ON "tickets"("ticketId");
CREATE INDEX "tickets_hostname_idx" ON "tickets"("hostname");
CREATE INDEX "tickets_system_idx" ON "tickets"("system");
CREATE INDEX "tickets_date_idx" ON "tickets"("date");

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
