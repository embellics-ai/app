import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/auth-context';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { Phone, Clock, Activity, CheckCircle, CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { format, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';

// Helper function to format camelCase to readable labels
const formatLabel = (label: string): string => {
  // Handle common abbreviations
  const abbreviations: Record<string, string> = {
    avg: 'Average',
  };

  // Split camelCase and capitalize each word
  const formatted = label
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim();

  // Replace abbreviations
  return formatted
    .split(' ')
    .map(
      (word) => abbreviations[word.toLowerCase()] || word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
};

interface AgentMetric {
  agentId: string;
  agentName: string;
  successRate: number;
  pickupRate: number;
  transferRate: number;
  voicemailRate: number;
  totalCalls: number;
}

interface CallsByDateStacked {
  date: string;
  successful: number;
  unsuccessful: number;
  agentHangup: number;
  callTransfer: number;
  userHangup: number;
  otherDisconnection: number;
  positive: number;
  neutral: number;
  negative: number;
  otherSentiment: number;
}

interface DailyMetric {
  date: string;
  pickupRate: number;
  successRate: number;
  transferRate: number;
  voicemailRate: number;
  avgDuration: number;
  avgLatency: number;
}

interface RetellAnalytics {
  totalCalls: number;
  completedCalls: number;
  averageDuration: number;
  averageLatency: number;
  successRate: number;
  pickupRate: number;
  transferRate: number;
  voicemailRate: number;
  sentimentBreakdown: Record<string, number>;
  disconnectionReasons: Record<string, number>;
  callStatusBreakdown: Record<string, number>;
  callsOverTime: Array<{ date: string; count: number }>;
  dailyMetrics: DailyMetric[];
  callsByDateStacked: CallsByDateStacked[];
  agentMetrics: AgentMetric[];
  directionBreakdown: Record<string, number>;
}

export default function Analytics() {
  const { user } = useAuth();

  // Default to last 7 full days (midnight to midnight)
  const getDefaultDateRange = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const sevenDaysAgo = subDays(new Date(), 7);
    sevenDaysAgo.setHours(0, 0, 0, 0); // Start of 7 days ago

    return {
      from: sevenDaysAgo,
      to: today,
    };
  };

  const [dateRange, setDateRange] = useState<DateRange | undefined>(getDefaultDateRange());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Fetch tenant information for company name
  const { data: tenantInfo } = useQuery<any>({
    queryKey: [`/api/tenants/${user?.tenantId}`],
    enabled: !!user?.tenantId && user?.role === 'client_admin',
  });

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setCalendarOpen(false);
    }
  };

  const { data, isLoading } = useQuery<RetellAnalytics>({
    queryKey: [
      '/api/analytics/retell',
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let url = '/api/analytics/retell';
      const params = new URLSearchParams();

      if (dateRange?.from) {
        const startOfDay = new Date(
          Date.UTC(
            dateRange.from.getFullYear(),
            dateRange.from.getMonth(),
            dateRange.from.getDate(),
            0,
            0,
            0,
            0,
          ),
        );
        const startISO = startOfDay.toISOString();
        params.append('start_date', startISO);
        console.log(
          '[Analytics] Start date:',
          dateRange.from,
          '→',
          startISO,
          '→',
          startOfDay.getTime(),
        );
      }
      if (dateRange?.to) {
        const endOfDay = new Date(
          Date.UTC(
            dateRange.to.getFullYear(),
            dateRange.to.getMonth(),
            dateRange.to.getDate(),
            23,
            59,
            59,
            999,
          ),
        );
        const endISO = endOfDay.toISOString();
        params.append('end_date', endISO);
        console.log('[Analytics] End date:', dateRange.to, '→', endISO, '→', endOfDay.getTime());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading analytics from Retell AI...</div>
      </div>
    );
  }

  const metrics = [
    {
      title: 'Total Calls',
      value: data?.totalCalls || 0,
      icon: Phone,
      iconColor: 'text-blue-500',
      testId: 'total-calls',
    },
    {
      title: 'Average Duration',
      value: (() => {
        const totalSeconds = Math.round(data?.averageDuration || 0);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds}s`;
      })(),
      icon: Clock,
      iconColor: 'text-green-500',
      testId: 'avg-duration',
    },
    {
      title: 'Avg Latency',
      value: `${data?.averageLatency || 0}ms`,
      icon: Activity,
      iconColor: 'text-purple-500',
      testId: 'avg-latency',
    },
    {
      title: 'Success Rate',
      value: `${data?.successRate || 0}%`,
      icon: CheckCircle,
      iconColor: 'text-orange-500',
      testId: 'success-rate',
    },
  ];

  // Prep data for area charts using per-date metrics
  const rateChartData =
    data?.dailyMetrics?.map((d) => ({
      date: format(new Date(d.date), 'MMM dd'),
      pickupRate: d.pickupRate,
      successRate: d.successRate,
      transferRate: d.transferRate,
      voicemailRate: d.voicemailRate,
      avgDuration: d.avgDuration,
      avgLatency: d.avgLatency,
    })) || [];

  // Stacked bar data
  const successByDate =
    data?.callsByDateStacked?.map((d) => ({
      date: format(new Date(d.date), 'MMM dd'),
      successful: d.successful,
      unsuccessful: d.unsuccessful,
    })) || [];

  const disconnectionByDate =
    data?.callsByDateStacked?.map((d) => ({
      date: format(new Date(d.date), 'MMM dd'),
      agentHangup: d.agentHangup,
      callTransfer: d.callTransfer,
      userHangup: d.userHangup,
      other: d.otherDisconnection,
    })) || [];

  const sentimentByDate =
    data?.callsByDateStacked?.map((d) => ({
      date: format(new Date(d.date), 'MMM dd'),
      positive: d.positive,
      neutral: d.neutral,
      negative: d.negative,
      other: d.otherSentiment,
    })) || [];

  // Agent metrics for horizontal bar charts
  const agentSuccessData =
    data?.agentMetrics?.map((a) => ({
      agent: a.agentName,
      rate: Math.round(a.successRate),
    })) || [];

  const agentPickupData =
    data?.agentMetrics?.map((a) => ({
      agent: a.agentName,
      rate: Math.round(a.pickupRate),
    })) || [];

  const agentTransferData =
    data?.agentMetrics?.map((a) => ({
      agent: a.agentName,
      rate: Math.round(a.transferRate),
    })) || [];

  return (
    <div className="min-h-screen bg-background p-8" data-testid="page-analytics">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            {tenantInfo?.name ? `${tenantInfo.name} Analytics` : 'Analytics Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-last-updated">
            {user?.isPlatformAdmin
              ? 'View analytics for any client account'
              : tenantInfo?.name
                ? `Your company's call analytics and performance metrics`
                : 'Powered by Retell AI'}{' '}
            • Updated {format(new Date(), "MMM dd 'at' h:mm a")}
          </p>
        </div>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[280px] justify-start"
              data-testid="button-date-range"
              disabled={isLoading}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {isLoading ? (
                <span>Loading...</span>
              ) : dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'MMM dd, yyyy')} -{' '}
                    {format(dateRange.to, 'MMM dd, yyyy')}
                  </>
                ) : (
                  format(dateRange.from, 'MMM dd, yyyy')
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              data-testid="calendar-date-range"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title} data-testid={`card-metric-${metric.testId}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <Icon className={`h-4 w-4 ${metric.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`value-${metric.testId}`}>
                  {metric.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">From selected period</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Area Charts Row 1: Rates */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {/* Call Picked Up Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Call Picked Up Rate</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rateChartData}>
                  <defs>
                    <linearGradient id="pickupGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name) => [value, formatLabel(String(name))]} />
                  <Area
                    type="monotone"
                    dataKey="pickupRate"
                    stroke="#3b82f6"
                    fill="url(#pickupGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Call Successful Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Call Successful Rate</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rateChartData}>
                  <defs>
                    <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name) => [value, formatLabel(String(name))]} />
                  <Area
                    type="monotone"
                    dataKey="successRate"
                    stroke="#10b981"
                    fill="url(#successGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Call Transfer Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Call Transfer Rate</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rateChartData}>
                  <defs>
                    <linearGradient id="transferGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name) => [value, formatLabel(String(name))]} />
                  <Area
                    type="monotone"
                    dataKey="transferRate"
                    stroke="#f59e0b"
                    fill="url(#transferGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Area Charts Row 2: More Rates */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {/* Voicemail Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Voicemail Rate</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rateChartData}>
                  <defs>
                    <linearGradient id="voicemailGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name) => [value, formatLabel(String(name))]} />
                  <Area
                    type="monotone"
                    dataKey="voicemailRate"
                    stroke="#8b5cf6"
                    fill="url(#voicemailGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Average Call Duration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average call duration</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rateChartData}>
                  <defs>
                    <linearGradient id="durationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name) => [value, formatLabel(String(name))]} />
                  <Area
                    type="monotone"
                    dataKey="avgDuration"
                    stroke="#06b6d4"
                    fill="url(#durationGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Average Latency */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average Latency</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rateChartData}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value, name) => [value, formatLabel(String(name))]} />
                  <Area
                    type="monotone"
                    dataKey="avgLatency"
                    stroke="#ec4899"
                    fill="url(#latencyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stacked Bar Charts Row */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {/* Call Successful */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Call Successful</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={successByDate}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value, name) => [value, formatLabel(String(name))]}
                  />
                  <Bar dataKey="successful" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="unsuccessful" stackId="a" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Disconnection Reason */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Disconnection Reason</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={disconnectionByDate}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value, name) => [value, formatLabel(String(name))]}
                  />
                  <Bar dataKey="agentHangup" stackId="a" fill="#ef4444" />
                  <Bar dataKey="callTransfer" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="userHangup" stackId="a" fill="#10b981" />
                  <Bar dataKey="other" stackId="a" fill="#6b7280" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Sentiment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">User Sentiment</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentByDate}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value, name) => [value, formatLabel(String(name))]}
                  />
                  <Bar dataKey="negative" stackId="a" fill="#ef4444" />
                  <Bar dataKey="neutral" stackId="a" fill="#f97316" />
                  <Bar dataKey="positive" stackId="a" fill="#10b981" />
                  <Bar dataKey="other" stackId="a" fill="#6b7280" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Horizontal Bar Charts Row - Agent Metrics */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {/* Call Successful by Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Call Successful</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentSuccessData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="agent" type="category" tick={{ fontSize: 9 }} width={180} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value, name) => [value, formatLabel(String(name))]}
                  />
                  <Bar dataKey="rate" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Call Picked Up Rate by Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Call Picked Up Rate</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentPickupData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="agent" type="category" tick={{ fontSize: 9 }} width={180} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value, name) => [value, formatLabel(String(name))]}
                  />
                  <Bar dataKey="rate" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Call Transfer Rate by Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Call Transfer Rate</CardTitle>
            <p className="text-xs text-muted-foreground">All agents</p>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentTransferData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="agent" type="category" tick={{ fontSize: 9 }} width={180} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value, name) => [value, formatLabel(String(name))]}
                  />
                  <Bar dataKey="rate" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
