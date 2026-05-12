const prisma = require('../utils/prisma');

async function listImports({ page = 1, pageSize = 25 } = {}) {
  const take = Math.min(parseInt(pageSize, 10) || 25, 100);
  const skip = ((parseInt(page, 10) || 1) - 1) * take;

  const [items, total] = await Promise.all([
    prisma.import.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        user: { select: { email: true, name: true } },
        _count: { select: { tickets: true } },
      },
    }),
    prisma.import.count(),
  ]);
  return { items, total, page: +page, pageSize: take };
}

async function getImportTickets(importId) {
  return prisma.ticket.findMany({
    where: { importId },
    orderBy: { createdAt: 'asc' },
  });
}

async function deleteImport(importId) {
  // Tickets têm onDelete: SetNull, mas vamos limpá-los junto
  await prisma.$transaction([
    prisma.ticket.deleteMany({ where: { importId } }),
    prisma.import.delete({ where: { id: importId } }),
  ]);
}

module.exports = { listImports, getImportTickets, deleteImport };
