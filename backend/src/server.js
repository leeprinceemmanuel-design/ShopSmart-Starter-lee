import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const port = Number(process.env.PORT || 3000);
// HOST=127.0.0.1 on the EC2 server, so only Caddy (on the same machine) can reach Express.
// Left unset locally, Node listens on every network interface as before.
const host = process.env.HOST || undefined;
const server = createApp().listen(port, host, () => console.log(`ShopSmart API running at http://${host || 'localhost'}:${port}`));

async function shutdown(signal) {
  console.log(`\n${signal} received. Closing ShopSmart API.`);
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
