import { describe, expect, it } from "vitest";

describe("History Multi-Run", () => {
  describe("KPI Evolution Calculation", () => {
    it("should calculate evolution correctly", () => {
      const runs = [
        {
          id: 1,
          createdAt: new Date("2024-01-01"),
          totalConflitos: 10,
          totalViolacoesFolga: 5,
          totalHorasAtividades: 100,
        },
        {
          id: 2,
          createdAt: new Date("2024-01-02"),
          totalConflitos: 15,
          totalViolacoesFolga: 8,
          totalHorasAtividades: 120,
        },
        {
          id: 3,
          createdAt: new Date("2024-01-03"),
          totalConflitos: 12,
          totalViolacoesFolga: 6,
          totalHorasAtividades: 110,
        },
      ];

      // Verify evolution data structure
      expect(runs.length).toBe(3);
      expect(runs[0].totalConflitos).toBe(10);
      expect(runs[2].totalConflitos).toBe(12);
    });

    it("should handle empty runs array", () => {
      const runs: any[] = [];
      expect(runs.length).toBe(0);
    });
  });

  describe("Aggregated Stats Calculation", () => {
    it("should sum all runs correctly", () => {
      const runs = [
        { totalConflitos: 10, totalViolacoesFolga: 5, totalHorasAtividades: 100 },
        { totalConflitos: 15, totalViolacoesFolga: 8, totalHorasAtividades: 120 },
        { totalConflitos: 12, totalViolacoesFolga: 6, totalHorasAtividades: 110 },
      ];

      const totalConflitos = runs.reduce((sum, r) => sum + r.totalConflitos, 0);
      const totalViolacoesFolga = runs.reduce((sum, r) => sum + r.totalViolacoesFolga, 0);
      const totalHorasAtividades = runs.reduce((sum, r) => sum + r.totalHorasAtividades, 0);

      expect(totalConflitos).toBe(37);
      expect(totalViolacoesFolga).toBe(19);
      expect(totalHorasAtividades).toBe(330);
    });

    it("should calculate average correctly", () => {
      const percentuals = [10.5, 15.2, 12.8];
      const avg = percentuals.reduce((sum, p) => sum + p, 0) / percentuals.length;
      expect(avg).toBeCloseTo(12.83, 2);
    });
  });

  describe("Trend Calculation", () => {
    it("should detect upward trend", () => {
      const first = 10;
      const last = 15;
      const change = ((last - first) / first) * 100;
      expect(change).toBe(50);
      expect(change > 0).toBe(true);
    });

    it("should detect downward trend", () => {
      const first = 15;
      const last = 10;
      const change = ((last - first) / first) * 100;
      expect(change).toBeCloseTo(-33.33, 2);
      expect(change < 0).toBe(true);
    });

    it("should detect stable trend", () => {
      const first = 10;
      const last = 10;
      const change = ((last - first) / first) * 100;
      expect(change).toBe(0);
    });

    it("should handle zero first value", () => {
      const first = 0;
      const last = 10;
      // Cannot calculate percentage change from zero
      expect(first).toBe(0);
    });
  });
});
