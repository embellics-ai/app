import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Phone, Clock, Euro, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';

// Custom dark tooltip component
const CustomTooltip = ({ active, payload, label, labelFormatter, formatter }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      className="recharts-custom-tooltip"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        border: 'none',
        borderRadius: '8px',
        padding: '12px',
        color: '#fff',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
      }}
    >
      <p style={{ marginBottom: '8px', fontWeight: 600, color: '#fff' }}>
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry: any, index: number) => (
        <p key={index} style={{ margin: '4px 0', color: '#fff' }}>
          <span>{entry.name}: </span>
          <span style={{ fontWeight: 600 }}>
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
};

interface EnhancedVoiceAnalyticsProps {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  agentId?: string;
}

interface TimeSeriesData {
  callCounts: { date: string; count: number; successful: number; unsuccessful: number }[];
  durationData: { date: string; averageDuration: number; totalDuration: number }[];
  sentimentData: {
    date: string;
    positive: number;
    neutral: number;
    negative: number;
    unknown: number;
  }[];
  costData: { date: string; totalCost: number; averageCost: number }[];
  statusBreakdown: Record<string, number>;
}

const COLORS = {
  successful: '#10b981', // green
  unsuccessful: '#ef4444', // red
  positive: '#10b981', // green
  neutral: '#3b82f6', // blue
  negative: '#ef4444', // red
  unknown: '#6b7280', // gray
  primary: '#8b5cf6', // purple
  secondary: '#ec4899', // pink
};

export default function EnhancedVoiceAnalytics({
  tenantId,
  startDate,
  endDate,
  agentId,
}: EnhancedVoiceAnalyticsProps) {
  // Fetch live USD to EUR exchange rate
  const { data: exchangeRate } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        return data.rates.EUR as number;
      } catch (error) {
        console.error('Failed to fetch exchange rate, using fallback:', error);
        return 0.92; // Fallback rate if API fails
      }
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    refetchInterval: 1000 * 60 * 60, // Refetch every hour
  });

  // Fetch time-series data
  const { data: timeSeriesData, isLoading } = useQuery<TimeSeriesData>({
    queryKey: ['voice-time-series', tenantId, startDate, endDate, agentId],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy: 'day',
      });
      if (agentId && agentId !== 'all') {
        params.append('agentId', agentId);
      }
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/calls/time-series?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId,
  });

  // Fetch agent breakdown data (only when not filtering by specific agent)
  const { data: agentBreakdown } = useQuery<
    { agentId: string; agentName: string; count: number }[]
  >({
    queryKey: ['voice-agent-breakdown', tenantId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/calls/agent-breakdown?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId && (!agentId || agentId === 'all'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  if (!timeSeriesData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Phone className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No Voice Data Available</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Voice analytics will appear once calls are recorded in the selected date range.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    } catch {
      return dateString;
    }
  };

  // Prepare chart data
  const callCountsChartData = timeSeriesData.callCounts.map((d) => ({
    date: formatDate(d.date),
    Successful: d.successful,
    Unsuccessful: d.unsuccessful,
  }));

  const durationChartData = timeSeriesData.durationData.map((d) => ({
    date: formatDate(d.date),
    'Avg Duration (sec)': Math.round(d.averageDuration),
  }));

  const sentimentChartData = timeSeriesData.sentimentData.map((d) => ({
    date: formatDate(d.date),
    Positive: d.positive,
    Neutral: d.neutral,
    Negative: d.negative,
    Unknown: d.unknown,
  }));

  const costChartData = timeSeriesData.costData.map((d) => ({
    date: formatDate(d.date),
    'Total Cost (€)': d.totalCost,
    'Avg Cost (€)': d.averageCost,
  }));

  // Status breakdown pie chart
  const statusPieData = Object.entries(timeSeriesData.statusBreakdown).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeSeriesData.callCounts.reduce((sum, d) => sum + d.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeSeriesData.callCounts.reduce((sum, d) => sum + d.successful, 0)} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(
                timeSeriesData.durationData.length > 0
                  ? timeSeriesData.durationData.reduce((sum, d) => sum + d.averageDuration, 0) /
                      timeSeriesData.durationData.length
                  : 0,
              )}
            </div>
            <p className="text-xs text-muted-foreground">Per call</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(timeSeriesData.costData.reduce((sum, d) => sum + d.totalCost, 0))}
            </div>
            <p className="text-xs text-muted-foreground">All calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeSeriesData.callCounts.reduce((sum, d) => sum + d.count, 0) > 0
                ? Math.round(
                    (timeSeriesData.callCounts.reduce((sum, d) => sum + d.successful, 0) /
                      timeSeriesData.callCounts.reduce((sum, d) => sum + d.count, 0)) *
                      100,
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Successful calls</p>
          </CardContent>
        </Card>
      </div>

      {/* Call Counts Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Call Volume Over Time</CardTitle>
          <CardDescription>Successful vs unsuccessful calls by day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={callCountsChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Successful" fill={COLORS.successful} />
              <Bar dataKey="Unsuccessful" fill={COLORS.unsuccessful} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Duration Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Average Call Duration</CardTitle>
          <CardDescription>Average duration per call over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={durationChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="Avg Duration (sec)"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sentiment Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Analysis</CardTitle>
          <CardDescription>Call sentiment breakdown over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={sentimentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="Positive"
                stackId="1"
                stroke={COLORS.positive}
                fill={COLORS.positive}
              />
              <Area
                type="monotone"
                dataKey="Neutral"
                stackId="1"
                stroke={COLORS.neutral}
                fill={COLORS.neutral}
              />
              <Area
                type="monotone"
                dataKey="Negative"
                stackId="1"
                stroke={COLORS.negative}
                fill={COLORS.negative}
              />
              <Area
                type="monotone"
                dataKey="Unknown"
                stackId="1"
                stroke={COLORS.unknown}
                fill={COLORS.unknown}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Analysis</CardTitle>
          <CardDescription>Total and average cost per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={costChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                content={<CustomTooltip formatter={(value: number) => formatCurrency(value)} />}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Total Cost (€)"
                stroke={COLORS.primary}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Avg Cost (€)"
                stroke={COLORS.secondary}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Agent Breakdown */}
      {agentBreakdown && agentBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Breakdown</CardTitle>
            <CardDescription>Call volume by agent</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis dataKey="agentName" type="category" stroke="#9ca3af" width={150} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="count" fill={COLORS.primary} name="Total Calls" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Status Breakdown Pie Chart */}
      {statusPieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Call Status Distribution</CardTitle>
            <CardDescription>Breakdown by call status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={Object.values(COLORS)[index % Object.values(COLORS).length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
