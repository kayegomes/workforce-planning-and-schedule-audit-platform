import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function History() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: runs, isLoading: runsLoading } = trpc.history.getAllRuns.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );

  const { data: kpiEvolution, isLoading: kpiLoading } = trpc.history.getKpiEvolution.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: aggregatedStats, isLoading: statsLoading } = trpc.history.getAggregatedStats.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (authLoading || runsLoading || kpiLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  // Prepare chart data
  const chartData = kpiEvolution?.map(item => ({
    data: format(new Date(item.data), "dd/MM"),
    "Conflitos": item.alertasConflito,
    "Folga": item.alertasFolga,
    "Deslocamento": item.alertasDeslocamento,
    "Interjornada": item.alertasInterjornada,
    "Horas": Number(item.horasAtividades),
    "Eventos": item.totalEventos,
    "Atividades": item.totalAtividades,
  })) || [];

  // Calculate trend (compare last vs first)
  const getTrend = (field: string) => {
    if (!kpiEvolution || kpiEvolution.length < 2) return null;
    const first = kpiEvolution[0];
    const last = kpiEvolution[kpiEvolution.length - 1];
    if (!first || !last) return null;
    
    const firstValue = (first as any)[field] || 0;
    const lastValue = (last as any)[field] || 0;
    
    if (firstValue === 0) return null;
    const change = ((lastValue - firstValue) / firstValue) * 100;
    return { change, direction: change > 0 ? "up" : change < 0 ? "down" : "stable" };
  };

  const TrendIcon = ({ trend }: { trend: ReturnType<typeof getTrend> }) => {
    if (!trend) return <Minus className="h-4 w-4 text-gray-400" />;
    if (trend.direction === "up") return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (trend.direction === "down") return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container py-4">
          <Button variant="ghost" onClick={() => setLocation("/")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Histórico Multi-Run</h1>
          <p className="text-gray-600">Visão macro de todas as execuções ao longo do tempo</p>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* Aggregated Stats */}
        {aggregatedStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total de Execuções</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aggregatedStats.totalRuns}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Horas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(aggregatedStats.totalHorasAtividades).toFixed(1)}h</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aggregatedStats.totalEventos}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Conflitos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{aggregatedStats.totalConflitos}</div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <TrendIcon trend={getTrend("alertasConflito")} />
                  {getTrend("alertasConflito") && (
                    <span>{Math.abs(getTrend("alertasConflito")!.change).toFixed(1)}%</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Média WOs s/ Evento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Number(aggregatedStats.avgPercentualWOsSemEvento).toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Evolution Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Alertas</CardTitle>
              <CardDescription>Tendência de alertas ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Conflitos" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="Folga" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="Deslocamento" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="Interjornada" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução de Horas Trabalhadas</CardTitle>
              <CardDescription>Distribuição de carga de trabalho</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Horas" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução de Eventos e Atividades</CardTitle>
              <CardDescription>Volume de eventos e atividades processadas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Eventos" stroke="#06b6d4" strokeWidth={2} />
                  <Line type="monotone" dataKey="Atividades" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Runs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Execuções ({runs?.length || 0})</CardTitle>
            <CardDescription>Todas as execuções realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            {runs && runs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Eventos</TableHead>
                      <TableHead className="text-right">Conflitos</TableHead>
                      <TableHead className="text-right">Folga</TableHead>
                      <TableHead className="text-right">Deslocamento</TableHead>
                      <TableHead className="text-right">Interjornada</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>{format(new Date(run.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              run.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : run.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : run.status === "processing"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {run.status === "completed"
                              ? "Concluído"
                              : run.status === "failed"
                              ? "Falhou"
                              : run.status === "processing"
                              ? "Processando"
                              : "Pendente"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{Number(run.totalHorasAtividades || 0).toFixed(1)}h</TableCell>
                        <TableCell className="text-right">{run.totalEventos || 0}</TableCell>
                        <TableCell className="text-right text-red-600 font-medium">{run.totalConflitos || 0}</TableCell>
                        <TableCell className="text-right text-orange-600">{run.totalViolacoesFolga || 0}</TableCell>
                        <TableCell className="text-right text-blue-600">{run.totalRiscosDeslocamento || 0}</TableCell>
                        <TableCell className="text-right text-purple-600">{run.totalInterjornada || 0}</TableCell>
                        <TableCell className="text-right">
                          {run.status === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/dashboard/${run.id}`)}
                            >
                              Ver Dashboard
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Nenhuma execução encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
