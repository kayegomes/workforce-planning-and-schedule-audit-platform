import { describe, expect, it } from "vitest";
import { parseGradeExcel, calcularSuficienciaCobertura } from "./grades";

// Wrapper for tests
function calculateCoverage(
  eventos: any[],
  profissionais: string[],
  folgas: any[],
  excecoes: any[]
) {
  const gradeEventos = eventos.map(e => ({
    wo: e.evento,
    data: new Date(e.data),
    tipoEvento: null,
    canal: null,
    cidade: null,
    funcaoRequerida: "Narrador"
  }));

  const folgasInfo = folgas.map(f => ({
    pessoa: f.pessoa,
    data: new Date(f.data),
    tipoFolga: f.tipo
  }));

  const excecoesInfo = excecoes.map(e => ({
    pessoa: e.pessoa,
    tipo: e.tipo,
    dataInicio: new Date(e.dataInicio),
    dataFim: new Date(e.dataFim)
  }));

  return calcularSuficienciaCobertura(gradeEventos, "Narrador", profissionais, folgasInfo, excecoesInfo);
}

describe("Grades Analysis", () => {
  describe("parseGradeExcel", () => {
    it("should parse grade Excel with required columns", () => {
      // Mock Excel data would be tested here
      // For now, we test the structure
      expect(parseGradeExcel).toBeDefined();
    });
  });

  describe("calculateCoverage", () => {
    it("should calculate sufficient coverage when enough professionals", () => {
      const eventos = [
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 1" },
        { data: "2024-03-01", horaInicio: "14:00", horaFim: "16:00", evento: "Evento 2" },
      ];

      const profissionais = ["João", "Maria", "Pedro"];
      const folgas: any[] = [];
      const excecoes: any[] = [];

      const result = calculateCoverage(eventos, profissionais, folgas, excecoes);

      expect(result.resultado).toBe("suficiente");
      expect(result.totalEventos).toBe(2);
      expect(result.eventosComCobertura).toBe(2);
      expect(result.eventosSemCobertura).toBe(0);
    });

    it("should detect insufficient coverage when not enough professionals", () => {
      const eventos = [
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 1" },
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 2" },
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 3" },
      ];

      const profissionais = ["João", "Maria"];
      const folgas: any[] = [];
      const excecoes: any[] = [];

      const result = calculateCoverage(eventos, profissionais, folgas, excecoes);

      // With 3 simultaneous events and only 2 professionals, this is critical
      expect(result.resultado).toBe("critico");
      expect(result.eventosSemCobertura).toBeGreaterThan(0);
    });

    it("should consider folgas when calculating availability", () => {
      const eventos = [
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 1" },
      ];

      const profissionais = ["João", "Maria"];
      const folgas = [
        { pessoa: "João", data: "2024-03-01", tipo: "Folga" },
      ];
      const excecoes: any[] = [];

      const result = calculateCoverage(eventos, profissionais, folgas, excecoes);

      expect(result.profissionaisDisponiveis).toBeLessThan(profissionais.length);
      expect(result.detalhes[0].profissionaisEmFolga).toBe(1);
    });

    it("should consider exceptions when calculating availability", () => {
      const eventos = [
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 1" },
      ];

      const profissionais = ["João", "Maria", "Pedro"];
      const folgas: any[] = [];
      const excecoes = [
        { pessoa: "Maria", tipo: "licenca_maternidade", dataInicio: "2024-02-01", dataFim: "2024-04-01" },
      ];

      const result = calculateCoverage(eventos, profissionais, folgas, excecoes);

      expect(result.detalhes[0].profissionaisEmExcecao).toBe(1);
      expect(result.detalhes[0].profissionaisDisponiveis).toBe(2);
    });

    it("should mark as critical when coverage is very low", () => {
      const eventos = [
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 1" },
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 2" },
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 3" },
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 4" },
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 5" },
      ];

      const profissionais = ["João"];
      const folgas: any[] = [];
      const excecoes: any[] = [];

      const result = calculateCoverage(eventos, profissionais, folgas, excecoes);

      expect(result.resultado).toBe("critico");
      expect(result.eventosSemCobertura).toBeGreaterThan(3);
    });

    it("should provide recommendations for insufficient coverage", () => {
      const eventos = [
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 1" },
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 2" },
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 3" },
      ];

      const profissionais = ["João"];
      const folgas: any[] = [];
      const excecoes: any[] = [];

      const result = calculateCoverage(eventos, profissionais, folgas, excecoes);

      expect(result.recomendacoes).toBeDefined();
      expect(result.recomendacoes.length).toBeGreaterThan(0);
    });

    it("should group events by date correctly", () => {
      const eventos = [
        { data: "2024-03-01", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 1" },
        { data: "2024-03-01", horaInicio: "14:00", horaFim: "16:00", evento: "Evento 2" },
        { data: "2024-03-02", horaInicio: "10:00", horaFim: "12:00", evento: "Evento 3" },
      ];

      const profissionais = ["João", "Maria"];
      const folgas: any[] = [];
      const excecoes: any[] = [];

      const result = calculateCoverage(eventos, profissionais, folgas, excecoes);

      expect(result.detalhes.length).toBe(2); // 2 unique dates
      expect(result.detalhes[0].data).toEqual(new Date("2024-03-01"));
      expect(result.detalhes[1].data).toEqual(new Date("2024-03-02"));
    });
  });
});
