import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { sampleProducts } from './sample-products.js';
const prisma = new PrismaClient();

// Local development only: this DELETES all orders and products first.
// For a hosted database use seed-if-empty.js (npm run db:seed:if-empty) instead.
const products = sampleProducts;

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.product.createMany({ data: products });
  console.log(`Seeded ${products.length} ShopSmart products.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
