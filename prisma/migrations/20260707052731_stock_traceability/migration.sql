-- CreateTable
CREATE TABLE "stock_history_logs" (
    "id" SERIAL NOT NULL,
    "product_id" VARCHAR(50) NOT NULL,
    "quantity_added" DECIMAL(10,3) NOT NULL,
    "previous_stock" DECIMAL(10,3) NOT NULL,
    "new_stock" DECIMAL(10,3) NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "reference_note" TEXT,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_history_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_history_logs_product_id_idx" ON "stock_history_logs"("product_id");

-- AddForeignKey
ALTER TABLE "stock_history_logs" ADD CONSTRAINT "stock_history_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
