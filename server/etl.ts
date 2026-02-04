import * as XLSX from 'xlsx';

/**
 * ETL Pipeline for processing scheduling spreadsheets
 */

export interface RawAtividade {
  Nome?: string;
  'Tipo de Atividade'?: string;
  Descrição?: string;
  'Sub-Atividade'?: string;
  Cliente?: string;
  Canal?: string;
  Data?: string;
  Início?: string;
  Fim?: string;
  'WO#'?: string;
  'Tipo de Produção'?: string;
  'Produto (WO/Quick Hold)'?: string;
  'Evento/Programa'?: string;
  Função?: string;
  Local?: string;
  Cidade?: string;
  UF?: string;
  'Status Aprov.'?: string;
}

export interface RawEvento {
  Data?: string;
  Inicio?: string;
  Fim?: string;
  'WO#'?: string;
  'Tipo de Evento'?: string;
  Produto?: string;
  Canal?: string;
  'Evento/Programa'?: string;
  'Tipo de Produção'?: string;
  Local?: string;
  Cidade?: string;
  UF?: string;
  Função?: string;
  'Nome do Recurso'?: string;
}

export interface NormalizedAtividade {
  nome: string;
  tipoAtividade: string;
  descricao: string | null;
  subAtividade: string | null;
  cliente: string | null;
  canal: string | null;
  data: Date;
  inicio: string;
  fim: string;
  wo: string | null;
  tipoProducao: string | null;
  produto: string | null;
  eventoPrograma: string | null;
  funcao: string | null;
  local: string | null;
  cidade: string | null;
  uf: string | null;
  status: string | null;
}

export interface NormalizedEvento {
  data: Date;
  inicio: string;
  fim: string;
  wo: string;
  tipoEvento: string | null;
  produto: string | null;
  canal: string | null;
  eventoPrograma: string | null;
  tipoProducao: string | null;
  local: string | null;
  cidade: string | null;
  uf: string | null;
  funcao: string | null;
  nomeRecurso: string | null;
}

export interface ProcessedEscala {
  pessoa: string;
  funcao: string | null;
  tipoItem: string;
  descricaoItem: string | null;
  status: string | null;
  canal: string | null;
  cliente: string | null;
  eventoPrograma: string | null;
  wo: string | null;
  data: Date;
  inicioDt: Date;
  fimDt: Date;
  duracaoHoras: number;
  cidade: string | null;
  uf: string | null;
  local: string | null;
  ehFolga: boolean;
  ehViagem: boolean;
  ano: number;
  mes: number;
  semanaIso: number;
  diaSemana: string;
}

/**
 * Parse Excel file from buffer
 */
