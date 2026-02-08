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

export default function Conflicts() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<AlertFiltersState>({});

  const { data: conflicts, isLoading } = trpc.alerts.getConflicts.useQuery(
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
          <h1 className="text-2xl font-bold text-gray-900">Alertas de Conflito</h1>
          <p className="text-gray-600">Sobreposições de horário detectadas</p>
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
            <CardTitle>Conflitos de Horário ({conflicts?.length || 0})</CardTitle>
            <CardDescription>Atividades com sobreposição de horário para a mesma pessoa</CardDescription>
          </CardHeader>
          <CardContent>
            {conflicts && conflicts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Atividade 1</TableHead>
                      <TableHead>Horário 1</TableHead>
                      <TableHead>Atividade 2</TableHead>
                      <TableHead>Horário 2</TableHead>
                      <TableHead>Overlap (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflicts.map((conflict) => (
                      <TableRow key={conflict.id}>
                        <TableCell className="font-medium">{conflict.pessoa}</TableCell>
                        <TableCell>{format(new Date(conflict.data), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="max-w-xs truncate">{conflict.evento1 || "-"}</TableCell>
                        <TableCell>
                          {format(new Date(conflict.inicio1), "HH:mm")} - {format(new Date(conflict.fim1), "HH:mm")}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{conflict.evento2 || "-"}</TableCell>
                        <TableCell>
                          {format(new Date(conflict.inicio2), "HH:mm")} - {format(new Date(conflict.fim2), "HH:mm")}
                        </TableCell>
                        <TableCell className="text-red-600 font-bold">{conflict.overlapMinutos}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhum conflito detectado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
