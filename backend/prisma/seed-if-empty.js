// File: backend/prisma/seed-if-empty.js
// Safe seed for a hosted database. Unlike seed.js, it NEVER deletes anything:
// it adds the sample products only when the Product table is completely empty.
// So it can run on every start of the hosted API without wiping orders.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { sampleProducts } from './sample-products.js';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.product.count();
  if (count > 0) {
    console.log(`Seed skipped: ${count} product(s) already exist. Nothing was changed.`);
    return;
  }
  await prisma.product.createMany({ data: sampleProducts });
  console.log(`Database was empty. Added ${sampleProducts.length} sample products.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
