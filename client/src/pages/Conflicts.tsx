import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Bot, Sparkles } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { AlertFilters, AlertFiltersState } from "@/components/AlertFilters";
import { useState } from "react";

export default function Conflicts() {
  const { runId } = useParams<{ runId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<AlertFiltersState>({});
  const [selectedConflict, setSelectedConflict] = useState<number | null>(null);

  const { data: aiSuggestion, isLoading: isAiLoading } = trpc.alerts.getAISuggestion.useQuery(
    { alertaId: selectedConflict! },
    { enabled: selectedConflict !== null }
  );

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
          funcoes={["Narrador", "Comentarista", "Apresentador", "Colaborador"]}
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
                      <TableHead className="text-right">Ação</TableHead>
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
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                            onClick={() => setSelectedConflict(conflict.id)}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Pedir Ajuda à IA
                          </Button>
                        </TableCell>
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

      {/* AI Suggestion Dialog */}
      <Dialog open={selectedConflict !== null} onOpenChange={(open) => !open && setSelectedConflict(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-indigo-600" />
              Recomendação de Substituição (AI)
            </DialogTitle>
            <DialogDescription>
              A inteligência artificial analisou a disponibilidade, nível, e histórico de elenco para ajudar na resolução deste conflito.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isAiLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm text-gray-500 font-medium">Buscando substitutos na base e rodando heurísticas de ML...</p>
              </div>
            ) : aiSuggestion ? (
              <div className="space-y-6">
                {aiSuggestion.status === "NoAvailableCandidates" ? (
                  <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-md p-4 flex gap-3">
                    <p className="font-semibold text-sm">{aiSuggestion.message}</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-indigo-50 p-4 border border-indigo-100 rounded-md">
                      <p className="text-indigo-900 font-semibold text-sm">
                        Substituição Recomendada para o evento alvo: <span className="font-bold">{aiSuggestion.data?.eventoAlvo}</span>
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Top 3 Substitutos</h4>
                      
                      {aiSuggestion.data?.sugestoes?.length > 0 ? (
                        aiSuggestion.data?.sugestoes?.map((sugestao: any, i: number) => (
                          <div key={i} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <h5 className="font-bold text-gray-900 text-lg">{sugestao.nome || sugestao.name || "Sem Nome"}</h5>
                              <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                Match: {sugestao.scoreModelo || sugestao.score_modelo || "??"}%
                              </span>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">{sugestao.explicacaoML || sugestao.explicacao_ml || JSON.stringify(sugestao)}</p>
                          </div>
                        ))
                      ) : (
                        <div className="bg-red-50 text-red-800 p-4 border border-red-200 rounded-md font-mono text-xs w-full overflow-x-auto whitespace-pre-wrap">
                          <strong>[DEBUG IA] Payload Inválido Detectado:</strong><br/>
                          {JSON.stringify(aiSuggestion.data, null, 2)}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-red-500 bg-red-50 p-4 rounded-md text-sm font-medium">
                Ocorreu um erro ao gerar a recomendação.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedConflict(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
