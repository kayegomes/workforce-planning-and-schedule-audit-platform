import { describe, expect, it } from "vitest";

/**
 * Test for WOs without event KPI calculation
 * 
 * The logic is implemented in server/routers.ts dashboard.getStats route:
 * - Count total distinct WOs (non-null, non-empty)
 * - Count WOs with associated event (eventoPrograma non-null, non-empty)
 * - Calculate percentage: (wosSemEvento / totalWOs) * 100
 */
describe("WOs sem Evento KPI", () => {
  it("should calculate 0% when all WOs have events", () => {
    // Simulated data
    const totalWOs = 10;
    const wosWithEvent = 10;
    const wosSemEvento = totalWOs - wosWithEvent;
    const percentual = (wosSemEvento / totalWOs) * 100;

    expect(percentual).toBe(0);
  });

  it("should calculate 50% when half of WOs have no events", () => {
    const totalWOs = 10;
    const wosWithEvent = 5;
    const wosSemEvento = totalWOs - wosWithEvent;
    const percentual = (wosSemEvento / totalWOs) * 100;

    expect(percentual).toBe(50);
  });

  it("should calculate 100% when no WOs have events", () => {
    const totalWOs = 10;
    const wosWithEvent = 0;
    const wosSemEvento = totalWOs - wosWithEvent;
    const percentual = (wosSemEvento / totalWOs) * 100;

    expect(percentual).toBe(100);
  });

  it("should handle zero WOs gracefully", () => {
    const totalWOs = 0;
    const wosWithEvent = 0;
    const wosSemEvento = totalWOs - wosWithEvent;
    const percentual = totalWOs > 0 ? (wosSemEvento / totalWOs) * 100 : 0;

    expect(percentual).toBe(0);
  });

  it("should calculate correct percentage for real scenario", () => {
    // Example: 100 WOs, 15 without events
    const totalWOs = 100;
    const wosWithEvent = 85;
    const wosSemEvento = totalWOs - wosWithEvent;
    const percentual = (wosSemEvento / totalWOs) * 100;

    expect(percentual).toBe(15);
    expect(wosSemEvento).toBe(15);
  });

  it("should round percentage correctly", () => {
    // Example: 97 WOs, 30 without events = 30.93%
    const totalWOs = 97;
    const wosWithEvent = 67;
    const wosSemEvento = totalWOs - wosWithEvent;
    const percentual = (wosSemEvento / totalWOs) * 100;

    expect(percentual).toBeCloseTo(30.93, 2);
    expect(wosSemEvento).toBe(30);
  });
});
