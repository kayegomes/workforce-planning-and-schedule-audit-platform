import { describe, it, expect } from "vitest";
import { simularRemocaoProfissional, GradeEvento, FolgaInfo, ExcecaoProfissional } from "./grades";

describe("Simulações de Capacity Planning", () => {
  const eventos: GradeEvento[] = [
    { wo: "WO001", data: new Date("2024-03-01"), tipoEvento: "Jogo", canal: "ESPN", cidade: "São Paulo", funcaoRequerida: "Narrador" },
    { wo: "WO002", data: new Date("2024-03-01"), tipoEvento: "Jogo", canal: "SporTV", cidade: "Rio", funcaoRequerida: "Narrador" },
    { wo: "WO003", data: new Date("2024-03-02"), tipoEvento: "Jogo", canal: "ESPN", cidade: "São Paulo", funcaoRequerida: "Narrador" },
    { wo: "WO004", data: new Date("2024-03-02"), tipoEvento: "Jogo", canal: "SporTV", cidade: "Rio", funcaoRequerida: "Narrador" },
    { wo: "WO005", data: new Date("2024-03-02"), tipoEvento: "Jogo", canal: "Band", cidade: "Brasília", funcaoRequerida: "Narrador" },
  ];

  const profissionais = ["João Silva", "Maria Santos", "Pedro Costa", "Ana Lima"];
  const folgas: FolgaInfo[] = [];
  const excecoes: ExcecaoProfissional[] = [];

  it("deve simular remoção sem impacto quando há capacidade suficiente", () => {
    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionais,
      folgas,
      excecoes,
      "Ana Lima"
    );

    expect(resultado.pessoaRemovida).toBe("Ana Lima");
    expect(resultado.cenarioAtual.totalEventos).toBe(5);
    expect(resultado.cenarioSimulado.totalEventos).toBe(5);
    
    // With 4 people and max 3 events per day, should still have coverage
    expect(resultado.impacto.eventosSemCoberturaAdicional).toBe(0);
    expect(resultado.cenarioAtual.resultado).toBe("suficiente");
    expect(resultado.cenarioSimulado.resultado).toBe("suficiente");
  });

  it("deve identificar impacto negativo quando remoção causa déficit", () => {
    // Scenario with only 2 professionals and 2 events per day
    const profissionaisLimitados = ["João Silva", "Maria Santos"];
    
    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionaisLimitados,
      folgas,
      excecoes,
      "Maria Santos"
    );

    expect(resultado.pessoaRemovida).toBe("Maria Santos");
    expect(resultado.impacto.eventosSemCoberturaAdicional).toBeGreaterThan(0);
    expect(resultado.impacto.diferencaTaxaCobertura).toBeLessThan(0);
    expect(resultado.cenarioSimulado.resultado).not.toBe("suficiente");
  });

  it("deve calcular corretamente a diferença de taxa de cobertura", () => {
    const profissionaisLimitados = ["João Silva", "Maria Santos", "Pedro Costa"];
    
    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionaisLimitados,
      folgas,
      excecoes,
      "Pedro Costa"
    );

    expect(resultado.impacto.taxaCoberturaAtual).toBeGreaterThan(0);
    expect(resultado.impacto.taxaCoberturaSimulada).toBeGreaterThan(0);
    expect(resultado.impacto.diferencaTaxaCobertura).toBe(
      resultado.impacto.taxaCoberturaSimulada - resultado.impacto.taxaCoberturaAtual
    );
  });

  it("deve identificar dias críticos afetados pela remoção", () => {
    const profissionaisLimitados = ["João Silva", "Maria Santos", "Pedro Costa"];
    
    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionaisLimitados,
      folgas,
      excecoes,
      "Pedro Costa"
    );

    expect(resultado.impacto.diasCriticos).toBeDefined();
    expect(Array.isArray(resultado.impacto.diasCriticos)).toBe(true);
    
    // Should identify March 2nd as critical (3 events, only 2 people after removal)
    const diasCriticosCount = resultado.impacto.diasCriticos.length;
    expect(diasCriticosCount).toBeGreaterThan(0);
  });

  it("deve gerar recomendações apropriadas quando há impacto", () => {
    const profissionaisLimitados = ["João Silva", "Maria Santos"];
    
    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionaisLimitados,
      folgas,
      excecoes,
      "Maria Santos"
    );

    expect(resultado.recomendacoes).toBeDefined();
    expect(resultado.recomendacoes.length).toBeGreaterThan(0);
    
    // Should warn about the removal impact
    const hasWarning = resultado.recomendacoes.some(rec => 
      rec.includes("deixaria") || rec.includes("cairia") || rec.includes("afetados")
    );
    expect(hasWarning).toBe(true);
  });

  it("deve gerar recomendações positivas quando não há impacto", () => {
    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionais,
      folgas,
      excecoes,
      "Ana Lima"
    );

    expect(resultado.recomendacoes).toBeDefined();
    expect(resultado.recomendacoes.length).toBeGreaterThan(0);
    
    // Should indicate no impact
    const hasPositiveMessage = resultado.recomendacoes.some(rec => 
      rec.includes("não impacta") || rec.includes("suficiente")
    );
    expect(hasPositiveMessage).toBe(true);
  });

  it("deve considerar folgas na simulação", () => {
    const folgasComFolga: FolgaInfo[] = [
      { pessoa: "João Silva", data: new Date("2024-03-01"), tipoFolga: "Day Off" },
    ];

    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionais,
      folgasComFolga,
      excecoes,
      "Maria Santos"
    );

    // With João on leave on March 1st and removing Maria, should have less coverage
    expect(resultado.cenarioSimulado.eventosSemCobertura).toBeGreaterThanOrEqual(
      resultado.cenarioAtual.eventosSemCobertura
    );
  });

  it("deve considerar exceções na simulação", () => {
    const excecoesComLicenca: ExcecaoProfissional[] = [
      {
        pessoa: "Pedro Costa",
        tipo: "licenca_medica",
        dataInicio: new Date("2024-03-01"),
        dataFim: new Date("2024-03-02"),
      },
    ];

    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionais,
      folgas,
      excecoesComLicenca,
      "Ana Lima"
    );

    // With Pedro on medical leave and removing Ana, coverage should be affected
    expect(resultado.cenarioSimulado.profissionaisEmExcecao).toBeGreaterThan(0);
  });

  it("deve manter consistência entre cenários atual e simulado", () => {
    const resultado = simularRemocaoProfissional(
      eventos,
      "Narrador",
      profissionais,
      folgas,
      excecoes,
      "João Silva"
    );

    // Both scenarios should have same number of events
    expect(resultado.cenarioAtual.totalEventos).toBe(resultado.cenarioSimulado.totalEventos);
    
    // Simulated scenario should have one less professional
    expect(resultado.cenarioSimulado.totalProfissionais).toBe(
      resultado.cenarioAtual.totalProfissionais - 1
    );
  });
});
