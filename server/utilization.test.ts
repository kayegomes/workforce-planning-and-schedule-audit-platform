import { describe, it, expect } from "vitest";

describe("Utilization Calculation", () => {
  it("should calculate utilization percentage correctly", () => {
    const horasTrabalhadas = 80;
    const horasDisponiveis = 160; // 20 business days * 8h
    
    const percentual = Math.round((horasTrabalhadas / horasDisponiveis) * 100);
    
    expect(percentual).toBe(50);
  });

  it("should handle 100% utilization", () => {
    const horasTrabalhadas = 160;
    const horasDisponiveis = 160;
    
    const percentual = Math.round((horasTrabalhadas / horasDisponiveis) * 100);
    
    expect(percentual).toBe(100);
  });

  it("should handle over 100% utilization (overtime)", () => {
    const horasTrabalhadas = 200;
    const horasDisponiveis = 160;
    
    const percentual = Math.round((horasTrabalhadas / horasDisponiveis) * 100);
    
    expect(percentual).toBe(125);
  });

  it("should handle zero hours worked", () => {
    const horasTrabalhadas = 0;
    const horasDisponiveis = 160;
    
    const percentual = Math.round((horasTrabalhadas / horasDisponiveis) * 100);
    
    expect(percentual).toBe(0);
  });

  it("should calculate available hours based on 8h per business day", () => {
    const businessDays = 20;
    const horasDisponiveis = businessDays * 8;
    
    expect(horasDisponiveis).toBe(160);
  });

  it("should handle zero available hours gracefully", () => {
    const horasTrabalhadas = 40;
    const horasDisponiveis = 0;
    
    const percentual = horasDisponiveis > 0 
      ? Math.round((horasTrabalhadas / horasDisponiveis) * 100) 
      : 0;
    
    expect(percentual).toBe(0);
  });
});
