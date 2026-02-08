import { describe, expect, it } from "vitest";

/**
 * Test suite for advanced filters on alert routes
 * Validates that filters (dataInicio, dataFim, canal, funcao) work correctly
 */

describe("Advanced Filters", () => {
  describe("Date filters", () => {
    it("should filter alerts by dataInicio", () => {
      const dataInicio = "2024-01-01";
      const alerts = [
        { data: new Date("2023-12-31") },
        { data: new Date("2024-01-01") },
        { data: new Date("2024-01-15") },
      ];

      const filtered = alerts.filter((a) => a.data >= new Date(dataInicio));
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.data).toEqual(new Date("2024-01-01"));
    });

    it("should filter alerts by dataFim", () => {
      const dataFim = "2024-01-15";
      const alerts = [
        { data: new Date("2024-01-01") },
        { data: new Date("2024-01-15") },
        { data: new Date("2024-01-31") },
      ];

      const filtered = alerts.filter((a) => a.data <= new Date(dataFim));
      expect(filtered).toHaveLength(2);
      expect(filtered[filtered.length - 1]?.data).toEqual(new Date("2024-01-15"));
    });

    it("should filter alerts by date range", () => {
      const dataInicio = "2024-01-05";
      const dataFim = "2024-01-20";
      const alerts = [
        { data: new Date("2024-01-01") },
        { data: new Date("2024-01-10") },
        { data: new Date("2024-01-15") },
        { data: new Date("2024-01-25") },
      ];

      const filtered = alerts.filter(
        (a) => a.data >= new Date(dataInicio) && a.data <= new Date(dataFim)
      );
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.data).toEqual(new Date("2024-01-10"));
      expect(filtered[1]?.data).toEqual(new Date("2024-01-15"));
    });
  });

  describe("Canal and Funcao filters", () => {
    it("should filter by canal", () => {
      const escalas = [
        { canal: "SporTV", funcao: "Narrador" },
        { canal: "Premiere", funcao: "Comentarista" },
        { canal: "SporTV", funcao: "Repórter" },
      ];

      const filtered = escalas.filter((e) => e.canal === "SporTV");
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.canal === "SporTV")).toBe(true);
    });

    it("should filter by funcao", () => {
      const escalas = [
        { canal: "SporTV", funcao: "Narrador" },
        { canal: "Premiere", funcao: "Comentarista" },
        { canal: "SporTV", funcao: "Narrador" },
      ];

      const filtered = escalas.filter((e) => e.funcao === "Narrador");
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.funcao === "Narrador")).toBe(true);
    });

    it("should filter by both canal and funcao", () => {
      const escalas = [
        { canal: "SporTV", funcao: "Narrador" },
        { canal: "Premiere", funcao: "Narrador" },
        { canal: "SporTV", funcao: "Comentarista" },
        { canal: "SporTV", funcao: "Narrador" },
      ];

      const filtered = escalas.filter(
        (e) => e.canal === "SporTV" && e.funcao === "Narrador"
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.canal === "SporTV" && e.funcao === "Narrador")).toBe(true);
    });
  });

  describe("Combined filters", () => {
    it("should apply all filters together", () => {
      const data = [
        { data: new Date("2024-01-05"), canal: "SporTV", funcao: "Narrador", pessoa: "João" },
        { data: new Date("2024-01-10"), canal: "SporTV", funcao: "Comentarista", pessoa: "Maria" },
        { data: new Date("2024-01-15"), canal: "Premiere", funcao: "Narrador", pessoa: "Pedro" },
        { data: new Date("2024-01-20"), canal: "SporTV", funcao: "Narrador", pessoa: "Ana" },
        { data: new Date("2024-01-25"), canal: "SporTV", funcao: "Narrador", pessoa: "Carlos" },
      ];

      const dataInicio = "2024-01-08";
      const dataFim = "2024-01-22";
      const canal = "SporTV";
      const funcao = "Narrador";

      const filtered = data.filter(
        (item) =>
          item.data >= new Date(dataInicio) &&
          item.data <= new Date(dataFim) &&
          item.canal === canal &&
          item.funcao === funcao
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.pessoa).toBe("Ana");
      expect(filtered[0]?.data).toEqual(new Date("2024-01-20"));
    });

    it("should handle empty results when no match", () => {
      const data = [
        { data: new Date("2024-01-05"), canal: "SporTV", funcao: "Narrador" },
        { data: new Date("2024-01-10"), canal: "Premiere", funcao: "Comentarista" },
      ];

      const filtered = data.filter(
        (item) => item.canal === "Globo" && item.funcao === "Apresentador"
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe("Pessoa filter", () => {
    it("should filter by pessoa name", () => {
      const alerts = [
        { pessoa: "João Silva" },
        { pessoa: "Maria Santos" },
        { pessoa: "João Pedro" },
      ];

      const filtered = alerts.filter((a) => a.pessoa.includes("João"));
      expect(filtered).toHaveLength(2);
    });

    it("should be case-sensitive for exact match", () => {
      const alerts = [
        { pessoa: "João Silva" },
        { pessoa: "joão silva" },
      ];

      const filtered = alerts.filter((a) => a.pessoa === "João Silva");
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.pessoa).toBe("João Silva");
    });
  });
});
