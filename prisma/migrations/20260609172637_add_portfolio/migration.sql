-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "avgBuy" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT,
    "symbol" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_symbol_key" ON "Position"("userId", "symbol");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
