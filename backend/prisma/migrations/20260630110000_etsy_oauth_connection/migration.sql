-- CreateTable
CREATE TABLE "EtsyConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "etsyUserId" TEXT,
    "shopId" TEXT,
    "shopName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtsyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtsyConnection_userId_key" ON "EtsyConnection"("userId");
