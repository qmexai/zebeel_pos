-- AlterTable
ALTER TABLE "products" ADD COLUMN     "mrp" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "package_unit" VARCHAR(10),
ADD COLUMN     "package_weight" DECIMAL(10,3),
ADD COLUMN     "sack_kg" DECIMAL(10,3),
ADD COLUMN     "sack_rate" DECIMAL(10,2);
