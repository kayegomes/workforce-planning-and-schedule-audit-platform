import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function Heatmap() {
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const runsQuery = trpc.runs.list.useQuery();
  const heatmapQuery = trpc.analytics.getHeatmapData.useQuery(
    { runId: parseInt(selectedRunId) },
    { enabled: !!selectedRunId }
  );

  const runs = runsQuery.data || [];
  const response = heatmapQuery.data;
  const heatmapData = response?.heatmapData || [];

  // Helper to get color based on utilization percentage
  const getHeatColor = (percentage: number) => {
    if (percentage === 0) return "bg-gray-100 text-gray-400";
    if (percentage < 50) return "bg-green-100 text-green-800";
    if (percentage < 80) return "bg-yellow-100 text-yellow-800";
    if (percentage < 100) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800 font-bold";
  };

  // Helper to determine overload status
  const getOverloadStatus = (avgUtilization: number) => {
    if (avgUtilization > 100) return { label: "Sobrecarga Crítica", icon: TrendingUp, color: "text-red-600" };
    if (avgUtilization > 80) return { label: "Alta Utilização", icon: TrendingUp, color: "text-orange-600" };
    if (avgUtilization < 30) return { label: "Subutilização", icon: TrendingDown, color: "text-blue-600" };
    return { label: "Normal", icon: Minus, color: "text-green-600" };
  };

  // Sort by average utilization descending
  const sortedData = [...heatmapData].sort((a, b) => b.avgUtilization - a.avgUtilization);

  // Calculate statistics
  const overloadedCount = heatmapData.filter((p: any) => p.avgUtilization > 100).length;
  const highUtilCount = heatmapData.filter((p: any) => p.avgUtilization > 80 && p.avgUtilization <= 100).length;
  const underutilizedCount = heatmapData.filter((p: any) => p.avgUtilization < 30).length;

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Heatmap de Sobrecarga</h1>
        <p className="text-muted-foreground">
          Visualize padrões de utilização por dia da semana e identifique pessoas cronicamente sobrecarregadas ou subutilizadas
        </p>
      </div>

      {/* Run Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Selecionar Execução</CardTitle>
          <CardDescription>Escolha uma execução para analisar o padrão de sobrecarga</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma execução..." />
            </SelectTrigger>
            <SelectContent>
              {runs.map((run: any) => (
                <SelectItem key={run.id} value={run.id.toString()}>
                  {new Date(run.createdAt).toLocaleDateString("pt-BR")} - {run.totalAtividades} atividades
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      {selectedRunId && response && heatmapData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pessoas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{heatmapData.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sobrecarga Crítica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overloadedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">&gt; 100% utilização média</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alta Utilização</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{highUtilCount}</div>
              <p className="text-xs text-muted-foreground mt-1">80-100% utilização média</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subutilização</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{underutilizedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">&lt; 30% utilização média</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {heatmapQuery.isLoading && selectedRunId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Carregando dados do heatmap...</AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!selectedRunId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Selecione uma execução para visualizar o heatmap de sobrecarga</AlertDescription>
        </Alert>
      )}

      {/* Heatmap Table */}
      {selectedRunId && response && heatmapData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mapa de Calor - Utilização por Dia da Semana</CardTitle>
            <CardDescription>
              Percentual de utilização baseado em 8h/dia. Cores indicam intensidade: verde (baixo), amarelo (médio), laranja (alto), vermelho (crítico)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Pessoa</th>
                    <th className="text-center p-3 font-semibold">Dom</th>
                    <th className="text-center p-3 font-semibold">Seg</th>
                    <th className="text-center p-3 font-semibold">Ter</th>
                    <th className="text-center p-3 font-semibold">Qua</th>
                    <th className="text-center p-3 font-semibold">Qui</th>
                    <th className="text-center p-3 font-semibold">Sex</th>
                    <th className="text-center p-3 font-semibold">Sáb</th>
                    <th className="text-center p-3 font-semibold">Média</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((person) => {
                    const status = getOverloadStatus(person.avgUtilization);
                    const StatusIcon = status.icon;
                    return (
                      <tr key={person.pessoa} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{person.pessoa}</td>
                        <td className={`text-center p-3 ${getHeatColor(person.sunday)}`}>
                          {person.sunday}%
                        </td>
                        <td className={`text-center p-3 ${getHeatColor(person.monday)}`}>
                          {person.monday}%
                        </td>
                        <td className={`text-center p-3 ${getHeatColor(person.tuesday)}`}>
                          {person.tuesday}%
                        </td>
                        <td className={`text-center p-3 ${getHeatColor(person.wednesday)}`}>
                          {person.wednesday}%
                        </td>
                        <td className={`text-center p-3 ${getHeatColor(person.thursday)}`}>
                          {person.thursday}%
                        </td>
                        <td className={`text-center p-3 ${getHeatColor(person.friday)}`}>
                          {person.friday}%
                        </td>
                        <td className={`text-center p-3 ${getHeatColor(person.saturday)}`}>
                          {person.saturday}%
                        </td>
                        <td className={`text-center p-3 font-bold ${getHeatColor(person.avgUtilization)}`}>
                          {person.avgUtilization}%
                        </td>
                        <td className="p-3">
                          <div className={`flex items-center gap-2 ${status.color}`}>
                            <StatusIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">{status.label}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {selectedRunId && response && heatmapData.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Insights e Recomendações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overloadedCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{overloadedCount} pessoa(s)</strong> com sobrecarga crítica (&gt;100% utilização média).
                  Considere redistribuir atividades ou contratar reforços.
                </AlertDescription>
              </Alert>
            )}
            {highUtilCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{highUtilCount} pessoa(s)</strong> com alta utilização (80-100%).
                  Monitore para evitar burnout e conflitos de agenda.
                </AlertDescription>
              </Alert>
            )}
            {underutilizedCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{underutilizedCount} pessoa(s)</strong> subutilizada(s) (&lt;30%).
                  Oportunidade para realocar atividades ou otimizar equipe.
                </AlertDescription>
              </Alert>
            )}
            {overloadedCount === 0 && highUtilCount === 0 && underutilizedCount === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Distribuição equilibrada! Nenhuma pessoa com sobrecarga crítica ou subutilização extrema.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
