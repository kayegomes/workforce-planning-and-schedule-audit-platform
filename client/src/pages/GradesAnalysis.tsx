import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Upload, Plus, X, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface Excecao {
  pessoa: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
}

export default function GradesAnalysis() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [gradeFile, setGradeFile] = useState<File | null>(null);
  const [gradeName, setGradeName] = useState("");
  const [runId, setRunId] = useState<number | null>(null);
  const [funcao, setFuncao] = useState("Narrador");
  const [profissionaisText, setProfissionaisText] = useState("");
  const [excecoes, setExcecoes] = useState<Excecao[]>([]);
  const [newExcecao, setNewExcecao] = useState<Excecao>({
    pessoa: "",
    tipo: "licenca_maternidade",
    dataInicio: "",
    dataFim: "",
  });

  const [gradeId, setGradeId] = useState<number | null>(null);
  const [analiseResult, setAnaliseResult] = useState<any>(null);

  const { data: runs, isLoading: runsLoading } = trpc.runs.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const uploadGrade = trpc.grades.uploadGrade.useMutation();
  const analyzeGrade = trpc.grades.analyzeGrade.useMutation();

  if (authLoading) {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setGradeFile(e.target.files[0]);
      if (!gradeName) {
        setGradeName(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleAddExcecao = () => {
    if (!newExcecao.pessoa || !newExcecao.dataInicio || !newExcecao.dataFim) {
      toast.error("Preencha todos os campos da exceção");
      return;
    }
    setExcecoes([...excecoes, newExcecao]);
    setNewExcecao({
      pessoa: "",
      tipo: "licenca_maternidade",
      dataInicio: "",
      dataFim: "",
    });
  };

  const handleRemoveExcecao = (index: number) => {
    setExcecoes(excecoes.filter((_, i) => i !== index));
  };

  const handleUploadAndAnalyze = async () => {
    if (!gradeFile) {
      toast.error("Selecione um arquivo de grade");
      return;
    }

    if (!gradeName) {
      toast.error("Informe um nome para a grade");
      return;
    }

    const profissionais = profissionaisText
      .split("\n")
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (profissionais.length === 0) {
      toast.error("Informe pelo menos um profissional");
      return;
    }

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const base64Data = base64.split(",")[1];

        // Upload grade
        toast.info("Fazendo upload da grade...");
        const uploadResult = await uploadGrade.mutateAsync({
          nome: gradeName,
          file: {
            name: gradeFile.name,
            data: base64Data,
          },
        });

        setGradeId(uploadResult.gradeId);
        toast.success(`Grade carregada: ${uploadResult.totalEventos} eventos`);

        // Analyze grade
        toast.info("Analisando suficiência de cobertura...");
        const analiseRes = await analyzeGrade.mutateAsync({
          gradeId: uploadResult.gradeId,
          runId: runId || undefined,
          funcao,
          profissionais,
          excecoes: excecoes.map(e => ({
            pessoa: e.pessoa,
            tipo: e.tipo,
            dataInicio: e.dataInicio,
            dataFim: e.dataFim,
          })),
        });

        setAnaliseResult(analiseRes);
        toast.success("Análise concluída!");
      };

      reader.readAsDataURL(gradeFile);
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar grade");
    }
  };

  const getResultadoColor = (resultado: string) => {
    switch (resultado) {
      case "suficiente":
        return "text-green-600";
      case "insuficiente":
        return "text-orange-600";
      case "critico":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getResultadoIcon = (resultado: string) => {
    switch (resultado) {
      case "suficiente":
        return <CheckCircle2 className="h-12 w-12 text-green-600" />;
      case "insuficiente":
        return <AlertCircle className="h-12 w-12 text-orange-600" />;
      case "critico":
        return <XCircle className="h-12 w-12 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container py-4">
          <Button variant="ghost" onClick={() => setLocation("/")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Análise de Grades</h1>
          <p className="text-gray-600">Calcule a suficiência de narradores para eventos futuros</p>
        </div>
      </div>

      <div className="container py-8">
        {!analiseResult ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload and Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Upload de Grade</CardTitle>
                <CardDescription>Envie a planilha com os eventos futuros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="grade-file">Arquivo da Grade (Excel)</Label>
                  <Input
                    id="grade-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="mt-1"
                  />
                  {gradeFile && (
                    <p className="text-sm text-green-600 mt-1">
                      ✓ {gradeFile.name}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="grade-name">Nome da Grade</Label>
                  <Input
                    id="grade-name"
                    value={gradeName}
                    onChange={(e) => setGradeName(e.target.value)}
                    placeholder="Ex: Grade Março 2024"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="run-select">Run de Folgas (Opcional)</Label>
                  <Select value={runId?.toString() || ""} onValueChange={(v) => setRunId(v ? Number(v) : null)}>
                    <SelectTrigger id="run-select" className="mt-1">
                      <SelectValue placeholder="Selecione um run para considerar folgas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {runs?.map((run) => (
                        <SelectItem key={run.id} value={run.id.toString()}>
                          Run #{run.id} - {new Date(run.createdAt).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="funcao">Função</Label>
                  <Input
                    id="funcao"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    placeholder="Ex: Narrador"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Profissionais */}
            <Card>
              <CardHeader>
                <CardTitle>Profissionais Disponíveis</CardTitle>
                <CardDescription>Liste os profissionais (um por linha)</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={profissionaisText}
                  onChange={(e) => setProfissionaisText(e.target.value)}
                  placeholder="João Silva&#10;Maria Santos&#10;Pedro Costa"
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {profissionaisText.split("\n").filter(p => p.trim()).length} profissionais
                </p>
              </CardContent>
            </Card>

            {/* Exceções */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Exceções (Licenças, Férias, etc.)</CardTitle>
                <CardDescription>Adicione períodos em que profissionais não estarão disponíveis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label htmlFor="exc-pessoa">Pessoa</Label>
                    <Input
                      id="exc-pessoa"
                      value={newExcecao.pessoa}
                      onChange={(e) => setNewExcecao({ ...newExcecao, pessoa: e.target.value })}
                      placeholder="Nome"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="exc-tipo">Tipo</Label>
                    <Select
                      value={newExcecao.tipo}
                      onValueChange={(v) => setNewExcecao({ ...newExcecao, tipo: v })}
                    >
                      <SelectTrigger id="exc-tipo" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="licenca_maternidade">Licença Maternidade</SelectItem>
                        <SelectItem value="licenca_medica">Licença Médica</SelectItem>
                        <SelectItem value="ferias">Férias</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="exc-inicio">Data Início</Label>
                    <Input
                      id="exc-inicio"
                      type="date"
                      value={newExcecao.dataInicio}
                      onChange={(e) => setNewExcecao({ ...newExcecao, dataInicio: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="exc-fim">Data Fim</Label>
                    <Input
                      id="exc-fim"
                      type="date"
                      value={newExcecao.dataFim}
                      onChange={(e) => setNewExcecao({ ...newExcecao, dataFim: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddExcecao} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {excecoes.length > 0 && (
                  <div className="space-y-2">
                    {excecoes.map((exc, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                        <div className="flex-1">
                          <span className="font-medium">{exc.pessoa}</span>
                          <span className="text-gray-600 mx-2">•</span>
                          <span className="text-sm text-gray-600">{exc.tipo}</span>
                          <span className="text-gray-600 mx-2">•</span>
                          <span className="text-sm text-gray-600">
                            {new Date(exc.dataInicio).toLocaleDateString()} até {new Date(exc.dataFim).toLocaleDateString()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExcecao(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Button */}
            <div className="lg:col-span-2">
              <Button
                onClick={handleUploadAndAnalyze}
                disabled={uploadGrade.isPending || analyzeGrade.isPending}
                className="w-full h-12 text-lg"
              >
                {uploadGrade.isPending || analyzeGrade.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    Analisar Suficiência de Cobertura
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Results */
          <div className="space-y-6">
            {/* Result Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resultado da Análise</CardTitle>
                <CardDescription>Grade: {gradeName} • Função: {funcao}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    {getResultadoIcon(analiseResult.resultado)}
                    <h2 className={`text-3xl font-bold mt-4 capitalize ${getResultadoColor(analiseResult.resultado)}`}>
                      {analiseResult.resultado}
                    </h2>
                    <p className="text-gray-600 mt-2">
                      {analiseResult.eventosComCobertura} de {analiseResult.totalEventos} eventos cobertos
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-4 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600">Total Eventos</p>
                    <p className="text-2xl font-bold">{analiseResult.totalEventos}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded">
                    <p className="text-sm text-gray-600">Com Cobertura</p>
                    <p className="text-2xl font-bold text-green-600">{analiseResult.eventosComCobertura}</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded">
                    <p className="text-sm text-gray-600">Sem Cobertura</p>
                    <p className="text-2xl font-bold text-red-600">{analiseResult.eventosSemCobertura}</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded">
                    <p className="text-sm text-gray-600">Profissionais</p>
                    <p className="text-2xl font-bold text-blue-600">{analiseResult.profissionaisDisponiveis}/{analiseResult.totalProfissionais}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {analiseResult.recomendacoes && analiseResult.recomendacoes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recomendações</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analiseResult.recomendacoes.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-600 mr-2">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Coverage Details */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhes de Cobertura por Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Data</th>
                        <th className="text-right p-2">Eventos</th>
                        <th className="text-right p-2">Disponíveis</th>
                        <th className="text-right p-2">Em Folga</th>
                        <th className="text-right p-2">Em Exceção</th>
                        <th className="text-right p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analiseResult.detalhes.map((detalhe: any, index: number) => (
                        <tr key={index} className="border-b">
                          <td className="p-2">{new Date(detalhe.data).toLocaleDateString()}</td>
                          <td className="text-right p-2">{detalhe.totalEventos}</td>
                          <td className="text-right p-2 font-semibold">{detalhe.profissionaisDisponiveis}</td>
                          <td className="text-right p-2 text-gray-600">{detalhe.profissionaisEmFolga}</td>
                          <td className="text-right p-2 text-gray-600">{detalhe.profissionaisEmExcecao}</td>
                          <td className="text-right p-2">
                            {detalhe.eventosSemCobertura > 0 ? (
                              <span className="text-red-600 font-semibold">-{detalhe.eventosSemCobertura}</span>
                            ) : (
                              <span className="text-green-600">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Button onClick={() => { setAnaliseResult(null); setGradeFile(null); }} variant="outline" className="w-full">
              Nova Análise
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
