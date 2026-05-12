const ExcelJS = require('exceljs');
const Papa = require('papaparse');

const COLUMNS = [
  { header: 'Data', key: 'date', width: 14 },
  { header: 'ID Chamado', key: 'ticketId', width: 14 },
  { header: 'Ambiente', key: 'environment', width: 12 },
  { header: 'Segmento', key: 'segment', width: 14 },
  { header: 'Sistema', key: 'system', width: 12 },
  { header: 'Tecnologia', key: 'technology', width: 20 },
  { header: 'Hostname', key: 'hostname', width: 18 },
  { header: 'Sistema Operacional', key: 'operatingSystem', width: 18 },
  { header: 'Prioridade', key: 'priority', width: 10 },
  { header: 'Status', key: 'status', width: 18 },
  { header: 'Grupo Solucionador', key: 'solverGroup', width: 22 },
  { header: 'Responders', key: 'responders', width: 30 },
  { header: 'Tags', key: 'tags', width: 24 },
  { header: 'Restart', key: 'isRestart', width: 8 },
  { header: 'Analista Responsável', key: 'analyst', width: 24 },
  { header: 'Descrição', key: 'description', width: 60 },
  { header: 'URLs', key: 'urls', width: 50 },
];

function formatRow(t) {
  return {
    date: t.date ? new Date(t.date).toISOString().slice(0, 10) : (t.rawDate || ''),
    ticketId: t.ticketId || '',
    environment: t.environment || '',
    segment: t.segment || '',
    system: t.system || '',
    technology: t.technology || '',
    hostname: t.hostname || '',
    operatingSystem: t.operatingSystem || 'Linux/Unix',
    priority: t.priority || '',
    status: t.status || '',
    solverGroup: t.solverGroup || '',
    responders: t.responders || '',
    tags: t.tags || '',
    isRestart: t.isRestart ? 'Sim' : 'Não',
    analyst: t.analyst || '',
    description: t.description || '',
    urls: t.urls || '',
  };
}

async function exportXlsx(tickets) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OpsReport';
  wb.created = new Date();

  const ws = wb.addWorksheet('Chamados', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = COLUMNS;

  // Estilo do header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF111827' }, // gray-900
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 22;

  tickets.forEach((t) => ws.addRow(formatRow(t)));

  // Autofilter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length },
  };

  // Zebra stripes
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      });
    }
    row.alignment = { vertical: 'top', wrapText: false };
  });

  return wb.xlsx.writeBuffer();
}

function exportCsv(tickets) {
  const rows = tickets.map(formatRow);
  const csv = Papa.unparse({
    fields: COLUMNS.map((c) => c.header),
    data: rows.map((r) => COLUMNS.map((c) => r[c.key])),
  });
  return Buffer.from(csv, 'utf8');
}

module.exports = { exportXlsx, exportCsv, COLUMNS };
