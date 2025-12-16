import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useTheme } from '@/components/theme-provider';
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
import { MessageSquare, Clock, Euro, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';

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

// Custom pie chart label renderer - works in both light and dark mode
const createPieLabelRenderer = (isDark: boolean) => {
  return ({ name, percent, cx, cy, midAngle, innerRadius, outerRadius }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill={isDark ? '#ffffff' : '#111827'}
        stroke={isDark ? '#000000' : '#ffffff'}
        strokeWidth="2"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        style={{
          fontWeight: 700,
          fontSize: '15px',
          paintOrder: 'stroke fill',
        }}
      >
        {`${name}: ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };
};

// Legend style that works in both light and dark mode
const LEGEND_STYLE = {
  color: 'inherit', // Will inherit from parent theme
  fontWeight: 600,
};

interface EnhancedChatAnalyticsProps {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  agentId?: string;
}

interface TimeSeriesData {
  chatCounts: { date: string; count: number; successful: number; unsuccessful: number }[];
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
  messageCountStats: { average: number; min: number; max: number; total: number };
  toolCallsStats: { average: number; total: number };
}

const COLORS = {
  successful: '#8b5cf6', // medium purple
  unsuccessful: '#c4b5fd', // light purple
  positive: '#7c3aed', // darker purple
  neutral: '#a78bfa', // light-medium purple
  negative: '#c4b5fd', // light purple
  unknown: '#ddd6fe', // very light purple
  primary: '#8b5cf6', // medium purple
  secondary: '#a78bfa', // light-medium purple
};

export default function EnhancedChatAnalytics({
  tenantId,
  startDate,
  endDate,
  agentId,
}: EnhancedChatAnalyticsProps) {
  const { theme } = useTheme();

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
    queryKey: ['chat-time-series', tenantId, startDate, endDate, agentId],
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
        `/api/platform/tenants/${tenantId}/analytics/chats/time-series?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId,
  });

  // Fetch agent breakdown data (only when not filtering by specific agent)
  const { data: agentBreakdown } = useQuery<
    { agentId: string; agentName: string; count: number }[]
  >({
    queryKey: ['chat-agent-breakdown', tenantId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/chats/agent-breakdown?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId && (!agentId || agentId === 'all'),
  });

  if (isLoading || !timeSeriesData) {
    return <div className="text-center p-8">Loading analytics...</div>;
  }

  // Create label renderer with current theme
  const renderPieLabel = createPieLabelRenderer(theme === 'dark');

  // Calculate aggregate metrics
  const totalChats = timeSeriesData.chatCounts.reduce((sum, d) => sum + d.count, 0);
  const totalSuccessful = timeSeriesData.chatCounts.reduce((sum, d) => sum + d.successful, 0);
  const successRate = totalChats > 0 ? ((totalSuccessful / totalChats) * 100).toFixed(1) : '0';
  const totalCostUSD = timeSeriesData.costData.reduce((sum, d) => sum + d.totalCost, 0);
  const avgCostUSD = totalChats > 0 ? totalCostUSD / totalChats : 0;

  // Convert USD to EUR
  const rate = exchangeRate || 0.92;
  const totalCost = totalCostUSD * rate;
  const avgCost = avgCostUSD * rate;

  const avgDuration =
    timeSeriesData.durationData.length > 0
      ? timeSeriesData.durationData.reduce((sum, d) => sum + d.averageDuration, 0) /
        timeSeriesData.durationData.length
      : 0;

  // Convert cost data to EUR
  const costDataEUR = timeSeriesData.costData.map((d) => ({
    date: d.date,
    totalCost: d.totalCost * rate,
    averageCost: d.averageCost * rate,
  }));

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format duration in minutes and seconds
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Prepare sentiment pie chart data
  const sentimentTotals = timeSeriesData.sentimentData.reduce(
    (acc, day) => ({
      positive: acc.positive + day.positive,
      neutral: acc.neutral + day.neutral,
      negative: acc.negative + day.negative,
      unknown: acc.unknown + day.unknown,
    }),
    { positive: 0, neutral: 0, negative: 0, unknown: 0 },
  );

  const sentimentPieData = [
    { name: 'Positive', value: sentimentTotals.positive, color: COLORS.positive },
    { name: 'Neutral', value: sentimentTotals.neutral, color: COLORS.neutral },
    { name: 'Negative', value: sentimentTotals.negative, color: COLORS.negative },
    { name: 'Unknown', value: sentimentTotals.unknown, color: COLORS.unknown },
  ].filter((item) => item.value > 0);

  // Prepare success rate pie data
  const successPieData = [
    { name: 'Successful', value: totalSuccessful, color: COLORS.successful },
    { name: 'Unsuccessful', value: totalChats - totalSuccessful, color: COLORS.unsuccessful },
  ].filter((item) => item.value > 0);

  // Prepare status breakdown pie data
  const statusPieData = Object.entries(timeSeriesData.statusBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalChats}</div>
            <p className="text-xs text-muted-foreground">{successRate}% success rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgDuration)}</div>
            <p className="text-xs text-muted-foreground">Per chat session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">€{avgCost.toFixed(3)} avg per chat</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Messages</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeSeriesData.messageCountStats.average.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeSeriesData.messageCountStats.total} total messages
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chat Counts Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Counts</CardTitle>
            <CardDescription>Daily chat volume with success breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData.chatCounts}>
                <defs>
                  <linearGradient id="colorSuccessful" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.successful} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.successful} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUnsuccessful" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.unsuccessful} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.unsuccessful} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis />
                <Tooltip
                  content={<CustomTooltip labelFormatter={formatDate} />}
                  cursor={{ fill: 'transparent' }}
                />
                <Legend wrapperStyle={LEGEND_STYLE} iconType="rect" />
                <Area
                  type="monotone"
                  dataKey="successful"
                  stackId="1"
                  stroke={COLORS.successful}
                  fill="url(#colorSuccessful)"
                  name="Successful"
                />
                <Area
                  type="monotone"
                  dataKey="unsuccessful"
                  stackId="1"
                  stroke={COLORS.unsuccessful}
                  fill="url(#colorUnsuccessful)"
                  name="Unsuccessful"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chat Duration */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Duration</CardTitle>
            <CardDescription>Average duration per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData.durationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis tickFormatter={(value) => `${Math.round(value)}s`} />
                <Tooltip
                  content={<CustomTooltip labelFormatter={formatDate} formatter={formatDuration} />}
                  cursor={{ stroke: 'transparent' }}
                />
                <Legend wrapperStyle={LEGEND_STYLE} iconType="rect" />
                <Line
                  type="monotone"
                  dataKey="averageDuration"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  name="Avg Duration"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chat Successful Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Successful</CardTitle>
            <CardDescription>Success vs unsuccessful chats</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={successPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderPieLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {successPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Analysis</CardTitle>
            <CardDescription>Daily cost breakdown (in EUR)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costDataEUR}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis tickFormatter={(value) => `€${value.toFixed(2)}`} />
                <Tooltip
                  content={
                    <CustomTooltip
                      labelFormatter={formatDate}
                      formatter={(value: number) => `€${value.toFixed(3)}`}
                    />
                  }
                  cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                />
                <Legend wrapperStyle={LEGEND_STYLE} iconType="rect" />
                <Bar
                  dataKey="totalCost"
                  fill={COLORS.primary}
                  name="Total Cost"
                  activeBar={{ fill: '#7c3aed', stroke: '#7c3aed' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chat Status Breakdown */}
        {statusPieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Chat Status</CardTitle>
              <CardDescription>Distribution by completion status</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderPieLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % 2 === 0 ? 'primary' : 'secondary']}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    wrapperStyle={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                    }}
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.9)',
                      border: 'none',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* User Sentiment Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Sentiment</CardTitle>
            <CardDescription>Overall sentiment distribution</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sentimentPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderPieLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sentimentPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chats by Agent - Only show when not filtering by specific agent */}
        {agentBreakdown && agentBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Chats by Agent</CardTitle>
              <CardDescription>Distribution of chats across agents</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agentBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="agentName" type="category" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                  />
                  <Legend wrapperStyle={LEGEND_STYLE} iconType="rect" />
                  <Bar
                    dataKey="count"
                    fill={COLORS.primary}
                    name="Chat Count"
                    radius={[0, 4, 4, 0]}
                    activeBar={{ fill: '#7c3aed', stroke: '#7c3aed' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Sentiment Trend Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Trend</CardTitle>
            <CardDescription>Sentiment distribution over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData?.sentimentData || []}>
                <defs>
                  <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis />
                <Tooltip
                  content={<CustomTooltip />}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString();
                  }}
                />
                <Legend wrapperStyle={LEGEND_STYLE} iconType="rect" />
                <Area
                  type="monotone"
                  dataKey="positive"
                  name="Positive"
                  stackId="1"
                  stroke="#7c3aed"
                  fillOpacity={1}
                  fill="url(#colorPositive)"
                />
                <Area
                  type="monotone"
                  dataKey="neutral"
                  name="Neutral"
                  stackId="1"
                  stroke="#a78bfa"
                  fillOpacity={1}
                  fill="url(#colorNeutral)"
                />
                <Area
                  type="monotone"
                  dataKey="negative"
                  name="Negative"
                  stackId="1"
                  stroke="#c4b5fd"
                  fillOpacity={1}
                  fill="url(#colorNegative)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
