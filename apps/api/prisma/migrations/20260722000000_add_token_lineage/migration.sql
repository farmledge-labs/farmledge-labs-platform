-- AlterTable
ALTER TABLE "tokens" ADD COLUMN "parentTokenId" TEXT;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_parentTokenId_fkey" FOREIGN KEY ("parentTokenId") REFERENCES "tokens"("tokenId") ON DELETE SET NULL ON UPDATE CASCADE;
