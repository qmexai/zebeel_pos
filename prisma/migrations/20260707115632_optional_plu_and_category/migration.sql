-- AlterTable
ALTER TABLE "products" ADD COLUMN     "category" VARCHAR(50) NOT NULL DEFAULT 'Others',
ALTER COLUMN "plu_code" DROP NOT NULL;
