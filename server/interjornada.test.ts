import { describe, expect, it } from "vitest";
import { detectInterjornadaViolations, detectViagens } from "./rules";
import type { ProcessedEscala } from "./etl";

describe("Interjornada Detection", () => {
  it("should detect interjornada violation when rest < 11h", () => {
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
        data: new Date("2024-01-16"),
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
    expect(violations[0].descansoHoras).toBeCloseTo(8, 0);
  });

  it("should not detect violation when rest >= 11h", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Maria Santos",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Futebol",
        wo: "WO001",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T08:00:00"),
        fimDt: new Date("2024-01-15T18:00:00"), // Ends at 18:00
        duracaoHoras: 10,
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
        pessoa: "Maria Santos",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Basquete",
        wo: "WO002",
        data: new Date("2024-01-16"),
        inicioDt: new Date("2024-01-16T06:00:00"), // Starts at 06:00 (12h rest)
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

    expect(violations).toHaveLength(0);
  });

  it("should ignore folgas when detecting interjornada", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Pedro Costa",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Futebol",
        wo: "WO001",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T08:00:00"),
        fimDt: new Date("2024-01-15T22:00:00"),
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
        pessoa: "Pedro Costa",
        funcao: null,
        tipoItem: "Day Off",
        descricaoItem: null,
        status: null,
        canal: null,
        cliente: null,
        eventoPrograma: null,
        wo: null,
        data: new Date("2024-01-16"),
        inicioDt: new Date("2024-01-16T00:00:00"),
        fimDt: new Date("2024-01-16T23:59:59"),
        duracaoHoras: 24,
        cidade: null,
        uf: null,
        local: null,
        ehFolga: true, // This is a folga
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Terça",
      },
      {
        id: 3,
        pessoa: "Pedro Costa",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Basquete",
        wo: "WO003",
        data: new Date("2024-01-17"),
        inicioDt: new Date("2024-01-17T06:00:00"),
        fimDt: new Date("2024-01-17T12:00:00"),
        duracaoHoras: 6,
        cidade: "São Paulo",
        uf: "SP",
        local: null,
        ehFolga: false,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Quarta",
      },
    ];

    const violations = detectInterjornadaViolations(escalas, 11);

    // Should not detect violation because folga is ignored
    expect(violations).toHaveLength(0);
  });
});

describe("Viagens Detection", () => {
  it("should detect travel when city changes", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Ana Lima",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Futebol",
        wo: "WO001",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T08:00:00"),
        fimDt: new Date("2024-01-15T18:00:00"),
        duracaoHoras: 10,
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
        pessoa: "Ana Lima",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Basquete",
        wo: "WO002",
        data: new Date("2024-01-16"),
        inicioDt: new Date("2024-01-16T10:00:00"),
        fimDt: new Date("2024-01-16T16:00:00"),
        duracaoHoras: 6,
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
    expect(viagens[0].pessoa).toBe("Ana Lima");
    expect(viagens[0].cidadeOrigem).toBe("São Paulo");
    expect(viagens[0].cidadeDestino).toBe("Rio de Janeiro");
  });

  it("should not detect travel when city is the same", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Carlos Souza",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Futebol",
        wo: "WO001",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T08:00:00"),
        fimDt: new Date("2024-01-15T18:00:00"),
        duracaoHoras: 10,
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
        pessoa: "Carlos Souza",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Basquete",
        wo: "WO002",
        data: new Date("2024-01-16"),
        inicioDt: new Date("2024-01-16T10:00:00"),
        fimDt: new Date("2024-01-16T16:00:00"),
        duracaoHoras: 6,
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

  it("should ignore folgas when detecting viagens", () => {
    const escalas: Array<ProcessedEscala & { id: number }> = [
      {
        id: 1,
        pessoa: "Beatriz Alves",
        funcao: "Narrador",
        tipoItem: "Booking",
        descricaoItem: null,
        status: "Confirmed",
        canal: "ESPN",
        cliente: null,
        eventoPrograma: "Futebol",
        wo: "WO001",
        data: new Date("2024-01-15"),
        inicioDt: new Date("2024-01-15T08:00:00"),
        fimDt: new Date("2024-01-15T18:00:00"),
        duracaoHoras: 10,
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
        pessoa: "Beatriz Alves",
        funcao: null,
        tipoItem: "Day Off",
        descricaoItem: null,
        status: null,
        canal: null,
        cliente: null,
        eventoPrograma: null,
        wo: null,
        data: new Date("2024-01-16"),
        inicioDt: new Date("2024-01-16T00:00:00"),
        fimDt: new Date("2024-01-16T23:59:59"),
        duracaoHoras: 24,
        cidade: "Rio de Janeiro", // Different city but it's a folga
        uf: "RJ",
        local: null,
        ehFolga: true,
        ehViagem: false,
        ano: 2024,
        mes: 1,
        semanaIso: 3,
        diaSemana: "Terça",
      },
    ];

    const viagens = detectViagens(escalas);

    // Should not detect travel because folga is ignored
    expect(viagens).toHaveLength(0);
  });
});
