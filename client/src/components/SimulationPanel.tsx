import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Loader2, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SimulationPanelProps {
  gradeId: number;
  runId: number | null;
  funcao: string;
  profissionais: string[];
  excecoes: Array<{
    pessoa: string;
    tipo: string;
    dataInicio: string;
    dataFim: string;
  }>;
}

export default function SimulationPanel({
  gradeId,
  runId,
  funcao,
  profissionais,
  excecoes,
}: SimulationPanelProps) {
  const [pessoaRemover, setPessoaRemover] = useState<string>("");
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const simulateMutation = trpc.grades.simulateRemoval.useMutation();

  const handleSimulate = async () => {
    if (!pessoaRemover) {
      toast.error("Selecione uma pessoa para simular a remoção");
      return;
    }

    try {
      const result = await simulateMutation.mutateAsync({
        gradeId,
        runId: runId || undefined,
        funcao,
        profissionais,
        excecoes,
        pessoaRemover,
      });

      setSimulationResult(result);
      toast.success("Simulação concluída!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao executar simulação");
    }
  };

  const getResultadoIcon = (resultado: string) => {
    if (resultado === "suficiente") return <CheckCircle2 className="h-16 w-16 text-green-600" />;
    if (resultado === "insuficiente") return <AlertCircle className="h-16 w-16 text-orange-600" />;
    return <XCircle className="h-16 w-16 text-red-600" />;
  };

  const getResultadoColor = (resultado: string) => {
    if (resultado === "suficiente") return "text-green-600";
    if (resultado === "insuficiente") return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Simulation Input */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">
            Selecione a pessoa para remover
          </label>
          <Select value={pessoaRemover} onValueChange={setPessoaRemover}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma pessoa..." />
            </SelectTrigger>
            <SelectContent>
              {profissionais.map((pessoa) => (
                <SelectItem key={pessoa} value={pessoa}>
                  {pessoa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleSimulate}
          disabled={!pessoaRemover || simulateMutation.isPending}
          className="min-w-[150px]"
        >
          {simulateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Simulando...
            </>
          ) : (
            "Simular Remoção"
          )}
        </Button>
      </div>

      {/* Simulation Results */}
      {simulationResult && (
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold">
            Resultado da Simulação: Remover "{simulationResult.pessoaRemovida}"
          </h3>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Scenario */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-sm text-gray-600 mb-3">Cenário Atual</h4>
              <div className="flex items-center justify-center py-4">
                <div className="text-center">
                  {getResultadoIcon(simulationResult.cenarioAtual.resultado)}
                  <p className={`text-xl font-bold mt-2 capitalize ${getResultadoColor(simulationResult.cenarioAtual.resultado)}`}>
                    {simulationResult.cenarioAtual.resultado}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Eventos:</span>
                  <span className="font-semibold">{simulationResult.cenarioAtual.totalEventos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Com Cobertura:</span>
                  <span className="font-semibold text-green-600">{simulationResult.cenarioAtual.eventosComCobertura}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sem Cobertura:</span>
                  <span className="font-semibold text-red-600">{simulationResult.cenarioAtual.eventosSemCobertura}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxa Cobertura:</span>
                  <span className="font-semibold">{simulationResult.impacto.taxaCoberturaAtual.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Simulated Scenario */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <h4 className="font-semibold text-sm text-gray-600 mb-3">Cenário Simulado (Sem {simulationResult.pessoaRemovida})</h4>
              <div className="flex items-center justify-center py-4">
                <div className="text-center">
                  {getResultadoIcon(simulationResult.cenarioSimulado.resultado)}
                  <p className={`text-xl font-bold mt-2 capitalize ${getResultadoColor(simulationResult.cenarioSimulado.resultado)}`}>
                    {simulationResult.cenarioSimulado.resultado}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Eventos:</span>
                  <span className="font-semibold">{simulationResult.cenarioSimulado.totalEventos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Com Cobertura:</span>
                  <span className="font-semibold text-green-600">{simulationResult.cenarioSimulado.eventosComCobertura}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sem Cobertura:</span>
                  <span className="font-semibold text-red-600">{simulationResult.cenarioSimulado.eventosSemCobertura}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxa Cobertura:</span>
                  <span className="font-semibold">{simulationResult.impacto.taxaCoberturaSimulada.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Impact Summary */}
          <div className="border rounded-lg p-4 bg-yellow-50">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              {simulationResult.impacto.diferencaTaxaCobertura < 0 ? (
                <TrendingDown className="h-5 w-5 text-red-600" />
              ) : (
                <TrendingUp className="h-5 w-5 text-green-600" />
              )}
              Impacto da Remoção
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Eventos Adicionais Sem Cobertura:</span>
                <span className={`font-bold ${simulationResult.impacto.eventosSemCoberturaAdicional > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {simulationResult.impacto.eventosSemCoberturaAdicional > 0 ? '+' : ''}{simulationResult.impacto.eventosSemCoberturaAdicional}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Variação na Taxa de Cobertura:</span>
                <span className={`font-bold ${simulationResult.impacto.diferencaTaxaCobertura < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {simulationResult.impacto.diferencaTaxaCobertura > 0 ? '+' : ''}{simulationResult.impacto.diferencaTaxaCobertura.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Dias Afetados Negativamente:</span>
                <span className="font-bold">{simulationResult.impacto.diasCriticos.length}</span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {simulationResult.recomendacoes && simulationResult.recomendacoes.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3">Recomendações</h4>
              <ul className="space-y-2">
                {simulationResult.recomendacoes.map((rec: string, index: number) => (
                  <li key={index} className="flex items-start text-sm">
                    <span className="mr-2">{rec.startsWith('✅') ? '✅' : rec.startsWith('⚠️') ? '⚠️' : rec.startsWith('🚨') ? '🚨' : '•'}</span>
                    <span>{rec.replace(/^[✅⚠️🚨]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Critical Days Details */}
          {simulationResult.impacto.diasCriticos.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3">Dias Críticos Afetados</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Data</th>
                      <th className="text-right p-2">Eventos Novos Sem Cobertura</th>
                      <th className="text-right p-2">Profissionais Disponíveis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.impacto.diasCriticos.map((dia: any, index: number) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{new Date(dia.data).toLocaleDateString()}</td>
                        <td className="text-right p-2 text-red-600 font-semibold">+{dia.eventosNovos}</td>
                        <td className="text-right p-2">{dia.profissionaisDisponiveis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button
            onClick={() => {
              setSimulationResult(null);
              setPessoaRemover("");
            }}
            variant="outline"
            className="w-full"
          >
            Nova Simulação
          </Button>
        </div>
      )}
    </div>
  );
}
