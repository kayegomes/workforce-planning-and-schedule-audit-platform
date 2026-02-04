import { describe, expect, it } from "vitest";
import { detectConflicts, detectFolgaViolations, detectDeslocamentoRisks } from "./rules";
import type { ProcessedEscala } from "./etl";

describe("Business Rules", () => {
  describe("detectConflicts", () => {
    it("should detect time overlap conflicts", () => {
      const escalas: Array<ProcessedEscala & { id: number }> = [
        {
          id: 1,
          pessoa: "João Silva",
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T09:00:00"),
          fimDt: new Date("2024-01-15T12:00:00"),
          duracaoHoras: 3,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: "Evento A",
          wo: null,
          cidade: "São Paulo",
          uf: null,
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
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T11:00:00"),
          fimDt: new Date("2024-01-15T14:00:00"),
          duracaoHoras: 3,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: "Evento B",
          wo: null,
          cidade: "São Paulo",
          uf: null,
          local: null,
          ehFolga: false,
          ehViagem: false,
          ano: 2024,
          mes: 1,
          semanaIso: 3,
          diaSemana: "Segunda",
        },
      ];

      const conflicts = detectConflicts(escalas);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].pessoa).toBe("João Silva");
      expect(conflicts[0].overlapMinutos).toBe(60); // 11:00-12:00 = 1 hour
    });

    it("should not detect conflicts for different people", () => {
      const escalas: Array<ProcessedEscala & { id: number }> = [
        {
          id: 1,
          pessoa: "João Silva",
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T09:00:00"),
          fimDt: new Date("2024-01-15T12:00:00"),
          duracaoHoras: 3,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: null,
          wo: null,
          cidade: null,
          uf: null,
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
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T11:00:00"),
          fimDt: new Date("2024-01-15T14:00:00"),
          duracaoHoras: 3,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: null,
          wo: null,
          cidade: null,
          uf: null,
          local: null,
          ehFolga: false,
          ehViagem: false,
          ano: 2024,
          mes: 1,
          semanaIso: 3,
          diaSemana: "Segunda",
        },
      ];

      const conflicts = detectConflicts(escalas);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe("detectFolgaViolations", () => {
    it("should detect work during time-off", () => {
      const escalas: Array<ProcessedEscala & { id: number }> = [
        {
          id: 1,
          pessoa: "João Silva",
          tipoItem: "Other Time Off",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T00:00:00"),
          fimDt: new Date("2024-01-16T00:00:00"),
          duracaoHoras: 24,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: null,
          wo: null,
          cidade: null,
          uf: null,
          local: null,
          ehFolga: true,
          ehViagem: false,
          ano: 2024,
          mes: 1,
          semanaIso: 3,
          diaSemana: "Segunda",
        },
        {
          id: 2,
          pessoa: "João Silva",
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T09:00:00"),
          fimDt: new Date("2024-01-15T18:00:00"),
          duracaoHoras: 9,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: "Evento Urgente",
          wo: null,
          cidade: null,
          uf: null,
          local: null,
          ehFolga: false,
          ehViagem: false,
          ano: 2024,
          mes: 1,
          semanaIso: 3,
          diaSemana: "Segunda",
        },
      ];

      const violations = detectFolgaViolations(escalas);

      expect(violations).toHaveLength(1);
      expect(violations[0].pessoa).toBe("João Silva");
      expect(violations[0].tipoFolga).toBe("Other Time Off");
    });
  });

  describe("detectDeslocamentoRisks", () => {
    it("should detect insufficient travel time between cities", () => {
      const escalas: Array<ProcessedEscala & { id: number }> = [
        {
          id: 1,
          pessoa: "João Silva",
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T09:00:00"),
          fimDt: new Date("2024-01-15T12:00:00"),
          duracaoHoras: 3,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: null,
          wo: null,
          cidade: "São Paulo",
          uf: null,
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
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T13:00:00"),
          fimDt: new Date("2024-01-15T18:00:00"),
          duracaoHoras: 5,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: null,
          wo: null,
          cidade: "Rio de Janeiro",
          uf: null,
          local: null,
          ehFolga: false,
          ehViagem: false,
          ano: 2024,
          mes: 1,
          semanaIso: 3,
          diaSemana: "Segunda",
        },
      ];

      const risks = detectDeslocamentoRisks(escalas, 3);

      expect(risks).toHaveLength(1);
      expect(risks[0].pessoa).toBe("João Silva");
      expect(risks[0].cidadePrev).toBe("São Paulo");
      expect(risks[0].cidadeNext).toBe("Rio de Janeiro");
      expect(risks[0].gapHoras).toBe(1); // 12:00 to 13:00 = 1 hour
    });

    it("should not detect risk when gap is sufficient", () => {
      const escalas: Array<ProcessedEscala & { id: number }> = [
        {
          id: 1,
          pessoa: "João Silva",
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T09:00:00"),
          fimDt: new Date("2024-01-15T12:00:00"),
          duracaoHoras: 3,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: null,
          wo: null,
          cidade: "São Paulo",
          uf: null,
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
          tipoItem: "Booking",
          data: new Date("2024-01-15"),
          inicioDt: new Date("2024-01-15T16:00:00"),
          fimDt: new Date("2024-01-15T18:00:00"),
          duracaoHoras: 2,
          funcao: null,
          descricaoItem: null,
          status: null,
          canal: null,
          cliente: null,
          eventoPrograma: null,
          wo: null,
          cidade: "Rio de Janeiro",
          uf: null,
          local: null,
          ehFolga: false,
          ehViagem: false,
          ano: 2024,
          mes: 1,
          semanaIso: 3,
          diaSemana: "Segunda",
        },
      ];

      const risks = detectDeslocamentoRisks(escalas, 3);

      expect(risks).toHaveLength(0);
    });
  });
});
