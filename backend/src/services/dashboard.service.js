const prisma = require('../utils/prisma');

async function dashboardMetrics() {
  const [
    total,
    bySystem,
    byTechnology,
    byPriority,
    byStatus,
    restartCount,
    last30Days,
  ] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.groupBy({
      by: ['system'],
      _count: { _all: true },
      orderBy: { _count: { system: 'desc' } },
    }),
    prisma.ticket.groupBy({
      by: ['technology'],
      _count: { _all: true },
      orderBy: { _count: { technology: 'desc' } },
    }),
    prisma.ticket.groupBy({
      by: ['priority'],
      _count: { _all: true },
      orderBy: { priority: 'asc' },
    }),
    prisma.ticket.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.ticket.count({ where: { isRestart: true } }),
    prisma.ticket.findMany({
      where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { date: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Agrega "tickets por dia" para gráfico de tendência
  const byDate = {};
  for (const t of last30Days) {
    if (!t.date) continue;
    const key = t.date.toISOString().slice(0, 10);
    byDate[key] = (byDate[key] || 0) + 1;
  }
  const trend = Object.entries(byDate).map(([date, count]) => ({ date, count }));

  const format = (rows, key) =>
    rows
      .filter((r) => r[key] !== null && r[key] !== '')
      .map((r) => ({ label: r[key], count: r._count._all }));

  return {
    totals: {
      incidents: total,
      restarts: restartCount,
    },
    bySystem: format(bySystem, 'system'),
    byTechnology: format(byTechnology, 'technology'),
    byPriority: format(byPriority, 'priority'),
    byStatus: format(byStatus, 'status'),
    trend,
  };
}

module.exports = { dashboardMetrics };
