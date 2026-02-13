/**
 * Grades analysis module - calculates narrator coverage sufficiency
 */

export interface GradeEvento {
  wo: string;
  data: Date;
  tipoEvento: string | null;
  canal: string | null;
  cidade: string | null;
  funcaoRequerida: string; // e.g., "Narrador"
}

export interface ExcecaoProfissional {
  pessoa: string;
  tipo: string; // licenca_maternidade, licenca_medica, etc
  dataInicio: Date;
  dataFim: Date;
}

export interface FolgaInfo {
  pessoa: string;
  data: Date;
  tipoFolga: string;
}

export interface CoberturaAnalise {
  data: Date;
  totalEventos: number;
  eventosComCobertura: number;
  eventosSemCobertura: number;
  profissionaisDisponiveis: number;
  profissionaisEmFolga: number;
  profissionaisEmExcecao: number;
  eventosSemCoberturaDetalhes: Array<{
    wo: string;
    tipoEvento: string | null;
    canal: string | null;
  }>;
}

export interface AnaliseGradeResult {
  funcao: string;
  totalEventos: number;
  eventosSemCobertura: number;
  eventosComCobertura: number;
  totalProfissionais: number;
  profissionaisDisponiveis: number;
  profissionaisEmFolga: number;
  profissionaisEmExcecao: number;
  resultado: "suficiente" | "insuficiente" | "critico";
  recomendacoes: string[];
  detalhes: CoberturaAnalise[];
}

/**
 * Parse grade Excel file
 */
export function parseGradeExcel(buffer: Buffer): GradeEvento[] {
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet);

  const eventos: GradeEvento[] = [];

  for (const row of rawData) {
    const wo = row['WO#'] || row['WO'] || row['wo'];
    const dataStr = row['Data'] || row['data'];
    const tipoEvento = row['Tipo de Evento'] || row['Tipo'] || row['tipo'];
    const canal = row['Canal'] || row['canal'];
    const cidade = row['Cidade'] || row['cidade'];
    const funcao = row['Função'] || row['Funcao'] || row['funcao'] || 'Narrador';

    if (!wo || !dataStr) continue;

    // Parse date (DD/MM/YYYY)
    let data: Date;
    if (typeof dataStr === 'string') {
      const [day, month, year] = dataStr.split('/');
      data = new Date(Number(year), Number(month) - 1, Number(day));
    } else if (typeof dataStr === 'number') {
      // Excel serial date
      data = new Date((dataStr - 25569) * 86400 * 1000);
    } else {
      continue;
    }

    eventos.push({
      wo: String(wo),
      data,
      tipoEvento: tipoEvento ? String(tipoEvento) : null,
      canal: canal ? String(canal) : null,
      cidade: cidade ? String(cidade) : null,
      funcaoRequerida: String(funcao),
    });
  }

  return eventos;
}

/**
 * Calculate coverage sufficiency for a specific function
 */
