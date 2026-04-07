import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../components/ui/table";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../components/ui/select";
import { 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutDashboard
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";

export default function RosterPlanning() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/roster-planning/:runId");
  const runId = params?.runId ? parseInt(params.runId) : 0;

  const [selectedNivel, setSelectedNivel] = useState<string>("all");
  const [selectedSemana, setSelectedSemana] = useState<string>("all");

  const { data: levels } = trpc.roster.getLevels.useQuery({ runId });
  const { data: weeks } = trpc.roster.getWeeks.useQuery({ runId });
  
  // Auto-select first week if not selected
  useState(() => {
    if (weeks && weeks.length > 0 && selectedSemana === "all") {
      setSelectedSemana(weeks[0].toString());
    }
  });

  const { data: rosterData, isLoading } = trpc.roster.getRosterData.useQuery({ 
    runId,
    nivel: selectedNivel === "all" ? undefined : selectedNivel,
    semanaIso: selectedSemana === "all" ? undefined : parseInt(selectedSemana)
  }, {
    enabled: !!runId
  });

  const dates = rosterData?.dates || [];
  const roster = rosterData?.roster || [];

  const getCellConfig = (dayActivities: any[]) => {
    if (!dayActivities || dayActivities.length === 0) return { color: "bg-transparent", text: "" };

    // Priority: vacation (Blue) > folga (Dark Purple) > transmission (Green) > program (Pink)
    const hasFerias = dayActivities.some(a => a.type === 'ferias');
    if (hasFerias) return { color: "bg-blue-600 text-white font-bold", text: "FÉRIAS" };

    const hasFolga = dayActivities.some(a => a.type === 'folga');
    if (hasFolga) return { color: "bg-[#581c87] text-white font-bold", text: "FOLGA" };

    const transmissions = dayActivities.filter(a => a.type === 'transmission');
    if (transmissions.length > 0) return { color: "bg-[#16a34a] text-white font-bold", text: transmissions.length.toString() };

    const programs = dayActivities.filter(a => a.type === 'program');
    if (programs.length > 0) return { color: "bg-[#ec4899] text-white font-bold", text: programs.length.toString() };

    return { color: "bg-gray-100 text-gray-400", text: dayActivities.length.toString() };
  };

  const handlePrevWeek = () => {
    if (!weeks) return;
    const currentIndex = weeks.indexOf(parseInt(selectedSemana));
    if (currentIndex > 0) {
      setSelectedSemana(weeks[currentIndex - 1].toString());
    }
  };

  const handleNextWeek = () => {
    if (!weeks) return;
    const currentIndex = weeks.indexOf(parseInt(selectedSemana));
    if (currentIndex < weeks.length - 1) {
      setSelectedSemana(weeks[currentIndex + 1].toString());
    }
  };

  const handleAudit = () => {
    toast.success("Iniciando auditoria de premissas...", {
      description: "Analisando conformidade da escala atual com as regras de negócio."
    });
    // Logical placeholder for future backend integration
  };

  const handleOptimize = () => {
    toast.info("Otimizando distribuição...", {
      description: "O algoritmo de IA está buscando a melhor distribuição de folgas."
    });
    // Logical placeholder for future backend integration
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      <div className="mx-auto max-w-[1800px] space-y-6">
        
        {/* Header - Modern & Clean */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full bg-white shadow-sm border-gray-200"
                onClick={() => setLocation(`/dashboard/${runId}`)}
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#0f172a] font-outfit">
                Planejamento de Folgas
              </h1>
              <p className="text-gray-500 font-medium">Visualização e gestão de escalas por nível de elenco</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Week Navigator */}
            <div className="flex items-center bg-white rounded-full border border-gray-200 shadow-sm p-1">
               <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={handlePrevWeek}>
                 <ChevronLeft className="h-4 w-4" />
               </Button>
               <div className="px-4 font-bold text-sm min-w-[100px] text-center">
                 Semana {selectedSemana === "all" ? "-" : selectedSemana}
               </div>
               <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={handleNextWeek}>
                 <ChevronRight className="h-4 w-4" />
               </Button>
            </div>

            <div className="w-px h-8 bg-gray-200 mx-1 hidden md:block" />

            <Select value={selectedNivel} onValueChange={setSelectedNivel}>
              <SelectTrigger className="w-[180px] bg-white rounded-full border-gray-200 shadow-sm font-semibold">
                <SelectValue placeholder="Todos os níveis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                {levels?.map(l => (
                  <SelectItem key={l} value={l!}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button className="bg-[#0f172a] text-white hover:bg-[#1e293b] rounded-full shadow-md gap-2">
               <Download className="h-4 w-4" />
               Exportar
            </Button>
          </div>
        </div>

        {/* Legend Panel */}
        <div className="flex flex-wrap gap-4 px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-[#16a34a] rounded shadow-sm"></div>
             <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Transmissões (Verde)</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-[#ec4899] rounded shadow-sm"></div>
             <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Programas (Rosa)</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-[#581c87] rounded shadow-sm"></div>
             <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Folgas (Roxo Escuro)</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-blue-600 rounded shadow-sm"></div>
             <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Férias (Azul)</span>
           </div>
        </div>

        {/* Main Grid View */}
        <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white ring-1 ring-gray-100">
          <CardContent className="p-0">
            <div className="overflow-x-auto min-h-[500px]">
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="bg-[#0f172a] hover:bg-[#0f172a] border-gray-800">
                    <TableHead className="w-[280px] min-w-[280px] text-white font-black text-xs uppercase tracking-widest border-r border-gray-800 sticky left-0 z-20 bg-[#0f172a]">
                      Nome do Profissional
                    </TableHead>
                    <TableHead className="w-[180px] text-white font-black text-xs uppercase tracking-widest border-r border-gray-800">Modalidade</TableHead>
                    <TableHead className="w-[100px] text-white font-black text-xs uppercase tracking-widest border-r border-gray-800 text-center">Nível</TableHead>
                    <TableHead className="w-[100px] text-white font-black text-xs uppercase tracking-widest border-r border-gray-800 text-center">Base</TableHead>
                    {dates.map(date => (
                      <TableHead key={date} className="text-center text-white font-bold min-w-[140px] px-2 py-4">
                        <div className="text-[10px] uppercase opacity-60 font-black tracking-tighter">
                          {format(parseISO(date), 'EEEE', { locale: ptBR })}
                        </div>
                        <div className="text-lg font-black mt-0.5">
                          {format(parseISO(date), 'dd/MM')}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={dates.length + 4} className="h-96 text-center">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <div className="relative">
                            <div className="h-12 w-12 rounded-full border-4 border-gray-100 border-t-[#0f172a] animate-spin"></div>
                          </div>
                          <p className="text-[#0f172a] font-bold text-lg animate-pulse">Sincronizando Escalas...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : roster.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={dates.length + 4} className="h-96 text-center">
                         <div className="flex flex-col items-center justify-center opacity-30 gap-2">
                           <LayoutDashboard className="h-16 w-16" />
                           <p className="text-2xl font-black">Sem registros encontrados</p>
                         </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    roster.map((person, idx) => (
                      <TableRow key={person.nome} className={`group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-gray-100/50 transition-colors`}>
                        <TableCell className="font-bold text-[#0f172a] border-r border-gray-100 sticky left-0 z-10 bg-inherit shadow-[4px_0_10px_rgba(0,0,0,0.02)] py-4">
                          {person.nome}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-gray-500 border-r border-gray-100 uppercase">{person.modalidade}</TableCell>
                        <TableCell className="text-center border-r border-gray-100">
                          <Badge className="bg-gray-900/5 text-gray-900 border-0 font-black text-[10px] rounded-md px-2 py-0.5">
                             {person.nivel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs font-bold text-gray-500 border-r border-gray-100">{person.base}</TableCell>
                        {dates.map(date => {
                          const config = getCellConfig(person.days[date]);
                          return (
                            <TableCell key={date} className="p-1 border-r border-gray-50 last:border-r-0">
                              <div className={`w-full h-14 rounded-xl flex items-center justify-center text-[10px] transition-all hover:scale-[1.03] hover:shadow-lg cursor-pointer ring-1 ring-white/20 select-none ${config.color}`}>
                                {config.text}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Floating Tooltip / Footer */}
        <div className="flex flex-col md:flex-row items-center gap-4 justify-between bg-white/50 backdrop-blur-md p-4 rounded-3xl border border-white shadow-inner">
           <div className="text-sm font-medium text-gray-500 italic">
             Dica: Passe o mouse sobre as células para ver detalhes das transmissões.
           </div>
           <div className="flex gap-2">
              <Button 
                variant="ghost" 
                className="rounded-full text-xs font-bold uppercase tracking-widest text-[#0f172a]"
                onClick={handleAudit}
              >
                Auditar Premissas
              </Button>
              <Button 
                className="rounded-full bg-gradient-to-r from-[#0f172a] to-[#334155] text-white font-black text-xs uppercase tracking-widest px-8 shadow-lg shadow-gray-200"
                onClick={handleOptimize}
              >
                Otimizar Distribuição
              </Button>
           </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'Outfit';
          src: url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap');
        }
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}} />
    </div>
  );
}
