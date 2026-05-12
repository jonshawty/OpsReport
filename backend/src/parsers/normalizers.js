/**
 * normalizers.js - Mapas de normalização semântica.
 *
 * Para adicionar novos mapeamentos basta editar os objetos abaixo.
 */

const TECHNOLOGY_MAP = {
  MSE: 'Weblogic',
  BPEL: 'SOA Suite',
  OSB: 'Oracle Service Bus',
  EDOC: 'Weblogic',
  SPG: 'Wildfly',
  WPP: 'Weblogic',
  COCKPIT: 'Weblogic',
};

const DEFAULT_OS = 'Linux/Unix';

function mapTechnology(system) {
  if (!system) return null;
  const key = String(system).toUpperCase().trim();
  return TECHNOLOGY_MAP[key] || null;
}

function normalizeStatus(text, keywords) {
  if (!text) return null;
  for (const { match, value } of keywords) {
    if (match.test(text)) return value;
  }
  return null;
}

function detectSolverGroup(text) {
  if (!text) return 'Prod-Web';
  // "prod integração" / "PROD.INTEGRACAO" / "prod-integracao" etc.
  const integracao = /(prod[\s\.\-_]integra[cç][aã]o|prod[-_\.]integracao)/i.test(text);
  return integracao ? 'Prod-Integracao' : 'Prod-Web';
}

function parseDateLoose(rawDate) {
  if (!rawDate) return null;

  // ISO yyyy-mm-dd
  let m = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    const date = new Date(Date.UTC(+y, +mo - 1, +d));
    return isNaN(date.getTime()) ? null : date;
  }

  // dd/mm/yyyy ou dd-mm-yyyy
  m = rawDate.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const date = new Date(Date.UTC(+y, +mo - 1, +d));
    return isNaN(date.getTime()) ? null : date;
  }

  // dd/mm (assume ano corrente)
  m = rawDate.match(/^(\d{2})\/(\d{2})$/);
  if (m) {
    const [, d, mo] = m;
    const year = new Date().getUTCFullYear();
    const date = new Date(Date.UTC(year, +mo - 1, +d));
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

module.exports = {
  TECHNOLOGY_MAP,
  DEFAULT_OS,
  mapTechnology,
  normalizeStatus,
  detectSolverGroup,
  parseDateLoose,
};
