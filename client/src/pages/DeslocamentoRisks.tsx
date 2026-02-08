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

export default function DeslocamentoRisks() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<AlertFiltersState>({});

  const { data: risks, isLoading } = trpc.alerts.getDeslocamentoRisks.useQuery(
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
          <h1 className="text-2xl font-bold text-gray-900">Alertas de Risco de Deslocamento</h1>
          <p className="text-gray-600">Gap insuficiente entre atividades em cidades diferentes</p>
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
            <CardTitle>Riscos de Deslocamento ({risks?.length || 0})</CardTitle>
            <CardDescription>Tempo insuficiente para deslocamento entre cidades (mínimo 3h)</CardDescription>
          </CardHeader>
          <CardContent>
            {risks && risks.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Data Anterior</TableHead>
                      <TableHead>Cidade Anterior</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Data Próxima</TableHead>
                      <TableHead>Cidade Próxima</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Gap (h)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risks.map((risk) => (
                      <TableRow key={risk.id}>
                        <TableCell className="font-medium">{risk.pessoa}</TableCell>
                        <TableCell>{format(new Date(risk.dataPrev), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{risk.cidadePrev}</TableCell>
                        <TableCell>{format(new Date(risk.fimPrev), "HH:mm")}</TableCell>
                        <TableCell>{format(new Date(risk.dataNext), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{risk.cidadeNext}</TableCell>
                        <TableCell>{format(new Date(risk.inicioNext), "HH:mm")}</TableCell>
                        <TableCell className="text-yellow-600 font-bold">
                          {Number(risk.gapHoras).toFixed(1)}h
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            risk.status?.toLowerCase().includes("aprovado") 
                              ? "bg-green-100 text-green-800" 
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {risk.status || "N/A"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhum risco de deslocamento detectado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
