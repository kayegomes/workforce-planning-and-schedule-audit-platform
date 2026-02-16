import { describe, it, expect } from "vitest";
import { calculateWeeklyUtilization, calculateMovingAverage, analyzeTrend, WeeklyUtilization } from "./trend";

describe("Análise de Tendência de Utilização", () => {
  describe("calculateWeeklyUtilization", () => {
    it("deve agrupar escalas por semana corretamente", () => {
      const escalas = [
        { data: new Date("2024-03-04"), duracaoHoras: 8, ehFolga: false }, // Monday
        { data: new Date("2024-03-05"), duracaoHoras: 8, ehFolga: false }, // Tuesday
        { data: new Date("2024-03-06"), duracaoHoras: 8, ehFolga: false }, // Wednesday
        { data: new Date("2024-03-11"), duracaoHoras: 10, ehFolga: false }, // Next Monday
      ];

      const result = calculateWeeklyUtilization(escalas);

      expect(result).toHaveLength(2);
      expect(result[0].totalHoras).toBe(24);
      expect(result[1].totalHoras).toBe(10);
    });

    it("deve calcular utilização como percentual de 40h semanais", () => {
      const escalas = [
        { data: new Date("2024-03-04"), duracaoHoras: 40, ehFolga: false },
      ];

      const result = calculateWeeklyUtilization(escalas);

      expect(result[0].utilizacao).toBe(100);
    });

    it("deve ignorar folgas no cálculo", () => {
      const escalas = [
        { data: new Date("2024-03-04"), duracaoHoras: 8, ehFolga: false },
        { data: new Date("2024-03-05"), duracaoHoras: 8, ehFolga: true }, // Folga
      ];

      const result = calculateWeeklyUtilization(escalas);

      expect(result[0].totalHoras).toBe(8);
      expect(result[0].utilizacao).toBe(20);
    });

    it("deve ordenar semanas cronologicamente", () => {
      const escalas = [
        { data: new Date("2024-03-11"), duracaoHoras: 10, ehFolga: false },
        { data: new Date("2024-03-04"), duracaoHoras: 8, ehFolga: false },
      ];

      const result = calculateWeeklyUtilization(escalas);

      expect(result[0].weekStart.getTime()).toBeLessThan(result[1].weekStart.getTime());
    });
  });

  describe("calculateMovingAverage", () => {
    it("deve calcular média móvel de 4 semanas", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 40, utilizacao: 100 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 32, utilizacao: 80 },
        { weekStart: new Date("2024-03-18"), weekEnd: new Date("2024-03-24"), totalHoras: 36, utilizacao: 90 },
        { weekStart: new Date("2024-03-25"), weekEnd: new Date("2024-03-31"), totalHoras: 30, utilizacao: 75 },
      ];

      const result = calculateMovingAverage(weeklyData, 4);

      expect(result).toBe((100 + 80 + 90 + 75) / 4);
    });

    it("deve usar apenas últimas N semanas", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-02-26"), weekEnd: new Date("2024-03-03"), totalHoras: 20, utilizacao: 50 },
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 40, utilizacao: 100 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 32, utilizacao: 80 },
      ];

      const result = calculateMovingAverage(weeklyData, 2);

      expect(result).toBe((100 + 80) / 2);
    });

    it("deve retornar 0 para dados vazios", () => {
      const result = calculateMovingAverage([]);
      expect(result).toBe(0);
    });
  });

  describe("analyzeTrend", () => {
    it("deve identificar tendência crescente", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 20, utilizacao: 50 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 28, utilizacao: 70 },
        { weekStart: new Date("2024-03-18"), weekEnd: new Date("2024-03-24"), totalHoras: 36, utilizacao: 90 },
        { weekStart: new Date("2024-03-25"), weekEnd: new Date("2024-03-31"), totalHoras: 42, utilizacao: 105 },
      ];

      const result = analyzeTrend("João Silva", weeklyData, 6);

      expect(result.trend).toBe("crescente");
      expect(result.trendSlope).toBeGreaterThan(2);
    });

    it("deve identificar tendência decrescente", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 40, utilizacao: 100 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 32, utilizacao: 80 },
        { weekStart: new Date("2024-03-18"), weekEnd: new Date("2024-03-24"), totalHoras: 24, utilizacao: 60 },
        { weekStart: new Date("2024-03-25"), weekEnd: new Date("2024-03-31"), totalHoras: 16, utilizacao: 40 },
      ];

      const result = analyzeTrend("Maria Santos", weeklyData, 6);

      expect(result.trend).toBe("decrescente");
      expect(result.trendSlope).toBeLessThan(-2);
    });

    it("deve identificar tendência estável", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 32, utilizacao: 80 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 32, utilizacao: 80 },
        { weekStart: new Date("2024-03-18"), weekEnd: new Date("2024-03-24"), totalHoras: 32, utilizacao: 80 },
        { weekStart: new Date("2024-03-25"), weekEnd: new Date("2024-03-31"), totalHoras: 32, utilizacao: 80 },
      ];

      const result = analyzeTrend("Pedro Costa", weeklyData, 6);

      expect(result.trend).toBe("estavel");
      expect(Math.abs(result.trendSlope)).toBeLessThanOrEqual(2);
    });

    it("deve gerar previsões para N semanas futuras", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 32, utilizacao: 80 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 32, utilizacao: 80 },
      ];

      const result = analyzeTrend("Ana Lima", weeklyData, 4);

      expect(result.predictions).toHaveLength(4);
      expect(result.predictions[0].isHistorical).toBe(false);
    });

    it("deve identificar alertas de sobrecarga futura (>= 85%)", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 32, utilizacao: 80 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 34, utilizacao: 85 },
        { weekStart: new Date("2024-03-18"), weekEnd: new Date("2024-03-24"), totalHoras: 36, utilizacao: 90 },
        { weekStart: new Date("2024-03-25"), weekEnd: new Date("2024-03-31"), totalHoras: 38, utilizacao: 95 },
      ];

      const result = analyzeTrend("Carlos Souza", weeklyData, 6);

      expect(result.futureAlerts.length).toBeGreaterThan(0);
    });

    it("deve identificar alertas críticos (>= 100%)", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 36, utilizacao: 90 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 38, utilizacao: 95 },
        { weekStart: new Date("2024-03-18"), weekEnd: new Date("2024-03-24"), totalHoras: 40, utilizacao: 100 },
        { weekStart: new Date("2024-03-25"), weekEnd: new Date("2024-03-31"), totalHoras: 42, utilizacao: 105 },
      ];

      const result = analyzeTrend("Fernanda Lima", weeklyData, 6);

      const criticalAlerts = result.futureAlerts.filter(a => a.severity === "critical");
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });

    it("deve gerar recomendação apropriada para alertas críticos", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 38, utilizacao: 95 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 40, utilizacao: 100 },
        { weekStart: new Date("2024-03-18"), weekEnd: new Date("2024-03-24"), totalHoras: 42, utilizacao: 105 },
        { weekStart: new Date("2024-03-25"), weekEnd: new Date("2024-03-31"), totalHoras: 44, utilizacao: 110 },
      ];

      const result = analyzeTrend("Roberto Silva", weeklyData, 6);

      expect(result.recommendation).toContain("CRÍTICO");
    });

    it("deve gerar recomendação positiva quando não há alertas", () => {
      const weeklyData: WeeklyUtilization[] = [
        { weekStart: new Date("2024-03-04"), weekEnd: new Date("2024-03-10"), totalHoras: 28, utilizacao: 70 },
        { weekStart: new Date("2024-03-11"), weekEnd: new Date("2024-03-17"), totalHoras: 28, utilizacao: 70 },
        { weekStart: new Date("2024-03-18"), weekEnd: new Date("2024-03-24"), totalHoras: 28, utilizacao: 70 },
      ];

      const result = analyzeTrend("Juliana Costa", weeklyData, 6);

      expect(result.futureAlerts).toHaveLength(0);
      expect(result.recommendation).toContain("estável");
    });

    it("deve retornar estrutura vazia para dados insuficientes", () => {
      const result = analyzeTrend("Pessoa Sem Dados", [], 6);

      expect(result.historicalData).toHaveLength(0);
      expect(result.predictions).toHaveLength(0);
      expect(result.movingAverage).toBe(0);
      expect(result.trend).toBe("estavel");
    });
  });
});
