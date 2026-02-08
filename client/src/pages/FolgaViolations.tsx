import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { AlertFilters, AlertFiltersState } from "@/components/AlertFilters";
import { useState } from "react";

export default function FolgaViolations() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<AlertFiltersState>({});

  const { data: violations, isLoading } = trpc.alerts.getFolgaViolations.useQuery(
    { 
      runId: Number(runId), 
      limit: 100,
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
          <h1 className="text-2xl font-bold text-gray-900">Alertas de Violação de Folga</h1>
          <p className="text-gray-600">Trabalho agendado em dias de folga</p>
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
            <CardTitle>Violações de Folga ({violations?.length || 0})</CardTitle>
            <CardDescription>Atividades agendadas em dias de folga, férias ou compensação</CardDescription>
          </CardHeader>
          <CardContent>
            {violations && violations.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo de Folga</TableHead>
                      <TableHead>Evento/Programa</TableHead>
                      <TableHead>Duração (h)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {violations.map((violation) => (
                      <TableRow key={violation.id}>
                        <TableCell className="font-medium">{violation.pessoa}</TableCell>
                        <TableCell>{format(new Date(violation.data), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{violation.tipoFolga}</TableCell>
                        <TableCell className="max-w-xs truncate">{violation.eventoPrograma || "-"}</TableCell>
                        <TableCell>{Number(violation.duracaoHoras).toFixed(1)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            violation.status?.toLowerCase().includes("aprovado") 
                              ? "bg-green-100 text-green-800" 
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {violation.status || "N/A"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhuma violação de folga detectada
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
