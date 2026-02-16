import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TrendPoint {
  date: Date;
  value: number;
  isHistorical: boolean;
}

interface TrendChartProps {
  pessoa: string;
  historicalData: TrendPoint[];
  predictions: TrendPoint[];
  movingAverage: number;
  trend: "crescente" | "estavel" | "decrescente";
  trendSlope: number;
  futureAlerts: Array<{
    weekStart: Date;
    predictedUtilization: number;
    severity: "warning" | "critical";
  }>;
  recommendation: string;
}

export default function TrendChart({
  pessoa,
  historicalData,
  predictions,
  movingAverage,
  trend,
  trendSlope,
  futureAlerts,
  recommendation,
}: TrendChartProps) {
  // Combine historical and prediction data
  const allPoints = [...historicalData, ...predictions];
  const labels = allPoints.map(p => {
    const date = new Date(p.date);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });

  // Split data into historical and predicted
  const historicalValues = historicalData.map(p => p.value);
  const predictionValues = new Array(historicalData.length).fill(null).concat(
    predictions.map(p => p.value)
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Utilização Histórica',
        data: historicalValues.concat(new Array(predictions.length).fill(null)),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
      },
      {
        label: 'Previsão (6 semanas)',
        data: predictionValues,
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(1) + '%';
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: Math.max(120, Math.max(...allPoints.map(p => p.value)) + 10),
        ticks: {
          callback: function(value: any) {
            return value + '%';
          }
        },
        grid: {
          color: (context: any) => {
            // Highlight 85% and 100% lines
            if (context.tick.value === 85) return 'rgba(249, 115, 22, 0.3)';
            if (context.tick.value === 100) return 'rgba(239, 68, 68, 0.3)';
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (context: any) => {
            if (context.tick.value === 85 || context.tick.value === 100) return 2;
            return 1;
          }
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    },
  };

  const getTrendIcon = () => {
    if (trend === "crescente") return <TrendingUp className="h-5 w-5 text-red-600" />;
    if (trend === "decrescente") return <TrendingDown className="h-5 w-5 text-green-600" />;
    return <div className="h-5 w-5 text-gray-600">→</div>;
  };

  const getTrendColor = () => {
    if (trend === "crescente") return "text-red-600";
    if (trend === "decrescente") return "text-green-600";
    return "text-gray-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Tendência de Utilização: {pessoa}
          {getTrendIcon()}
        </CardTitle>
        <CardDescription>
          Média móvel de 4 semanas: <span className="font-semibold">{movingAverage.toFixed(1)}%</span>
          {' • '}
          Tendência: <span className={`font-semibold capitalize ${getTrendColor()}`}>{trend}</span>
          {' • '}
          Taxa de variação: <span className="font-semibold">{trendSlope > 0 ? '+' : ''}{trendSlope.toFixed(2)}% por semana</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart */}
        <div className="h-[400px]">
          <Line data={chartData} options={options} />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm text-gray-600 border-t pt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Histórico (últimas semanas)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded border-2 border-dashed border-orange-600"></div>
            <span>Previsão (próximas 6 semanas)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-orange-400"></div>
            <span>85% (zona de alerta)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-400"></div>
            <span>100% (sobrecarga)</span>
          </div>
        </div>

        {/* Alerts */}
        {futureAlerts.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Alertas de Sobrecarga Futura
            </h4>
            <div className="space-y-2">
              {futureAlerts.map((alert, index) => (
                <div
                  key={index}
                  className={`p-3 rounded ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-orange-50 border border-orange-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      Semana de {new Date(alert.weekStart).toLocaleDateString()}
                    </span>
                    <span className={`font-bold ${
                      alert.severity === 'critical' ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {alert.predictedUtilization.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {alert.severity === 'critical'
                      ? '🚨 Sobrecarga crítica prevista'
                      : '⚠️ Risco de sobrecarga'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Recomendação</h4>
          <p className="text-sm text-gray-700">{recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
