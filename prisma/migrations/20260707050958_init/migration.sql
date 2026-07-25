-- CreateTable
CREATE TABLE "products" (
    "id" VARCHAR(50) NOT NULL,
    "plu_code" VARCHAR(5) NOT NULL,
    "name" TEXT NOT NULL,
    "hsn_code" VARCHAR(10) NOT NULL,
    "current_stock" DECIMAL(10,3) NOT NULL,
    "min_threshold" DECIMAL(10,3) NOT NULL DEFAULT 5.000,
    "cost_price" DECIMAL(10,2) NOT NULL,
    "selling_price" DECIMAL(10,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" VARCHAR(50) NOT NULL,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_phone" VARCHAR(15),
    "customer_gstin" VARCHAR(15),
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total_cgst" DECIMAL(10,2) NOT NULL,
    "total_sgst" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "grand_total" DECIMAL(10,2) NOT NULL,
    "payment_mode" VARCHAR(20) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" SERIAL NOT NULL,
    "invoice_id" VARCHAR(50) NOT NULL,
    "product_id" VARCHAR(50) NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "cgst_amount" DECIMAL(10,2) NOT NULL,
    "sgst_amount" DECIMAL(10,2) NOT NULL,
    "row_total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" VARCHAR(15),
    "gstin" VARCHAR(15),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ledger" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "purchase_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "supplier_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_plu_code_key" ON "products"("plu_code");

-- CreateIndex
CREATE INDEX "products_id_idx" ON "products"("id");

-- CreateIndex
CREATE INDEX "products_plu_code_idx" ON "products"("plu_code");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
