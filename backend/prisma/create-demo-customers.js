// File: backend/prisma/create-demo-customers.js
// Creates (or resets) two FICTIONAL test customers used to show order ownership:
//   ana.demo@example.com  and  ben.demo@example.com
// It never deletes products or orders.
//
// Password:
//   - If DEMO_PASSWORD is set (10+ characters), both accounts use it.
//   - Otherwise a random password is made and printed ONCE. Write it down; it is not saved anywhere.
// Running it again resets both passwords and signs both customers out everywhere.
import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.js';

const prisma = new PrismaClient();
const customers = [
  { email: 'ana.demo@example.com', name: 'Ana Demo' },
  { email: 'ben.demo@example.com', name: 'Ben Demo' }
];

async function main() {
  const fromEnv = process.env.DEMO_PASSWORD;
  if (fromEnv && fromEnv.length < 10) throw new Error('DEMO_PASSWORD must be at least 10 characters.');
  const password = fromEnv || crypto.randomBytes(12).toString('base64url');

  for (const customer of customers) {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email: customer.email },
      update: { name: customer.name, passwordHash },
      create: { ...customer, passwordHash }
    });
    await prisma.session.deleteMany({ where: { userId: user.id } }); // old cookies stop working
  }

  console.log(`Demo customers ready: ${customers.map((c) => c.email).join(', ')}`);
  if (!fromEnv) console.log(`Shared demo password (shown once, not stored): ${password}`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