export function parseExcelFile(buffer: Buffer, sheetName?: string): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName || workbook.SheetNames[0]}`);
  }
  return XLSX.utils.sheet_to_json(sheet);
}

/**
 * Normalize column names: lowercase, remove accents, replace spaces with underscores
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Parse Brazilian date format (DD/MM/YYYY) to Date object
 */
function parseBrazilianDate(dateStr: string | Date | undefined): Date | null {
  if (!dateStr) return null;
  
  // If already a Date object
  if (dateStr instanceof Date) return dateStr;
  
  // Try parsing DD/MM/YYYY
  const parts = String(dateStr).split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Try parsing as ISO string
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  return null;
}

/**
 * Parse time string (HH:MM) to Date object on a given date
 */
function parseTime(dateBase: Date, timeStr: string | undefined): Date | null {
  if (!timeStr || !dateBase) return null;
  
  const parts = String(timeStr).split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    
    if (!isNaN(hours) && !isNaN(minutes)) {
      const result = new Date(dateBase);
      result.setHours(hours, minutes, 0, 0);
      return result;
    }
  }
  
  return null;
}

/**
 * Calculate duration in hours between two dates, handling day overflow
 */
function calculateDuration(inicio: Date, fim: Date): number {
  let duration = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60);
  
  // If negative, assume it crosses midnight
  if (duration < 0) {
    duration += 24;
  }
  
  return Math.max(0, duration);
}

/**
 * Get ISO week number
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Get day of week name in Portuguese
 */
function getDayOfWeekName(date: Date): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[date.getDay()];
}

/**
 * Process atividades (2468 spreadsheet)
 */
export function processAtividades(rawData: RawAtividade[]): ProcessedEscala[] {
  const processed: ProcessedEscala[] = [];
  
  for (const row of rawData) {
    try {
      const nome = row.Nome?.trim();
      const tipoAtividade = row['Tipo de Atividade']?.trim();
      const data = parseBrazilianDate(row.Data);
      const inicioStr = row.Início?.trim();
      const fimStr = row.Fim?.trim();
      
      // Skip rows with missing critical data
      if (!nome || !tipoAtividade || !data || !inicioStr || !fimStr) {
        continue;
      }
      
      let inicioDt = parseTime(data, inicioStr);
      let fimDt = parseTime(data, fimStr);
      
      if (!inicioDt || !fimDt) {
        continue;
      }
      
      // Handle day overflow (fim < inicio means it crosses midnight)
      if (fimDt < inicioDt) {
        fimDt = new Date(fimDt.getTime() + 24 * 60 * 60 * 1000);
      }
      
      const duracaoHoras = calculateDuration(inicioDt, fimDt);
      
      // Determine if it's time off (folga)
      const ehFolga = tipoAtividade.toLowerCase().includes('other time off') ||
                      tipoAtividade.toLowerCase().includes('folga') ||
                      tipoAtividade.toLowerCase().includes('férias') ||
                      tipoAtividade.toLowerCase().includes('vacation');
      
      // If it's time off, treat as full day block
      if (ehFolga) {
        inicioDt = new Date(data);
        inicioDt.setHours(0, 0, 0, 0);
        fimDt = new Date(data);
        fimDt.setDate(fimDt.getDate() + 1);
        fimDt.setHours(0, 0, 0, 0);
      }
      
      // Determine if it's travel
      const ehViagem = tipoAtividade.toLowerCase().includes('quick hold') &&
                       (row['Sub-Atividade']?.toLowerCase().includes('viagem') || false);
      
      processed.push({
        pessoa: nome,
        funcao: row.Função?.trim() || null,
        tipoItem: tipoAtividade,
        descricaoItem: row['Sub-Atividade']?.trim() || row.Descrição?.trim() || null,
        status: row['Status Aprov.']?.trim() || null,
        canal: row.Canal?.trim() || null,
        cliente: row.Cliente?.trim() || null,
        eventoPrograma: row['Evento/Programa']?.trim() || null,
        wo: row['WO#']?.trim() || null,
        data,
        inicioDt,
        fimDt,
        duracaoHoras,
        cidade: row.Cidade?.trim() || null,
        uf: row.UF?.trim() || null,
        local: row.Local?.trim() || null,
        ehFolga,
        ehViagem,
        ano: data.getFullYear(),
        mes: data.getMonth() + 1,
        semanaIso: getISOWeek(data),
        diaSemana: getDayOfWeekName(data),
      });
    } catch (error) {
      // Skip problematic rows
      console.warn('Error processing atividade row:', error);
      continue;
    }
  }
  
  return processed;
}

/**
 * Process eventos (2020 spreadsheet) - aggregate by WO + date
 */
export function processEventos(rawData: RawEvento[]): Map<string, NormalizedEvento> {
  const eventosMap = new Map<string, NormalizedEvento>();
  
  for (const row of rawData) {
    try {
      const wo = row['WO#']?.trim();
      const data = parseBrazilianDate(row.Data);
      
      if (!wo || !data) {
        continue;
      }
      
      const key = `${wo}|${data.toISOString().split('T')[0]}`;
      
      // Only keep first occurrence (to avoid duplication)
      if (!eventosMap.has(key)) {
        eventosMap.set(key, {
          data,
          inicio: row.Inicio?.trim() || '',
          fim: row.Fim?.trim() || '',
          wo,
          tipoEvento: row['Tipo de Evento']?.trim() || null,
          produto: row.Produto?.trim() || null,
          canal: row.Canal?.trim() || null,
          eventoPrograma: row['Evento/Programa']?.trim() || null,
          tipoProducao: row['Tipo de Produção']?.trim() || null,
          local: row.Local?.trim() || null,
          cidade: row.Cidade?.trim() || null,
          uf: row.UF?.trim() || null,
          funcao: row.Função?.trim() || null,
          nomeRecurso: row['Nome do Recurso']?.trim() || null,
        });
      }
    } catch (error) {
      console.warn('Error processing evento row:', error);
      continue;
    }
  }
  
  return eventosMap;
}

/**
 * Merge escalas with eventos data
 */
export function mergeEscalasWithEventos(
  escalas: ProcessedEscala[],
  eventos: Map<string, NormalizedEvento>
): ProcessedEscala[] {
  return escalas.map(escala => {
    if (escala.wo && escala.data) {
      const key = `${escala.wo}|${escala.data.toISOString().split('T')[0]}`;
      const evento = eventos.get(key);
      
      if (evento) {
        // Enrich escala with evento data if missing
        return {
          ...escala,
          tipoItem: escala.tipoItem || evento.tipoEvento || escala.tipoItem,
          canal: escala.canal || evento.canal,
          eventoPrograma: escala.eventoPrograma || evento.eventoPrograma,
          cidade: escala.cidade || evento.cidade,
          uf: escala.uf || evento.uf,
          local: escala.local || evento.local,
        };
      }
    }
    return escala;
  });
}