export function calcularSuficienciaCobertura(
  eventos: GradeEvento[],
  funcao: string,
  profissionais: string[],
  folgas: FolgaInfo[],
  excecoes: ExcecaoProfissional[]
): AnaliseGradeResult {
  // Filter events for this function
  const eventosFunc = eventos.filter(e => e.funcaoRequerida === funcao);

  // Group events by date
  const eventosPorData = new Map<string, GradeEvento[]>();
  for (const evento of eventosFunc) {
    const dateKey = evento.data.toISOString().split('T')[0];
    if (!eventosPorData.has(dateKey)) {
      eventosPorData.set(dateKey, []);
    }
    eventosPorData.get(dateKey)!.push(evento);
  }

  // Group folgas by person and date
  const folgasPorPessoaData = new Map<string, Set<string>>();
  for (const folga of folgas) {
    const dateKey = folga.data.toISOString().split('T')[0];
    const key = `${folga.pessoa}|${dateKey}`;
    if (!folgasPorPessoaData.has(folga.pessoa)) {
      folgasPorPessoaData.set(folga.pessoa, new Set());
    }
    folgasPorPessoaData.get(folga.pessoa)!.add(dateKey);
  }

  // Build exception map
  const excecoesMap = new Map<string, ExcecaoProfissional[]>();
  for (const exc of excecoes) {
    if (!excecoesMap.has(exc.pessoa)) {
      excecoesMap.set(exc.pessoa, []);
    }
    excecoesMap.get(exc.pessoa)!.push(exc);
  }

  const detalhes: CoberturaAnalise[] = [];
  let totalEventosSemCobertura = 0;
  let totalEventosComCobertura = 0;

  // Analyze coverage for each date
  for (const [dateKey, eventosNaData] of Array.from(eventosPorData.entries())) {
    const data = new Date(dateKey);
    
    // Count available professionals
    let profissionaisEmFolga = 0;
    let profissionaisEmExcecao = 0;
    let profissionaisDisponiveis = 0;

    for (const pessoa of profissionais) {
      // Check if in folga
      const folgaDatas = folgasPorPessoaData.get(pessoa);
      if (folgaDatas && folgaDatas.has(dateKey)) {
        profissionaisEmFolga++;
        continue;
      }

      // Check if in exception period
      const pessoaExcecoes = excecoesMap.get(pessoa) || [];
      let emExcecao = false;
      for (const exc of pessoaExcecoes) {
        if (data >= exc.dataInicio && data <= exc.dataFim) {
          emExcecao = true;
          break;
        }
      }

      if (emExcecao) {
        profissionaisEmExcecao++;
        continue;
      }

      profissionaisDisponiveis++;
    }

    // Check coverage
    const totalEventosNaData = eventosNaData.length;
    const eventosSemCoberturaDetalhes: Array<{ wo: string; tipoEvento: string | null; canal: string | null }> = [];

    if (profissionaisDisponiveis < totalEventosNaData) {
      // Not enough professionals
      const deficit = totalEventosNaData - profissionaisDisponiveis;
      totalEventosSemCobertura += deficit;
      totalEventosComCobertura += profissionaisDisponiveis;

      // Mark events without coverage
      for (let i = profissionaisDisponiveis; i < totalEventosNaData; i++) {
        eventosSemCoberturaDetalhes.push({
          wo: eventosNaData[i].wo,
          tipoEvento: eventosNaData[i].tipoEvento,
          canal: eventosNaData[i].canal,
        });
      }
    } else {
      totalEventosComCobertura += totalEventosNaData;
    }

    detalhes.push({
      data,
      totalEventos: totalEventosNaData,
      eventosComCobertura: Math.min(profissionaisDisponiveis, totalEventosNaData),
      eventosSemCobertura: Math.max(0, totalEventosNaData - profissionaisDisponiveis),
      profissionaisDisponiveis,
      profissionaisEmFolga,
      profissionaisEmExcecao,
      eventosSemCoberturaDetalhes,
    });
  }

  // Calculate result
  const taxaCobertura = eventosFunc.length > 0 ? (totalEventosComCobertura / eventosFunc.length) * 100 : 100;
  let resultado: "suficiente" | "insuficiente" | "critico";
  if (taxaCobertura >= 95) {
    resultado = "suficiente";
  } else if (taxaCobertura >= 80) {
    resultado = "insuficiente";
  } else {
    resultado = "critico";
  }

  // Generate recommendations
  const recomendacoes: string[] = [];
  if (totalEventosSemCobertura > 0) {
    recomendacoes.push(`Contratar ou realocar ${totalEventosSemCobertura} profissionais adicionais`);
  }
  const avgProfissionaisEmExcecao = Math.round(detalhes.reduce((sum, d) => sum + d.profissionaisEmExcecao, 0) / (detalhes.length || 1));
  if (avgProfissionaisEmExcecao > 0) {
    recomendacoes.push(`Considerar substituições temporárias para ${avgProfissionaisEmExcecao} profissionais em exceção`);
  }
  if (resultado === "critico") {
    recomendacoes.push("Situação crítica: revisar grade de eventos ou aumentar equipe urgentemente");
  }

  // Calculate total folgas and excecoes across all dates
  const totalProfissionaisEmFolga = detalhes.reduce((sum, d) => sum + d.profissionaisEmFolga, 0) / (detalhes.length || 1);
  const totalProfissionaisEmExcecao = detalhes.reduce((sum, d) => sum + d.profissionaisEmExcecao, 0) / (detalhes.length || 1);

  return {
    funcao,
    totalEventos: eventosFunc.length,
    eventosSemCobertura: totalEventosSemCobertura,
    eventosComCobertura: totalEventosComCobertura,
    totalProfissionais: profissionais.length,
    profissionaisDisponiveis: Math.round(profissionais.length - totalProfissionaisEmFolga - totalProfissionaisEmExcecao),
    profissionaisEmFolga: Math.round(totalProfissionaisEmFolga),
    profissionaisEmExcecao: Math.round(totalProfissionaisEmExcecao),
    resultado,
    recomendacoes,
    detalhes,
  };
}


