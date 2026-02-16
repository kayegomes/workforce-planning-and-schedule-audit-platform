/**
 * Trend analysis module - calculates moving averages and predicts future utilization
 */

export interface WeeklyUtilization {
  weekStart: Date;
  weekEnd: Date;
  totalHoras: number;
  utilizacao: number; // percentage (0-100)
}

export interface TrendPoint {
  date: Date;
  value: number; // utilization percentage
  isHistorical: boolean; // true for historical data, false for predictions
}

export interface TrendAnalysis {
  pessoa: string;
  historicalData: TrendPoint[];
  predictions: TrendPoint[];
  movingAverage: number; // 4-week moving average
  trend: "crescente" | "estavel" | "decrescente";
  trendSlope: number; // slope of linear regression (percentage points per week)
  futureAlerts: Array<{
    weekStart: Date;
    predictedUtilization: number;
    severity: "warning" | "critical";
  }>;
  recommendation: string;
}

/**
 * Calculate weekly utilization from escalas data
 */
export function calculateWeeklyUtilization(
  escalas: Array<{ data: Date; duracaoHoras: number; ehFolga: boolean }>
): WeeklyUtilization[] {
  // Group by week (ISO week starting Monday)
  const weekMap = new Map<string, { totalHoras: number; weekStart: Date; weekEnd: Date }>();

  for (const escala of escalas) {
    if (escala.ehFolga) continue; // Skip folgas

    const date = new Date(escala.data);
    // Use UTC to avoid timezone issues
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Calculate days to previous Monday
    
    const weekStart = new Date(Date.UTC(year, month, day - daysToMonday, 0, 0, 0, 0));
    const weekEnd = new Date(Date.UTC(year, month, day - daysToMonday + 6, 23, 59, 59, 999));
    
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { totalHoras: 0, weekStart, weekEnd });
    }

    weekMap.get(weekKey)!.totalHoras += escala.duracaoHoras;
  }

  // Convert to array and calculate utilization
  const weeks: WeeklyUtilization[] = [];
  for (const data of Array.from(weekMap.values())) {
    const horasSemanais = 40; // Standard work week
    const utilizacao = (data.totalHoras / horasSemanais) * 100;
    weeks.push({
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      totalHoras: data.totalHoras,
      utilizacao,
    });
  }

  // Sort by week start
  weeks.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  return weeks;
}

/**
 * Calculate moving average (4 weeks)
 */
export function calculateMovingAverage(
  weeklyData: WeeklyUtilization[],
  windowSize: number = 4
): number {
  if (weeklyData.length === 0) return 0;
  
  const recentWeeks = weeklyData.slice(-windowSize);
  const sum = recentWeeks.reduce((acc, week) => acc + week.utilizacao, 0);
  return sum / recentWeeks.length;
}

/**
 * Perform linear regression to predict future utilization
 * Returns slope and intercept of y = mx + b
 */
function linearRegression(points: Array<{ x: number; y: number }>): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Analyze trend and predict future utilization
 */
export function analyzeTrend(
  pessoa: string,
  weeklyData: WeeklyUtilization[],
  weeksToPredict: number = 6
): TrendAnalysis {
  if (weeklyData.length === 0) {
    return {
      pessoa,
      historicalData: [],
      predictions: [],
      movingAverage: 0,
      trend: "estavel",
      trendSlope: 0,
      futureAlerts: [],
      recommendation: "Sem dados suficientes para análise de tendência",
    };
  }

  // Calculate moving average
  const movingAverage = calculateMovingAverage(weeklyData);

  // Prepare data for linear regression (use week index as x)
  const regressionPoints = weeklyData.map((week, index) => ({
    x: index,
    y: week.utilizacao,
  }));

  const { slope, intercept } = linearRegression(regressionPoints);

  // Determine trend direction
  let trend: "crescente" | "estavel" | "decrescente";
  if (slope > 2) {
    trend = "crescente";
  } else if (slope < -2) {
    trend = "decrescente";
  } else {
    trend = "estavel";
  }

  // Convert historical data to TrendPoint
  const historicalData: TrendPoint[] = weeklyData.map(week => ({
    date: week.weekStart,
    value: week.utilizacao,
    isHistorical: true,
  }));

  // Generate predictions
  const predictions: TrendPoint[] = [];
  const lastWeekIndex = weeklyData.length - 1;
  const lastWeekDate = weeklyData[weeklyData.length - 1].weekStart;

  for (let i = 1; i <= weeksToPredict; i++) {
    const futureIndex = lastWeekIndex + i;
    const predictedUtilization = slope * futureIndex + intercept;

    const futureDate = new Date(lastWeekDate);
    futureDate.setDate(lastWeekDate.getDate() + i * 7);

    predictions.push({
      date: futureDate,
      value: Math.max(0, predictedUtilization), // Ensure non-negative
      isHistorical: false,
    });
  }

  // Identify future alerts
  const futureAlerts: Array<{ weekStart: Date; predictedUtilization: number; severity: "warning" | "critical" }> = [];
  for (const prediction of predictions) {
    if (prediction.value >= 100) {
      futureAlerts.push({
        weekStart: prediction.date,
        predictedUtilization: prediction.value,
        severity: "critical",
      });
    } else if (prediction.value >= 85) {
      futureAlerts.push({
        weekStart: prediction.date,
        predictedUtilization: prediction.value,
        severity: "warning",
      });
    }
  }

  // Generate recommendation
  let recommendation = "";
  if (futureAlerts.length > 0) {
    const criticalCount = futureAlerts.filter(a => a.severity === "critical").length;
    if (criticalCount > 0) {
      recommendation = `🚨 CRÍTICO: Previsão indica sobrecarga extrema em ${criticalCount} semanas. Ação imediata necessária: redistribuir carga ou adicionar recursos.`;
    } else {
      recommendation = `⚠️ ALERTA: Previsão indica risco de sobrecarga em ${futureAlerts.length} semanas. Considerar redistribuição preventiva de carga.`;
    }
  } else if (trend === "crescente") {
    recommendation = "📈 Tendência crescente detectada. Monitorar de perto nas próximas semanas para evitar sobrecarga.";
  } else if (trend === "decrescente") {
    recommendation = "📉 Tendência decrescente. Utilização está diminuindo, pode haver capacidade ociosa.";
  } else {
    recommendation = "✅ Utilização estável dentro de níveis saudáveis. Continuar monitorando.";
  }

  return {
    pessoa,
    historicalData,
    predictions,
    movingAverage,
    trend,
    trendSlope: slope,
    futureAlerts,
    recommendation,
  };
}
