import { describe, expect, it } from "vitest";
import { processAtividades, processEventos, mergeEscalasWithEventos } from "./etl";
import type { RawAtividade, RawEvento } from "./etl";

describe("ETL Pipeline", () => {
  describe("processAtividades", () => {
    it("should process valid atividades correctly", () => {
      const rawData: RawAtividade[] = [
        {
          Nome: "João Silva",
          "Tipo de Atividade": "Booking",
          Data: "15/01/2024",
          Início: "09:00",
          Fim: "18:00",
          "WO#": "WO-001",
          Função: "Cinegrafista",
          Cidade: "Rio de Janeiro",
          UF: "RJ",
        },
      ];

      const result = processAtividades(rawData);

      expect(result).toHaveLength(1);
      expect(result[0].pessoa).toBe("João Silva");
      expect(result[0].tipoItem).toBe("Booking");
      expect(result[0].duracaoHoras).toBe(9);
      expect(result[0].cidade).toBe("Rio de Janeiro");
      expect(result[0].ehFolga).toBe(false);
    });

    it("should handle day overflow (midnight crossing)", () => {
      const rawData: RawAtividade[] = [
        {
          Nome: "Maria Santos",
          "Tipo de Atividade": "Booking",
          Data: "15/01/2024",
          Início: "22:00",
          Fim: "02:00",
          "WO#": "WO-002",
        },
      ];

      const result = processAtividades(rawData);

      expect(result).toHaveLength(1);
      expect(result[0].duracaoHoras).toBe(4); // 22:00 to 02:00 = 4 hours
    });

    it("should identify time-off activities", () => {
      const rawData: RawAtividade[] = [
        {
          Nome: "Pedro Costa",
          "Tipo de Atividade": "Other Time Off",
          Data: "15/01/2024",
          Início: "00:00",
          Fim: "23:59",
        },
      ];

      const result = processAtividades(rawData);

      expect(result).toHaveLength(1);
      expect(result[0].ehFolga).toBe(true);
    });

    it("should skip rows with missing critical data", () => {
      const rawData: RawAtividade[] = [
        {
          Nome: "João Silva",
          // Missing Tipo de Atividade, Data, etc.
        },
      ];

      const result = processAtividades(rawData);

      expect(result).toHaveLength(0);
    });
  });

  describe("processEventos", () => {
    it("should process and deduplicate eventos", () => {
      const rawData: RawEvento[] = [
        {
          "WO#": "WO-001",
          Data: "15/01/2024",
          "Tipo de Evento": "Futebol",
          Cidade: "São Paulo",
        },
        {
          "WO#": "WO-001",
          Data: "15/01/2024",
          "Tipo de Evento": "Futebol",
          Cidade: "São Paulo",
        },
      ];

      const result = processEventos(rawData);

      expect(result.size).toBe(1);
      const evento = result.get("WO-001|2024-01-15");
      expect(evento).toBeDefined();
      expect(evento?.wo).toBe("WO-001");
      expect(evento?.tipoEvento).toBe("Futebol");
    });
  });

  describe("mergeEscalasWithEventos", () => {
    it("should enrich escalas with evento data", () => {
      const escalas = [
        {
          pessoa: "João Silva",
          tipoItem: "Booking",
          wo: "WO-001",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T09:00:00"),
          fimDt: new Date("2024-01-15T18:00:00"),
          duracaoHoras: 9,
          cidade: null,
          uf: null,
          local: null,
          canal: null,
          eventoPrograma: null,
          funcao: null,
          descricaoItem: null,
          status: null,
          cliente: null,
          ehFolga: false,
          ehViagem: false,
          ano: 2024,
          mes: 1,
          semanaIso: 3,
          diaSemana: "Segunda",
        },
      ];

      const eventos = new Map();
      eventos.set("WO-001|2024-01-15", {
        wo: "WO-001",
        data: new Date("2024-01-15"),
        inicio: "09:00",
        fim: "18:00",
        tipoEvento: "Futebol",
        cidade: "São Paulo",
        uf: "SP",
        canal: "Globo",
        eventoPrograma: "Campeonato Brasileiro",
        produto: null,
        local: null,
        tipoProducao: null,
        funcao: null,
        nomeRecurso: null,
      });

      const result = mergeEscalasWithEventos(escalas, eventos);

      expect(result).toHaveLength(1);
      expect(result[0].cidade).toBe("São Paulo");
      expect(result[0].uf).toBe("SP");
      expect(result[0].canal).toBe("Globo");
      expect(result[0].eventoPrograma).toBe("Campeonato Brasileiro");
    });
  });
});
