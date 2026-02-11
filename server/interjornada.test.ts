import { describe, it, expect } from "vitest";
import { detectInterjornadaViolations, detectViagens } from "./rules";
import type { ProcessedEscala } from "./etl";

describe("Interjornada Detection", () => {
  it("should detect interjornada violation when rest < 11h BETWEEN DAYS", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "João Silva",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Futebol - Campeonato",
        wo: "WO001",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T08:00:00"),
        fimDt: new Date("2024-01-15T22:00:00"), // Ends at 22:00
        duracaoHoras: 14,
        cidade: "São Paulo",
        uf: "SP",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Segunda",
      },
      {
        id: 2,
        pessoa: "João Silva",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Basquete - NBA",
        wo: "WO002",
        data: new Date("2024-01-16"), // NEXT DAY
        inicioDt: new Date("2024-01-16T06:00:00"), // Starts at 06:00 (only 8h rest)
        fimDt: new Date("2024-01-16T12:00:00"),
        duracaoHoras: 6,
        cidade: "São Paulo",
        uf: "SP",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Terça",
      },
    ];

    const violations = detectInterjornadaViolations(escalas, 11);

    expect(violations).toHaveLength(1);
    expect(violations[0].pessoa).toBe("João Silva");
    expect(violations[0].descansoHoras).toBeLessThan(11);
    expect(violations[0].descansoHoras).toBeCloseTo(8, 1);
  });

  it("should NOT detect interjornada violation for events on SAME DAY", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Maria Santos",
        funcao: "Comentarista",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "SporTV",
        cliente: null,
        eventoPrograma: "Futebol - Manhã",
        wo: "WO003",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T08:00:00"),
        fimDt: new Date("2024-01-15T12:00:00"), // Ends at 12:00
        duracaoHoras: 4,
        cidade: "Rio de Janeiro",
        uf: "RJ",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Segunda",
      },
      {
        id: 2,
        pessoa: "Maria Santos",
        funcao: "Comentarista",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "SporTV",
        cliente: null,
        eventoPrograma: "Basquete - Tarde",
        wo: "WO004",
        data: new Date("2024-01-15"), // SAME DAY
        inicioDt: new Date("2024-01-15T14:00:00"), // Only 2h gap, but SAME DAY
        fimDt: new Date("2024-01-15T18:00:00"),
        duracaoHoras: 4,
        cidade: "Rio de Janeiro",
        uf: "RJ",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Segunda",
      },
    ];

    const violations = detectInterjornadaViolations(escalas, 11);

    // Should be ZERO violations because both events are on the same day
    expect(violations).toHaveLength(0);
  });

  it("should NOT detect violation when rest >= 11h between days", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Carlos Pereira",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "Globo",
        cliente: null,
        eventoPrograma: "Futebol",
        wo: "WO005",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T18:00:00"),
        fimDt: new Date("2024-01-15T22:00:00"),
        duracaoHoras: 4,
        cidade: "São Paulo",
        uf: "SP",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Segunda",
      },
      {
        id: 2,
        pessoa: "Carlos Pereira",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "Globo",
        cliente: null,
        eventoPrograma: "Vôlei",
        wo: "WO006",
        data: new Date("2024-01-16"),
        inicioDt: new Date("2024-01-16T10:00:00"), // 12h rest - OK
        fimDt: new Date("2024-01-16T14:00:00"),
        duracaoHoras: 4,
        cidade: "São Paulo",
        uf: "SP",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Terça",
      },
    ];

    const violations = detectInterjornadaViolations(escalas, 11);

    expect(violations).toHaveLength(0);
  });
});

describe("Viagens Detection", () => {
  it("should detect viagem when person changes city", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Ana Costa",
        funcao: "Repórter",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "SporTV",
        cliente: null,
        eventoPrograma: "Futebol - São Paulo",
        wo: "WO007",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T14:00:00"),
        fimDt: new Date("2024-01-15T18:00:00"),
        duracaoHoras: 4,
        cidade: "São Paulo",
        uf: "SP",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Segunda",
      },
      {
        id: 2,
        pessoa: "Ana Costa",
        funcao: "Repórter",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "SporTV",
        cliente: null,
        eventoPrograma: "Basquete - Rio",
        wo: "WO008",
        data: new Date("2024-01-16"),
        inicioDt: new Date("2024-01-16T10:00:00"),
        fimDt: new Date("2024-01-16T14:00:00"),
        duracaoHoras: 4,
        cidade: "Rio de Janeiro", // Different city
        uf: "RJ",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Terça",
      },
    ];

    const viagens = detectViagens(escalas);

    expect(viagens).toHaveLength(1);
    expect(viagens[0].pessoa).toBe("Ana Costa");
    expect(viagens[0].cidadeOrigem).toBe("São Paulo");
    expect(viagens[0].cidadeDestino).toBe("Rio de Janeiro");
  });

  it("should NOT detect viagem when person stays in same city", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Pedro Alves",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Futebol",
        wo: "WO009",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T14:00:00"),
        fimDt: new Date("2024-01-15T18:00:00"),
        duracaoHoras: 4,
        cidade: "São Paulo",
        uf: "SP",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Segunda",
      },
      {
        id: 2,
        pessoa: "Pedro Alves",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Basquete",
        wo: "WO010",
        data: new Date("2024-01-16"),
        inicioDt: new Date("2024-01-16T10:00:00"),
        fimDt: new Date("2024-01-16T14:00:00"),
        duracaoHoras: 4,
        cidade: "São Paulo", // Same city
        uf: "SP",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Terça",
      },
    ];

    const viagens = detectViagens(escalas);

    expect(viagens).toHaveLength(0);
  });
});
