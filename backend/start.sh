#!/bin/sh
set -e

echo "[startup] Garantindo coluna analyst (idempotente)..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const n = await prisma.$executeRawUnsafe(
      'DELETE FROM \"_prisma_migrations\" WHERE \"finished_at\" IS NULL OR \"rolled_back_at\" IS NOT NULL'
    );
    if (n > 0) console.log('[startup] Removidos', n, 'registro(s) de migration com problema');
  } catch(e) {}

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE \"tickets\" ADD COLUMN IF NOT EXISTS \"analyst\" TEXT');
    console.log('[startup] Coluna analyst OK');
  } catch(e) {}

  await prisma.$disconnect();
}
run().catch(() => {}).finally(() => process.exit(0));
"

echo "[startup] Sincronizando schema Prisma..."
npx prisma db push

echo "[startup] Rodando seed..."
node prisma/seed.js

echo "[startup] Iniciando servidor..."
exec node src/server.js