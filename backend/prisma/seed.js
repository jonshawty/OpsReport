/**
 * Seed - cria usuário admin inicial e alguns chamados de exemplo para demo.
 * Idempotente: pode ser executado várias vezes sem duplicar.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { parseRawText } = require('../src/parsers');

const prisma = new PrismaClient();

const SAMPLE_TEXT = `30/03 - Alert
#520992: PRD | MOVEL | MSE brux1044 - Realizado o restart da aplicação. Normalizado.

30/03 - Alert
#520993: PRD | FIXO | BPEL brux1608 - Sem atuação. Normalizado.

Alert
#580731: PRD | MOVEL | MSE
❗ Priority
P1
✅ Status
Open
🧯 Responders
CLBR-TI-OPS-PROD-WEB
🏷️ Tags
Splunk ITSI, Automatic
Description
Entidades Raiz:
* CLMSELX7352
Informações dos Alertas:
* LOW DISK SPACE
URLs Ativas:
* https://splunk.example.com/itsi/alert/580731

Alert
#580800: PRD | MOVEL | OSB
❗ Priority
P2
✅ Status
Open
🧯 Responders
CLBR-TI-OPS-PROD-INTEGRACAO
🏷️ Tags
Splunk ITSI
Description
Entidades Raiz:
* CLNETSMSLX6445
Informações dos Alertas:
* HIGH CPU USAGE - Em monitoramento`;

async function main() {
  const email = process.env.SEED_USER_EMAIL || 'admin@opsreport.local';
  const password = process.env.SEED_USER_PASSWORD || 'admin123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        password: hash,
        name: 'Administrator',
        role: 'admin',
      },
    });
    console.log(`[seed] Usuário admin criado: ${email} / ${password}`);
  } else {
    console.log(`[seed] Usuário admin já existe: ${email}`);
  }

  // Só semear chamados se não houver nenhum
  const ticketCount = await prisma.ticket.count();
  if (ticketCount === 0) {
    const { tickets } = parseRawText(SAMPLE_TEXT);
    const importRecord = await prisma.import.create({
      data: {
        source: 'seed',
        fileName: 'seed-sample.txt',
        rawSize: SAMPLE_TEXT.length,
        ticketCount: tickets.length,
        parseErrors: 0,
        notes: 'Exemplos iniciais gerados pelo seed',
      },
    });

    for (const t of tickets) {
      await prisma.ticket.create({
        data: {
          ticketId: t.ticketId,
          date: t.date,
          rawDate: t.rawDate,
          environment: t.environment,
          segment: t.segment,
          system: t.system,
          hostname: t.hostname,
          technology: t.technology,
          operatingSystem: t.operatingSystem,
          description: t.description,
          status: t.status,
          priority: t.priority,
          responders: t.responders,
          tags: t.tags,
          urls: t.urls,
          solverGroup: t.solverGroup,
          isRestart: t.isRestart,
          rawText: t.rawText,
          importId: importRecord.id,
        },
      });
    }
    console.log(`[seed] ${tickets.length} chamados de exemplo criados.`);
  } else {
    console.log(`[seed] Já existem ${ticketCount} chamados, pulando seed de exemplos.`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('[seed] Erro:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
