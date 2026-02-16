import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import TrendChart from "./TrendChart";

interface TrendAnalysisSectionProps {
  runId: number;
  pessoa: string;
}

export default function TrendAnalysisSection({ runId, pessoa }: TrendAnalysisSectionProps) {
  const { data: trendData, isLoading } = trpc.analytics.getTrendAnalysis.useQuery(
    { runId, pessoa, weeksToPredict: 6 },
    { enabled: !!runId && !!pessoa }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 mb-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!trendData || trendData.historicalData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8 text-center">
        <p className="text-gray-600">Sem dados suficientes para análise de tendência</p>
        <p className="text-sm text-gray-500 mt-1">
          É necessário ter pelo menos algumas semanas de histórico para gerar previsões
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <TrendChart
        pessoa={trendData.pessoa}
        historicalData={trendData.historicalData}
        predictions={trendData.predictions}
        movingAverage={trendData.movingAverage}
        trend={trendData.trend}
        trendSlope={trendData.trendSlope}
        futureAlerts={trendData.futureAlerts}
        recommendation={trendData.recommendation}
      />
    </div>
  );
}
