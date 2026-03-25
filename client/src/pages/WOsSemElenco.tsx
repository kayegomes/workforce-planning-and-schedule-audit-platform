import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, FileQuestion } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";

export default function WOsSemElenco() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: wos, isLoading } = trpc.dashboard.getWOsSemElenco.useQuery(
    { 
      runId: Number(runId), 
      limit: 100 
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
            <div className="bg-gray-100 p-2 rounded-lg">
              <FileQuestion className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WOs sem Elenco Alocado</h1>
              <p className="text-gray-600">Registros de WO que não possuem profissional designado</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Listagem de WOs ({wos?.length || 0})</CardTitle>
            <CardDescription>
              WOs identificadas na escala sem um nome de profissional associado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {wos && wos.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>WO</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Evento / Programa</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Função Esperada</TableHead>
                      <TableHead>Cidade / Local</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wos.map((wo) => (
                      <TableRow key={wo.id}>
                        <TableCell className="font-bold text-blue-600">{wo.wo}</TableCell>
                        <TableCell>{format(new Date(wo.data), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          {format(new Date(wo.inicioDt), "HH:mm")} - {format(new Date(wo.fimDt), "HH:mm")}
                        </TableCell>
                        <TableCell className="max-w-xs font-medium">
                          {wo.eventoPrograma || "N/A"}
                        </TableCell>
                        <TableCell>{wo.canal || "N/A"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {wo.funcao || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium">{wo.cidade || "N/A"}</p>
                            <p className="text-gray-500 text-xs">{wo.local || "N/A"}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Tudo certo!</h3>
                <p className="text-gray-500">Nenhuma WO sem elenco encontrada nesta rodada.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