/**
 * Simulation result comparing scenarios
 */
export interface SimulacaoResult {
  cenarioAtual: AnaliseGradeResult;
  cenarioSimulado: AnaliseGradeResult;
  pessoaRemovida: string;
  impacto: {
    eventosSemCoberturaAdicional: number;
    taxaCoberturaAtual: number;
    taxaCoberturaSimulada: number;
    diferencaTaxaCobertura: number;
    diasCriticos: Array<{
      data: Date;
      eventosNovos: number;
      profissionaisDisponiveis: number;
    }>;
  };
  recomendacoes: string[];
}

/**
 * Simulate removing a professional and recalculate coverage
 */
export function simularRemocaoProfissional(
  eventos: GradeEvento[],
  funcao: string,
  profissionais: string[],
  folgas: FolgaInfo[],
  excecoes: ExcecaoProfissional[],
  pessoaRemover: string
): SimulacaoResult {
  // Calculate current scenario
  const cenarioAtual = calcularSuficienciaCobertura(eventos, funcao, profissionais, folgas, excecoes);

  // Calculate simulated scenario (without the person)
  const profissionaisSimulados = profissionais.filter(p => p !== pessoaRemover);
  const cenarioSimulado = calcularSuficienciaCobertura(eventos, funcao, profissionaisSimulados, folgas, excecoes);

  // Calculate impact
  const eventosSemCoberturaAdicional = cenarioSimulado.eventosSemCobertura - cenarioAtual.eventosSemCobertura;
  const taxaCoberturaAtual = cenarioAtual.totalEventos > 0 
    ? (cenarioAtual.eventosComCobertura / cenarioAtual.totalEventos) * 100 
    : 100;
  const taxaCoberturaSimulada = cenarioSimulado.totalEventos > 0 
    ? (cenarioSimulado.eventosComCobertura / cenarioSimulado.totalEventos) * 100 
    : 100;
  const diferencaTaxaCobertura = taxaCoberturaSimulada - taxaCoberturaAtual;

  // Identify critical days (days that became critical after removal)
  const diasCriticos: Array<{ data: Date; eventosNovos: number; profissionaisDisponiveis: number }> = [];
  for (let i = 0; i < cenarioAtual.detalhes.length; i++) {
    const atualDetalhe = cenarioAtual.detalhes[i];
    const simuladoDetalhe = cenarioSimulado.detalhes[i];
    
    if (simuladoDetalhe.eventosSemCobertura > atualDetalhe.eventosSemCobertura) {
      diasCriticos.push({
        data: atualDetalhe.data,
        eventosNovos: simuladoDetalhe.eventosSemCobertura - atualDetalhe.eventosSemCobertura,
        profissionaisDisponiveis: simuladoDetalhe.profissionaisDisponiveis,
      });
    }
  }

  // Generate recommendations
  const recomendacoes: string[] = [];
  if (eventosSemCoberturaAdicional === 0) {
    recomendacoes.push(`✅ A remoção de ${pessoaRemover} não impacta a cobertura de eventos`);
    recomendacoes.push("Equipe tem capacidade suficiente para absorver a ausência");
  } else {
    recomendacoes.push(`⚠️ A remoção de ${pessoaRemover} deixaria ${eventosSemCoberturaAdicional} eventos adicionais sem cobertura`);
    recomendacoes.push(`Taxa de cobertura cairia de ${taxaCoberturaAtual.toFixed(1)}% para ${taxaCoberturaSimulada.toFixed(1)}%`);
    recomendacoes.push(`${diasCriticos.length} dias seriam afetados negativamente`);
    
    if (cenarioSimulado.resultado === "critico") {
      recomendacoes.push("🚨 CRÍTICO: Remoção causaria situação insustentável");
      recomendacoes.push("Necessário contratar substituto antes de remover esta pessoa");
    } else if (cenarioSimulado.resultado === "insuficiente") {
      recomendacoes.push("⚠️ Remoção causaria insuficiência de cobertura");
      recomendacoes.push("Considerar redistribuição de carga ou contratação temporária");
    }
  }

  return {
    cenarioAtual,
    cenarioSimulado,
    pessoaRemovida: pessoaRemover,
    impacto: {
      eventosSemCoberturaAdicional,
      taxaCoberturaAtual,
      taxaCoberturaSimulada,
      diferencaTaxaCobertura,
      diasCriticos,
    },
    recomendacoes,
  };
}
