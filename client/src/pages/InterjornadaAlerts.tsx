import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Moon } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { AlertFilters, AlertFiltersState } from "@/components/AlertFilters";
import { useState } from "react";

export default function InterjornadaAlerts() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<AlertFiltersState>({});

  const { data: alerts, isLoading } = trpc.alerts.getInterjornadaViolations.useQuery(
    { 
      runId: Number(runId), 
      limit: 200,
      ...filters
    },
    { enabled: !!runId && isAuthenticated }
  );

  if (authLoading || isLoading) {
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
          <Button variant="ghost" onClick={() => setLocation(`/dashboard/${runId}`)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <Moon className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Alertas de Interjornada</h1>
              <p className="text-gray-600">Descanso insuficiente entre atividades (menor que 11h)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <AlertFilters
          filters={filters}
          onFiltersChange={setFilters}
          canais={["SporTV", "SporTV 2", "SporTV 3", "Premiere", "Globo"]}
          funcoes={["Narrador", "Comentarista", "Repórter", "Apresentador"]}
        />
        <Card>
          <CardHeader>
            <CardTitle>Violações de Interjornada Detectadas</CardTitle>
            <CardDescription>
              Total de {alerts?.length || 0} violações encontradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!alerts || alerts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Moon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma violação de interjornada detectada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Data Anterior</TableHead>
                      <TableHead>Fim Atividade Anterior</TableHead>
                      <TableHead>Início Próxima Atividade</TableHead>
                      <TableHead>Descanso (horas)</TableHead>
                      <TableHead>Mínimo Exigido</TableHead>
                      <TableHead>Evento Anterior</TableHead>
                      <TableHead>Próximo Evento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell className="font-medium">{alert.pessoa}</TableCell>
                        <TableCell>{format(new Date(alert.dataPrev), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{format(new Date(alert.fimPrev), "dd/MM/yyyy HH:mm")}</TableCell>
                        <TableCell>{format(new Date(alert.inicioNext), "dd/MM/yyyy HH:mm")}</TableCell>
                        <TableCell className="text-purple-600 font-semibold">
                          {Number(alert.descansoHoras).toFixed(1)}h
                        </TableCell>
                        <TableCell>{Number(alert.descansoMinimo).toFixed(1)}h</TableCell>
                        <TableCell className="max-w-xs truncate">{alert.eventoPrev || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{alert.eventoNext || "-"}</TableCell>
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
