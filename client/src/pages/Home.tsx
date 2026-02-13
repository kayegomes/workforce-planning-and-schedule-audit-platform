import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, Calendar, History as HistoryIcon, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [file2468, setFile2468] = useState<File | null>(null);
  const [file2020, setFile2020] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "processing" | "completed">("idle");

  const uploadMutation = trpc.uploads.uploadFiles.useMutation();
  const processMutation = trpc.uploads.processRun.useMutation();

  const handleFileChange = (type: "2468" | "2020", file: File | null) => {
    if (type === "2468") {
      setFile2468(file);
    } else {
      setFile2020(file);
    }
  };

  const handleUpload = async () => {
    if (!file2468 || !file2020) {
      toast.error("Por favor, selecione ambos os arquivos");
      return;
    }

    try {
      setUploadStatus("uploading");
      
      // Convert files to base64
      const file2468Data = await fileToBase64(file2468);
      const file2020Data = await fileToBase64(file2020);

      // Upload files
      const uploadResult = await uploadMutation.mutateAsync({
        file2468: {
          name: file2468.name,
          data: file2468Data,
        },
        file2020: {
          name: file2020.name,
          data: file2020Data,
        },
      });

      toast.success("Arquivos enviados com sucesso!");
      
      setUploadStatus("processing");
      
      // Process run
      const processResult = await processMutation.mutateAsync({
        runId: uploadResult.runId,
      });

      setUploadStatus("completed");
      toast.success(`Processamento concluído! ${processResult.stats.totalConflitos} conflitos detectados.`);
      
      // Redirect to dashboard
      setTimeout(() => {
        setLocation(`/dashboard/${uploadResult.runId}`);
      }, 1500);
    } catch (error) {
      setUploadStatus("idle");
      toast.error(error instanceof Error ? error.message : "Erro ao processar arquivos");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data:*/*;base64, prefix
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Plataforma de Planejamento de Escalas</CardTitle>
            <CardDescription>Faça login para acessar o sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <a href={getLoginUrl()}>Entrar</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Plataforma de Planejamento de Escalas</h1>
          <p className="text-gray-600 mt-2">Detecção inteligente de conflitos, violações de folga e riscos de deslocamento</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-4xl mx-auto">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload de Planilhas
              </CardTitle>
            <CardDescription>
              Envie as planilhas de atividades (2468) e eventos consolidados (2020) para análise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="file2468">Planilha 2468 - Atividades de Equipe</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file2468"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange("2468", e.target.files?.[0] || null)}
                  disabled={uploadStatus !== "idle"}
                />
                {file2468 && <FileSpreadsheet className="h-5 w-5 text-green-600" />}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file2020">Planilha 2020 - Gestão de Eventos Consolidado</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file2020"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange("2020", e.target.files?.[0] || null)}
                  disabled={uploadStatus !== "idle"}
                />
                {file2020 && <FileSpreadsheet className="h-5 w-5 text-green-600" />}
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file2468 || !file2020 || uploadStatus !== "idle"}
              className="w-full"
              size="lg"
            >
              {uploadStatus === "idle" && (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Processar Planilhas
                </>
              )}
              {uploadStatus === "uploading" && (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Enviando arquivos...
                </>
              )}
              {uploadStatus === "processing" && (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processando dados...
                </>
              )}
              {uploadStatus === "completed" && (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Concluído!
                </>
              )}
            </Button>

            {uploadStatus !== "idle" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  {uploadStatus === "uploading" && "Enviando arquivos para o servidor..."}
                  {uploadStatus === "processing" && "Analisando dados e detectando alertas..."}
                  {uploadStatus === "completed" && "Redirecionando para o dashboard..."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Análise de Grades
            </CardTitle>
            <CardDescription>
              Calcule a suficiência de narradores para eventos futuros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/grades")} className="w-full" variant="outline">
              Acessar Análise de Grades
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              Histórico Multi-Run
            </CardTitle>
            <CardDescription>
              Visão macro de todas as execuções ao longo do tempo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/history")} className="w-full" variant="outline">
              Ver Histórico
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Heatmap de Sobrecarga
            </CardTitle>
            <CardDescription>
              Identifique padrões de utilização por dia da semana e pessoas cronicamente sobrecarregadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/heatmap")} className="w-full" variant="outline">
              Ver Heatmap
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
