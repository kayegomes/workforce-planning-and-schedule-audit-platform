import type { ProcessedEscala } from './etl';

/**
 * Business rules for detecting conflicts, time-off violations, and travel risks
 */

export interface ConflictAlert {
  pessoa: string;
  data: Date;
  escalaId1: number;
  escalaId2: number;
  inicio1: Date;
  fim1: Date;
  inicio2: Date;
  fim2: Date;
  overlapMinutos: number;
  evento1: string | null;
  evento2: string | null;
  cidade1: string | null;
  cidade2: string | null;
}

export interface FolgaAlert {
  pessoa: string;
  data: Date;
  tipoFolga: string;
  escalaIdFolga: number;
  escalaIdConflitante: number;
  duracaoHoras: number;
  status: string | null;
  eventoPrograma: string | null;
}

export interface DeslocamentoAlert {
  pessoa: string;
  escalaIdPrev: number;
  escalaIdNext: number;
  dataPrev: Date;
  dataNext: Date;
  cidadePrev: string | null;
  cidadeNext: string | null;
  fimPrev: Date;
  inicioNext: Date;
  gapHoras: number;
  gapMinimo: number;
  status: string | null;
}

export interface QualidadeIssue {
  tipo: string;
  descricao: string;
  pessoa: string | null;
  data: Date | null;
  wo: string | null;
  dadosOriginais: string;
}

/**
 * Helper function to determine if an activity should be ignored for conflict/violation rules
 */
export function isIgnoredActivity(escala: ProcessedEscala): boolean {
  const description = (escala.eventoPrograma || escala.descricaoItem || escala.tipoItem || '').toLowerCase();
  
  // Ignore travel events
  if (description.includes('viagem')) return true;
  
  // Ignore personal commitments
  if (description.includes('compromisso pessoal')) return true;
  
  return false;
}

/**
 * Detect time overlap conflicts between two activities
 */
function hasTimeOverlap(
  inicio1: Date,
  fim1: Date,
  inicio2: Date,
  fim2: Date
): { overlap: boolean; minutes: number } {
  const overlapStart = new Date(Math.max(inicio1.getTime(), inicio2.getTime()));
  const overlapEnd = new Date(Math.min(fim1.getTime(), fim2.getTime()));
  
  if (overlapStart < overlapEnd) {
    const minutes = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));
    return { overlap: true, minutes };
  }
  
  return { overlap: false, minutes: 0 };
}

/**
 * Detect schedule conflicts (time overlaps for the same person)
 */
