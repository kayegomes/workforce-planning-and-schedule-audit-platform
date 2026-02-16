import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, User, Clock, AlertTriangle, UserX, TrendingUp, Moon, Plane } from "lucide-react";
import { useParams, useLocation, useSearch } from "wouter";
import { format } from "date-fns";
import TrendAnalysisSection from "@/components/TrendAnalysisSection";

export default function PersonProfile() {
  const { runId } = useParams<{ runId: string }>();
  const search = useSearch();
  const pessoa = new URLSearchParams(search).get("pessoa");
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: profile, isLoading: profileLoading } = trpc.profile.getPersonProfile.useQuery(
    { runId: Number(runId), pessoa: pessoa || "" },
    { enabled: !!runId && !!pessoa && isAuthenticated }
  );

  const { data: activities, isLoading: activitiesLoading } = trpc.profile.getPersonActivities.useQuery(
    { runId: Number(runId), pessoa: pessoa || "", limit: 100 },
    { enabled: !!runId && !!pessoa && isAuthenticated }
  );

  if (authLoading || profileLoading) {
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

  if (!pessoa) {
    setLocation(`/dashboard/${runId}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container py-4">
          <Button variant="ghost" onClick={() => setLocation(`/dashboard/${runId}`)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pessoa}</h1>
              <p className="text-gray-600">Perfil Individual - Estatísticas e Histórico</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Utilization Card */}
        {profile && profile.horasDisponiveis > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Acompanhamento de Utilização</CardTitle>
              <CardDescription>Horas trabalhadas vs. horas disponíveis no período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold text-blue-600">{profile.percentualUtilizacao}%</span>
                    <span className="text-sm text-gray-600">de utilização</span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Horas trabalhadas:</span>
                      <span className="font-medium">{profile.totalHoras.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Horas disponíveis:</span>
                      <span className="font-medium">{profile.horasDisponiveis.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Horas livres:</span>
                      <span className="font-medium">{(profile.horasDisponiveis - profile.totalHoras).toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
                <div className="relative w-32 h-32">
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#e5e7eb"
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#3b82f6"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - profile.percentualUtilizacao / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trend Analysis */}
        <TrendAnalysisSection runId={Number(runId)} pessoa={pessoa} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Horas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile?.totalHoras.toFixed(0) || 0}h</div>
              <p className="text-xs text-muted-foreground">{profile?.totalAtividades || 0} atividades</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conflitos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{profile?.totalConflitos || 0}</div>
              <p className="text-xs text-muted-foreground">Sobreposições</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Violações de Folga</CardTitle>
              <UserX className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{profile?.totalViolacoesFolga || 0}</div>
              <p className="text-xs text-muted-foreground">Trabalho em folga</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deslocamentos</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{profile?.totalRiscosDeslocamento || 0}</div>
              <p className="text-xs text-muted-foreground">Riscos de gap</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Interjornada</CardTitle>
              <Moon className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{profile?.totalInterjornada || 0}</div>
              <p className="text-xs text-muted-foreground">Descanso insuficiente</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Viagens</CardTitle>
              <Plane className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{profile?.totalViagens || 0}</div>
              <p className="text-xs text-muted-foreground">Mudanças de cidade</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Atividades</CardTitle>
            <CardDescription>
              Últimas {activities?.length || 0} atividades registradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !activities || activities.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Nenhuma atividade encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Evento/Programa</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>{format(new Date(activity.data), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{format(new Date(activity.inicioDt), "HH:mm")}</TableCell>
                        <TableCell>{format(new Date(activity.fimDt), "HH:mm")}</TableCell>
                        <TableCell>{Number(activity.duracaoHoras).toFixed(1)}h</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            activity.ehFolga ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                          }`}>
                            {activity.ehFolga ? "Folga" : "Trabalho"}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{activity.eventoPrograma || "-"}</TableCell>
                        <TableCell>{activity.cidade || "-"}</TableCell>
                        <TableCell>{activity.canal || "-"}</TableCell>
                        <TableCell>{activity.status || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
