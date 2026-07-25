const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Zabeel POS PostgreSQL Database...');

  // Clear existing data (if any)
  await prisma.supplierLedger.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.product.deleteMany({});

  // Seed Products
  const products = [
    {
      id: '8901030752538',
      pluCode: '00101',
      name: 'Organic Red Apples 1kg',
      hsnCode: '08081000',
      currentStock: 120.450,
      minThreshold: 15.000,
      costPrice: 120.00,
      sellingPrice: 150.00,
      gstRate: 5.00,
      taxInclusive: true,
    },
    {
      id: '8901030752539',
      pluCode: '00102',
      name: 'Fresh Cavendish Bananas 1kg',
      hsnCode: '08039010',
      currentStock: 85.000,
      minThreshold: 10.000,
      costPrice: 40.00,
      sellingPrice: 60.00,
      gstRate: 5.00,
      taxInclusive: true,
    },
    {
      id: '8901030752540',
      pluCode: '00201',
      name: 'India Gate Basmati Rice 1kg',
      hsnCode: '10063020',
      currentStock: 250.000,
      minThreshold: 20.000,
      costPrice: 180.00,
      sellingPrice: 210.00,
      gstRate: 5.00,
      taxInclusive: true,
    },
    {
      id: '8901030752541',
      pluCode: '00301',
      name: 'Surf Excel Matic Liquid 1L',
      hsnCode: '34029011',
      currentStock: 45.000,
      minThreshold: 8.000,
      costPrice: 290.00,
      sellingPrice: 350.00,
      gstRate: 18.00,
      taxInclusive: true,
    },
    {
      id: '8901030752542',
      pluCode: '00401',
      name: 'Cadbury Dairy Milk Silk 150g',
      hsnCode: '18063100',
      currentStock: 4.500, // Low stock alert trigger
      minThreshold: 10.000,
      costPrice: 65.00,
      sellingPrice: 80.00,
      gstRate: 18.00,
      taxInclusive: true,
    },
    {
      id: '2200541002404', // Smart Scale Barcode starting with 22, PLU: 00541, Weight: 00240 = 240g = 0.24kg
      pluCode: '00541',
      name: 'Premium Green Seedless Grapes',
      hsnCode: '08061000',
      currentStock: 65.500,
      minThreshold: 12.000,
      costPrice: 180.00,
      sellingPrice: 240.00,
      gstRate: 5.00,
      taxInclusive: true,
    }
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }
  console.log(`Seeded ${products.length} products successfully.`);

  // Seed Suppliers and their Ledger Transactions
  const supplier1 = await prisma.supplier.create({
    data: {
      name: 'Zabeel Wholesalers Pvt Ltd',
      phone: '9876543210',
      gstin: '29ABCDE1234F1Z5',
    },
  });

  await prisma.supplierLedger.create({
    data: {
      supplierId: supplier1.id,
      description: 'Initial inventory shipment - Rice, Detergent, Chocolate',
      purchaseAmount: 50000.00,
      paidAmount: 40000.00, // ₹10,000 outstanding debt
    },
  });

  await prisma.supplierLedger.create({
    data: {
      supplierId: supplier1.id,
      description: 'Part payment for initial shipment',
      purchaseAmount: 0.00,
      paidAmount: 5000.00, // Now ₹5,000 outstanding debt
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: 'Indian Agro Farms & Distributors',
      phone: '8765432109',
      gstin: '29FGHIJ5678K2Z6',
    },
  });

  await prisma.supplierLedger.create({
    data: {
      supplierId: supplier2.id,
      description: 'Fresh Fruits consignment - Apples & Grapes',
      purchaseAmount: 12000.00,
      paidAmount: 12000.00, // ₹0 outstanding debt
    },
  });

  console.log('Seeded Suppliers and ledger transactions successfully.');
  console.log('Database Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
