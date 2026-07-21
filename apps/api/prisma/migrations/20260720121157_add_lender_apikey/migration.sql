-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('active', 'transferred', 'exited');

-- CreateEnum
CREATE TYPE "Commodity" AS ENUM ('MAIZE_WHITE', 'MAIZE_YELLOW', 'SESAME');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('Grade_A', 'Grade_B', 'Grade_C');

-- CreateTable
CREATE TABLE "farmers" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "stellarWallet" TEXT NOT NULL,
    "bvnVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "capacityTonnes" DOUBLE PRECISION NOT NULL,
    "custodianWallet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "commodity" "Commodity" NOT NULL,
    "grade" "Grade" NOT NULL,
    "bagCount" INTEGER NOT NULL,
    "weightPerBagKg" INTEGER NOT NULL,
    "totalWeightKg" INTEGER NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'active',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedByLenderId" TEXT,
    "loanReference" TEXT,
    "txHash" TEXT NOT NULL,
    "stellarExplorerLink" TEXT NOT NULL,
    "depositDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "farmerId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lenders" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "farmers_phone_key" ON "farmers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "farmers_stellarWallet_key" ON "farmers"("stellarWallet");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_custodianWallet_key" ON "warehouses"("custodianWallet");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_tokenId_key" ON "tokens"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_txHash_key" ON "tokens"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "lenders_contactEmail_key" ON "lenders"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
