import { describe, it, expect } from "vitest";

describe("Heatmap de Sobrecarga - Cálculo de Utilização por Dia da Semana", () => {
  // Helper to simulate heatmap calculation
  const calculateHeatmap = (atividades: Array<{ pessoa: string; data: string; duracaoHoras: number }>) => {
    const utilizationMap = new Map<string, Map<number, number>>();

    for (const ativ of atividades) {
      if (!ativ.pessoa || !ativ.data) continue;
      const date = new Date(ativ.data + 'T12:00:00Z'); // Use UTC to avoid timezone issues
      const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
      const hours = ativ.duracaoHoras;

      if (!utilizationMap.has(ativ.pessoa)) {
        utilizationMap.set(ativ.pessoa, new Map());
      }
      const personMap = utilizationMap.get(ativ.pessoa)!;
      personMap.set(dayOfWeek, (personMap.get(dayOfWeek) || 0) + hours);
    }

    const heatmapData = [];
    for (const [pessoa, dayMap] of Array.from(utilizationMap.entries())) {
      const weekData = {
        pessoa,
        sunday: Math.round(((dayMap.get(0) || 0) / 8) * 100),
        monday: Math.round(((dayMap.get(1) || 0) / 8) * 100),
        tuesday: Math.round(((dayMap.get(2) || 0) / 8) * 100),
        wednesday: Math.round(((dayMap.get(3) || 0) / 8) * 100),
        thursday: Math.round(((dayMap.get(4) || 0) / 8) * 100),
        friday: Math.round(((dayMap.get(5) || 0) / 8) * 100),
        saturday: Math.round(((dayMap.get(6) || 0) / 8) * 100),
        avgUtilization: Math.round(
          (Array.from(dayMap.values()).reduce((a: number, b: number) => a + b, 0) / 7 / 8) * 100
        ),
      };
      heatmapData.push(weekData);
    }

    return heatmapData;
  };

  it("deve calcular utilização correta para uma semana completa", () => {
    const atividades = [
      { pessoa: "João Silva", data: "2024-01-07", duracaoHoras: 8 }, // Sunday
      { pessoa: "João Silva", data: "2024-01-08", duracaoHoras: 8 }, // Monday
      { pessoa: "João Silva", data: "2024-01-09", duracaoHoras: 8 }, // Tuesday
      { pessoa: "João Silva", data: "2024-01-10", duracaoHoras: 8 }, // Wednesday
      { pessoa: "João Silva", data: "2024-01-11", duracaoHoras: 8 }, // Thursday
      { pessoa: "João Silva", data: "2024-01-12", duracaoHoras: 8 }, // Friday
      { pessoa: "João Silva", data: "2024-01-13", duracaoHoras: 8 }, // Saturday
    ];

    const result = calculateHeatmap(atividades);

    expect(result).toHaveLength(1);
    expect(result[0].pessoa).toBe("João Silva");
    expect(result[0].sunday).toBe(100);
    expect(result[0].monday).toBe(100);
    expect(result[0].tuesday).toBe(100);
    expect(result[0].wednesday).toBe(100);
    expect(result[0].thursday).toBe(100);
    expect(result[0].friday).toBe(100);
    expect(result[0].saturday).toBe(100);
    expect(result[0].avgUtilization).toBe(100);
  });

  it("deve identificar sobrecarga em dias específicos", () => {
    const atividades = [
      { pessoa: "Maria Santos", data: "2024-01-08", duracaoHoras: 12 }, // Monday - 150%
      { pessoa: "Maria Santos", data: "2024-01-09", duracaoHoras: 4 },  // Tuesday - 50%
      { pessoa: "Maria Santos", data: "2024-01-10", duracaoHoras: 10 }, // Wednesday - 125%
    ];

    const result = calculateHeatmap(atividades);

    expect(result).toHaveLength(1);
    expect(result[0].pessoa).toBe("Maria Santos");
    expect(result[0].monday).toBe(150); // Sobrecarga
    expect(result[0].tuesday).toBe(50);
    expect(result[0].wednesday).toBe(125); // Sobrecarga
    expect(result[0].thursday).toBe(0);
    expect(result[0].avgUtilization).toBeGreaterThan(0);
  });

  it("deve identificar subutilização em dias específicos", () => {
    const atividades = [
      { pessoa: "Pedro Costa", data: "2024-01-08", duracaoHoras: 2 }, // Monday - 25%
      { pessoa: "Pedro Costa", data: "2024-01-09", duracaoHoras: 1 }, // Tuesday - 12.5%
      { pessoa: "Pedro Costa", data: "2024-01-10", duracaoHoras: 3 }, // Wednesday - 37.5%
    ];

    const result = calculateHeatmap(atividades);

    expect(result).toHaveLength(1);
    expect(result[0].pessoa).toBe("Pedro Costa");
    expect(result[0].monday).toBe(25);
    expect(result[0].tuesday).toBe(13); // Rounded
    expect(result[0].wednesday).toBe(38); // Rounded
    expect(result[0].avgUtilization).toBeLessThan(30);
  });

  it("deve calcular média de utilização corretamente", () => {
    const atividades = [
      { pessoa: "Ana Lima", data: "2024-01-08", duracaoHoras: 8 },  // Monday - 100%
      { pessoa: "Ana Lima", data: "2024-01-09", duracaoHoras: 8 },  // Tuesday - 100%
      { pessoa: "Ana Lima", data: "2024-01-10", duracaoHoras: 8 },  // Wednesday - 100%
      { pessoa: "Ana Lima", data: "2024-01-11", duracaoHoras: 8 },  // Thursday - 100%
      { pessoa: "Ana Lima", data: "2024-01-12", duracaoHoras: 8 },  // Friday - 100%
      // No work on weekend
    ];

    const result = calculateHeatmap(atividades);

    expect(result).toHaveLength(1);
    expect(result[0].pessoa).toBe("Ana Lima");
    expect(result[0].sunday).toBe(0);
    expect(result[0].saturday).toBe(0);
    // Average = (5 days * 8h) / (7 days * 8h) = 40h / 56h = ~71%
    expect(result[0].avgUtilization).toBeCloseTo(71, 0);
  });

  it("deve somar múltiplas atividades no mesmo dia", () => {
    const atividades = [
      { pessoa: "Carlos Souza", data: "2024-01-08", duracaoHoras: 4 },
      { pessoa: "Carlos Souza", data: "2024-01-08", duracaoHoras: 4 },
      { pessoa: "Carlos Souza", data: "2024-01-08", duracaoHoras: 4 }, // Total: 12h = 150%
    ];

    const result = calculateHeatmap(atividades);

    expect(result).toHaveLength(1);
    expect(result[0].pessoa).toBe("Carlos Souza");
    expect(result[0].monday).toBe(150); // 12h / 8h = 150%
  });

  it("deve processar múltiplas pessoas independentemente", () => {
    const atividades = [
      { pessoa: "João", data: "2024-01-08", duracaoHoras: 8 },
      { pessoa: "Maria", data: "2024-01-08", duracaoHoras: 4 },
      { pessoa: "Pedro", data: "2024-01-08", duracaoHoras: 12 },
    ];

    const result = calculateHeatmap(atividades);

    expect(result).toHaveLength(3);
    
    const joao = result.find(p => p.pessoa === "João");
    const maria = result.find(p => p.pessoa === "Maria");
    const pedro = result.find(p => p.pessoa === "Pedro");

    expect(joao?.monday).toBe(100);
    expect(maria?.monday).toBe(50);
    expect(pedro?.monday).toBe(150);
  });

  it("deve ignorar atividades sem pessoa ou data", () => {
    const atividades = [
      { pessoa: "", data: "2024-01-08", duracaoHoras: 8 },
      { pessoa: "João", data: "", duracaoHoras: 8 },
      { pessoa: "Maria", data: "2024-01-08", duracaoHoras: 8 },
    ];

    const result = calculateHeatmap(atividades);

    expect(result).toHaveLength(1);
    expect(result[0].pessoa).toBe("Maria");
  });

  it("deve identificar pessoas cronicamente sobrecarregadas (>85% média)", () => {
    const atividades = [
      { pessoa: "Overworked", data: "2024-01-07", duracaoHoras: 8 },
      { pessoa: "Overworked", data: "2024-01-08", duracaoHoras: 9 },
      { pessoa: "Overworked", data: "2024-01-09", duracaoHoras: 9 },
      { pessoa: "Overworked", data: "2024-01-10", duracaoHoras: 8 },
      { pessoa: "Overworked", data: "2024-01-11", duracaoHoras: 8 },
      { pessoa: "Overworked", data: "2024-01-12", duracaoHoras: 8 },
      { pessoa: "Overworked", data: "2024-01-13", duracaoHoras: 8 },
    ];

    const result = calculateHeatmap(atividades);

    expect(result).toHaveLength(1);
    expect(result[0].avgUtilization).toBeGreaterThan(85);
  });
});
