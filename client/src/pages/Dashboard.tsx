import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Clock, UserX, TrendingUp, ArrowLeft, Loader2, Moon, Plane, FileQuestion } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery(
    { runId: Number(runId) },
    { enabled: !!runId && isAuthenticated }
  );

  const { data: trends, isLoading: trendsLoading } = trpc.dashboard.getWeeklyTrends.useQuery(
    { runId: Number(runId) },
    { enabled: !!runId && isAuthenticated }
  );

  const { data: topConflicts, isLoading: conflictsLoading } = trpc.dashboard.getTopConflicts.useQuery(
    { runId: Number(runId) },
    { enabled: !!runId && isAuthenticated }
  );

  const { data: topFolga, isLoading: folgaLoading } = trpc.dashboard.getTopFolgaViolations.useQuery(
    { runId: Number(runId) },
    { enabled: !!runId && isAuthenticated }
  );

  const { data: topDeslocamento, isLoading: deslocamentoLoading } = trpc.dashboard.getTopDeslocamentoRisks.useQuery(
    { runId: Number(runId) },
    { enabled: !!runId && isAuthenticated }
  );

  if (authLoading || statsLoading) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" onClick={() => setLocation("/")} className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Executivo</h1>
              <p className="text-gray-600">Análise de escalas e detecção de alertas</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLocation(`/conflicts/${runId}`)}>
                Ver Conflitos
              </Button>
              <Button variant="outline" onClick={() => setLocation(`/folga/${runId}`)}>
                Ver Violações de Folga
              </Button>
              <Button variant="outline" onClick={() => setLocation(`/interjornada/${runId}`)}>
                Ver Interjornada
              </Button>
              <Button variant="outline" onClick={() => setLocation(`/deslocamento/${runId}`)}>
                Ver Riscos de Deslocamento
              </Button>
              <Button variant="outline" onClick={() => setLocation(`/wos-sem-elenco/${runId}`)}>
                Ver WOs sem Elenco
              </Button>
              <Button className="bg-[#0f172a] text-white hover:bg-[#1e293b]" onClick={() => setLocation(`/roster-planning/${runId}`)}>
                Planejamento de Folgas
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Atividades</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalHorasAtividades.toFixed(0) || 0}h</div>
              <p className="text-xs text-muted-foreground">Total de horas de trabalho</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalEventos || 0}</div>
              <p className="text-xs text-muted-foreground">Eventos únicos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Atividades</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalEscalas || 0}</div>
              <p className="text-xs text-muted-foreground">Atividades processadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas Conflito</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.totalConflitos || 0}</div>
              <p className="text-xs text-muted-foreground">Sobreposições de horário</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas Folga</CardTitle>
              <UserX className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats?.totalViolacoesFolga || 0}</div>
              <p className="text-xs text-muted-foreground">Trabalho em dia de folga</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas Deslocamento</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.totalRiscosDeslocamento || 0}</div>
              <p className="text-xs text-muted-foreground">Gap insuficiente entre cidades</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas Interjornada</CardTitle>
              <Moon className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats?.totalInterjornada || 0}</div>
              <p className="text-xs text-muted-foreground">Descanso menor que 11h</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Viagens</CardTitle>
              <Plane className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.totalViagens || 0}</div>
              <p className="text-xs text-muted-foreground">Mudanças de cidade</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setLocation(`/wos-sem-elenco/${runId}`)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">WOs sem Elenco</CardTitle>
              <FileQuestion className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats?.percentualWOsSemElenco?.toFixed(1) || 0}%</div>
              <p className="text-xs text-muted-foreground">{stats?.wosSemElenco || 0} de {stats?.totalWOs || 0} WOs</p>
            </CardContent>
          </Card>
        </div>

        {/* Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Conflitos por Semana</CardTitle>
              <CardDescription>Tendência de conflitos de horário</CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends?.conflictsByWeek || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semana" label={{ value: "Semana", position: "insideBottom", offset: -5 }} />
                    <YAxis label={{ value: "Conflitos", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#dc2626" name="Conflitos" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Horas por Semana</CardTitle>
              <CardDescription>Distribuição de carga de trabalho</CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trends?.hoursByWeek || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semana" label={{ value: "Semana", position: "insideBottom", offset: -5 }} />
                    <YAxis label={{ value: "Horas", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="horas" fill="#2563eb" name="Horas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Conflitos</CardTitle>
              <CardDescription>Pessoas com mais conflitos de horário</CardDescription>
            </CardHeader>
            <CardContent>
              {conflictsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {topConflicts?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{item.pessoa}</span>
                      <span className="text-sm text-red-600 font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 Violações de Folga</CardTitle>
              <CardDescription>Pessoas com mais trabalho em folga</CardDescription>
            </CardHeader>
            <CardContent>
              {folgaLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {topFolga?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{item.pessoa}</span>
                      <span className="text-sm text-orange-600 font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 Riscos de Deslocamento</CardTitle>
              <CardDescription>Pessoas com mais gaps insuficientes</CardDescription>
            </CardHeader>
            <CardContent>
              {deslocamentoLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {topDeslocamento?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{item.pessoa}</span>
                      <span className="text-sm text-yellow-600 font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