export function detectConflicts(
  escalas: Array<ProcessedEscala & { id: number }>
): ConflictAlert[] {
  const conflicts: ConflictAlert[] = [];
  
  // Group by person
  const byPerson = new Map<string, Array<ProcessedEscala & { id: number }>>();
  
  for (const escala of escalas) {
    // Prevent time-off from being considered a regular working conflict (handled by detectFolgaViolations)
    if (escala.ehFolga) continue;

    // Ignore 'Pc Oliveira' for overlap conflicts as he participates in multiple activities simultaneously
    if (escala.pessoa.toLowerCase().includes('pc oliveira')) continue;

    if (!byPerson.has(escala.pessoa)) {
      byPerson.set(escala.pessoa, []);
    }
    byPerson.get(escala.pessoa)!.push(escala);
  }
  
  // Check for overlaps within each person's schedule
  for (const [pessoa, activities] of Array.from(byPerson.entries())) {
    // Sort by start time
    activities.sort((a: ProcessedEscala & { id: number }, b: ProcessedEscala & { id: number }) => a.inicioDt.getTime() - b.inicioDt.getTime());
    
    for (let i = 0; i < activities.length; i++) {
      for (let j = i + 1; j < activities.length; j++) {
        const a1 = activities[i];
        const a2 = activities[j];
        
        // Only check activities on the same day or consecutive days
        const dayDiff = Math.abs(
          (a2.data.getTime() - a1.data.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (dayDiff > 1) {
          break; // No need to check further
        }
        
        const { overlap, minutes } = hasTimeOverlap(
          a1.inicioDt,
          a1.fimDt,
          a2.inicioDt,
          a2.fimDt
        );
        
        if (overlap) {
          conflicts.push({
            pessoa,
            data: a1.data,
            escalaId1: a1.id,
            escalaId2: a2.id,
            inicio1: a1.inicioDt,
            fim1: a1.fimDt,
            inicio2: a2.inicioDt,
            fim2: a2.fimDt,
            overlapMinutos: minutes,
            evento1: a1.eventoPrograma || a1.descricaoItem || a1.tipoItem,
            evento2: a2.eventoPrograma || a2.descricaoItem || a2.tipoItem,
            cidade1: a1.cidade,
            cidade2: a2.cidade,
          });
        }
      }
    }
  }
  
  return conflicts;
}

/**
 * Detect time-off violations (work scheduled during time off)
 */
export function detectFolgaViolations(
  escalas: Array<ProcessedEscala & { id: number }>
): FolgaAlert[] {
  const violations: FolgaAlert[] = [];
  
  // Group by person and date
  const byPersonDate = new Map<string, Array<ProcessedEscala & { id: number }>>();
  
  for (const escala of escalas) {
    const key = `${escala.pessoa}|${escala.data.toISOString().split('T')[0]}`;
    if (!byPersonDate.has(key)) {
      byPersonDate.set(key, []);
    }
    byPersonDate.get(key)!.push(escala);
  }
  
  // Check for work activities on time-off days
  for (const [key, activities] of Array.from(byPersonDate.entries())) {
    const timeOffActivities = activities.filter((a: ProcessedEscala & { id: number }) => a.ehFolga);
    const workActivities = activities.filter((a: ProcessedEscala & { id: number }) => !a.ehFolga && !isIgnoredActivity(a));
    
    // If there's time off and work on the same day, it's a violation
    for (const timeOff of timeOffActivities) {
      for (const work of workActivities) {
        violations.push({
          pessoa: timeOff.pessoa,
          data: timeOff.data,
          tipoFolga: timeOff.tipoItem,
          escalaIdFolga: timeOff.id,
          escalaIdConflitante: work.id,
          duracaoHoras: work.duracaoHoras,
          status: work.status,
          eventoPrograma: work.eventoPrograma || work.descricaoItem || work.tipoItem,
        });
      }
    }
  }
  
  return violations;
}

/**
 * Detect insufficient travel time between activities in different cities
 */
export function detectDeslocamentoRisks(
  escalas: Array<ProcessedEscala & { id: number }>,
  minGapHours: number = 3
): DeslocamentoAlert[] {
  const risks: DeslocamentoAlert[] = [];
  
  // Group by person
  const byPerson = new Map<string, Array<ProcessedEscala & { id: number }>>();
  
  for (const escala of escalas) {
    // Only consider work activities (not time off)
    if (!escala.ehFolga) {
      if (!byPerson.has(escala.pessoa)) {
        byPerson.set(escala.pessoa, []);
      }
      byPerson.get(escala.pessoa)!.push(escala);
    }
  }
  
  // Check consecutive activities for city changes
  for (const [pessoa, activities] of Array.from(byPerson.entries())) {
    // Sort by end time
    activities.sort((a: ProcessedEscala & { id: number }, b: ProcessedEscala & { id: number }) => a.fimDt.getTime() - b.fimDt.getTime());
    
    for (let i = 0; i < activities.length - 1; i++) {
      const prev = activities[i];
      const next = activities[i + 1];
      
      // Check if cities are different (and both are known)
      if (prev.cidade && next.cidade && prev.cidade !== next.cidade) {
        // Calculate gap in hours
        const gapMs = next.inicioDt.getTime() - prev.fimDt.getTime();
        const gapHours = gapMs / (1000 * 60 * 60);
        
        // If gap is less than minimum, it's a risk
        if (gapHours < minGapHours) {
          risks.push({
            pessoa,
            escalaIdPrev: prev.id,
            escalaIdNext: next.id,
            dataPrev: prev.data,
            dataNext: next.data,
            cidadePrev: prev.cidade,
            cidadeNext: next.cidade,
            fimPrev: prev.fimDt,
            inicioNext: next.inicioDt,
            gapHoras: Math.max(0, gapHours),
            gapMinimo: minGapHours,
            status: next.status,
          });
        }
      }
    }
  }
  
  return risks;
}

/**
 * Detect data quality issues
 */
export function detectQualityIssues(
  escalas: ProcessedEscala[]
): QualidadeIssue[] {
  const issues: QualidadeIssue[] = [];
  
  for (const escala of escalas) {
    // Check for negative or zero duration
    if (escala.duracaoHoras <= 0) {
      issues.push({
        tipo: 'duracao_invalida',
        descricao: `Duração inválida: ${escala.duracaoHoras} horas`,
        pessoa: escala.pessoa,
        data: escala.data,
        wo: escala.wo,
        dadosOriginais: JSON.stringify(escala),
      });
    }
    
    // Check for extremely long duration (> 24 hours)
    if (escala.duracaoHoras > 24) {
      issues.push({
        tipo: 'duracao_excessiva',
        descricao: `Duração excessiva: ${escala.duracaoHoras} horas`,
        pessoa: escala.pessoa,
        data: escala.data,
        wo: escala.wo,
        dadosOriginais: JSON.stringify(escala),
      });
    }
    
    // Check for missing critical data
    if (!escala.cidade && !escala.local) {
      issues.push({
        tipo: 'local_ausente',
        descricao: 'Cidade e local não especificados',
        pessoa: escala.pessoa,
        data: escala.data,
        wo: escala.wo,
        dadosOriginais: JSON.stringify(escala),
      });
    }
  }
  
  return issues;
}

export interface InterjornadaAlert {
  pessoa: string;
  escalaIdPrev: number;
  escalaIdNext: number;
  dataPrev: Date;
  dataNext: Date;
  fimPrev: Date;
  inicioNext: Date;
  descansoHoras: number;
  descansoMinimo: number;
  eventoPrev: string | null;
  eventoNext: string | null;
  status: string | null;
}

export interface ViagemDetected {
  pessoa: string;
  escalaIdOrigem: number;
  escalaIdDestino: number;
  cidadeOrigem: string;
  cidadeDestino: string;
  dataOrigem: Date;
  dataDestino: Date;
}

/**
 * Detect insufficient rest between activities (interjornada < 11h)
 */
export function detectInterjornadaViolations(
  escalas: Array<ProcessedEscala & { id: number }>,
  minRestHours: number = 11
): InterjornadaAlert[] {
  const violations: InterjornadaAlert[] = [];
  
  // Group by person
  const byPerson = new Map<string, Array<ProcessedEscala & { id: number }>>();
  
  for (const escala of escalas) {
    // Only consider work activities (not time off and not ignored activities)
    if (!escala.ehFolga && !isIgnoredActivity(escala)) {
      if (!byPerson.has(escala.pessoa)) {
        byPerson.set(escala.pessoa, []);
      }
      byPerson.get(escala.pessoa)!.push(escala);
    }
  }
  
  // Check consecutive activities for insufficient rest BETWEEN DAYS
  for (const [pessoa, activities] of Array.from(byPerson.entries())) {
    // Sort by end time
    activities.sort((a, b) => a.fimDt.getTime() - b.fimDt.getTime());
    
    for (let i = 0; i < activities.length - 1; i++) {
      const prev = activities[i];
      const next = activities[i + 1];
      
      // Only check interjornada if activities are on DIFFERENT days
      const prevDate = prev.data.toISOString().split('T')[0];
      const nextDate = next.data.toISOString().split('T')[0];
      
      // Calculate rest time in hours (from end of prev to start of next)
      const restMs = next.inicioDt.getTime() - prev.fimDt.getTime();
      const restHours = restMs / (1000 * 60 * 60);

      const eventPrev = prev.eventoPrograma || prev.descricaoItem || prev.tipoItem;
      const eventNext = next.eventoPrograma || next.descricaoItem || next.tipoItem;

      // Ignore if:
      // 1. Same activity/event (continuation)
      // 2. Very small gap (less than 3h) - usually considered same workday/jornada assignment
      // 3. Same calendar date
      if (eventPrev === eventNext || restHours < 3 || prevDate === nextDate) {
        continue;
      }
      
      // If rest is less than minimum, it's a violation
      if (restHours < minRestHours && restHours >= 0) {
        violations.push({
          pessoa,
          escalaIdPrev: prev.id,
          escalaIdNext: next.id,
          dataPrev: prev.data,
          dataNext: next.data,
          fimPrev: prev.fimDt,
          inicioNext: next.inicioDt,
          descansoHoras: Math.max(0, restHours),
          descansoMinimo: minRestHours,
          eventoPrev: eventPrev,
          eventoNext: eventNext,
          status: next.status,
        });
      }
    }
  }
  
  return violations;
}

/**
 * Detect travels (city changes between consecutive activities)
 */
export function detectViagens(
  escalas: Array<ProcessedEscala & { id: number }>
): ViagemDetected[] {
  const viagens: ViagemDetected[] = [];
  
  // Group by person
  const byPerson = new Map<string, Array<ProcessedEscala & { id: number }>>();
  
  for (const escala of escalas) {
    // Only consider work activities with known cities
    if (!escala.ehFolga && escala.cidade) {
      if (!byPerson.has(escala.pessoa)) {
        byPerson.set(escala.pessoa, []);
      }
      byPerson.get(escala.pessoa)!.push(escala);
    }
  }
  
  // Check consecutive activities for city changes
  for (const [pessoa, activities] of Array.from(byPerson.entries())) {
    // Sort by date and start time
    activities.sort((a, b) => a.inicioDt.getTime() - b.inicioDt.getTime());
    
    for (let i = 0; i < activities.length - 1; i++) {
      const origem = activities[i];
      const destino = activities[i + 1];
      
      // If cities are different, it's a travel
      if (origem.cidade && destino.cidade && origem.cidade !== destino.cidade) {
        viagens.push({
          pessoa,
          escalaIdOrigem: origem.id,
          escalaIdDestino: destino.id,
          cidadeOrigem: origem.cidade,
          cidadeDestino: destino.cidade,
          dataOrigem: origem.data,
          dataDestino: destino.data,
        });
      }
    }
  }
  
  return viagens;
}
