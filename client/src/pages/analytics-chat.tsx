import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/auth-context';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { MessageSquare, Clock, DollarSign, TrendingUp, CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { format, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface ChatAnalytics {
  id: string;
  chatId: string;
  agentId: string;
  agentName: string | null;
  chatStatus: string | null;
  startTimestamp: string | null;
  endTimestamp: string | null;
  duration: number | null;
  messageCount: number | null;
  userSentiment: string | null;
  chatSuccessful: boolean | null;
  combinedCost: number | null;
}

interface AgentBreakdown {
  agentId: string;
  agentName: string;
  totalChats: number;
  successfulChats: number;
  successRate: number;
  totalDuration: number;
  averageDuration: number;
  totalCost: number;
  averageCost: number;
  sentimentBreakdown: Record<string, number>;
}

interface TimeSeriesData {
  chatCounts: { date: string; count: number; successful: number; unsuccessful: number }[];
  sentimentData: {
    date: string;
    positive: number;
    neutral: number;
    negative: number;
    unknown: number;
  }[];
}

export default function AnalyticsChat() {
  const { user } = useAuth();

  // Default to last 7 full days (midnight to midnight)
  const getDefaultDateRange = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const sevenDaysAgo = subDays(new Date(), 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return {
      from: sevenDaysAgo,
      to: today,
    };
  };

  const [dateRange, setDateRange] = useState<DateRange | undefined>(getDefaultDateRange());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Fetch tenant information
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

  // Build query params
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (dateRange?.from) {
      params.append('startDate', dateRange.from.toISOString());
    }
    if (dateRange?.to) {
      params.append('endDate', dateRange.to.toISOString());
    }
    return params.toString();
  };

  // Fetch agent breakdown
  const { data: agentData, isLoading: agentLoading } = useQuery<AgentBreakdown[]>({
    queryKey: [
      `/api/platform/tenants/${user?.tenantId}/analytics/chats/agent-breakdown`,
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const params = buildQueryParams();
      const url = `/api/platform/tenants/${user?.tenantId}/analytics/chats/agent-breakdown${params ? `?${params}` : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch agent breakdown');
      }

      return response.json();
    },
    enabled: !!user?.tenantId,
  });

  // Fetch recent chats
  const { data: chatsData, isLoading: chatsLoading } = useQuery<ChatAnalytics[]>({
    queryKey: [
      `/api/platform/tenants/${user?.tenantId}/analytics/chats`,
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const params = buildQueryParams();
      const url = `/api/platform/tenants/${user?.tenantId}/analytics/chats${params ? `?${params}` : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      return response.json();
    },
    enabled: !!user?.tenantId,
  });

  // Fetch time-series data
  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery<TimeSeriesData>({
    queryKey: [
      `/api/platform/tenants/${user?.tenantId}/analytics/chats/time-series`,
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const params = buildQueryParams();
      const url = `/api/platform/tenants/${user?.tenantId}/analytics/chats/time-series${params ? `?${params}` : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch time-series data');
      }

      return response.json();
    },
    enabled: !!user?.tenantId,
  });

  const isLoading = agentLoading || chatsLoading || timeSeriesLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading chat analytics...</div>
      </div>
    );
  }

  // Calculate metrics
  const totalChats = agentData?.reduce((sum, agent) => sum + agent.totalChats, 0) || 0;
  const totalSuccessful = agentData?.reduce((sum, agent) => sum + agent.successfulChats, 0) || 0;
  const totalDuration = agentData?.reduce((sum, agent) => sum + agent.totalDuration, 0) || 0;
  const totalCost = agentData?.reduce((sum, agent) => sum + agent.totalCost, 0) || 0;
  const avgDuration = totalChats > 0 ? totalDuration / totalChats : 0;
  const successRate = totalChats > 0 ? (totalSuccessful / totalChats) * 100 : 0;

  // Format duration
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const metrics = [
    {
      title: 'Total Chats',
      value: totalChats,
      icon: MessageSquare,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Average Duration',
      value: formatDuration(avgDuration),
      icon: Clock,
      iconColor: 'text-green-500',
    },
    {
      title: 'Total Cost',
      value: `$${totalCost.toFixed(2)}`,
      icon: DollarSign,
      iconColor: 'text-purple-500',
    },
    {
      title: 'Success Rate',
      value: `${successRate.toFixed(1)}%`,
      icon: TrendingUp,
      iconColor: 'text-orange-500',
    },
  ];

  // Prepare chart data
  const agentChartData =
    agentData?.map((agent) => ({
      name: agent.agentName || agent.agentId,
      chats: agent.totalChats,
    })) || [];

  const sentimentChartData =
    timeSeriesData?.sentimentData?.map((d) => ({
      date: format(new Date(d.date), 'MMM dd'),
      positive: d.positive,
      neutral: d.neutral,
      negative: d.negative,
      unknown: d.unknown,
    })) || [];

  const COLORS = ['#22c55e', '#3b82f6', '#ef4444', '#94a3b8'];

  return (
    <div className="h-full bg-background">
      <div className="container max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold">
              {tenantInfo?.name ? `${tenantInfo.name} Chat Analytics` : 'Chat Analytics'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Widget chat analytics and performance metrics • Updated{' '}
              {format(new Date(), "MMM dd 'at' h:mm a")}
            </p>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start" disabled={isLoading}>
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
                mode="range"
                selected={dateRange}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {metrics.map((metric, idx) => (
            <Card key={idx}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <metric.icon className={`h-4 w-4 ${metric.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {/* Chat Count by Agent */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Chat Count by Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="chats" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Sentiment Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sentiment Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sentimentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="positive"
                      stackId="1"
                      stroke="#22c55e"
                      fill="#22c55e"
                    />
                    <Area
                      type="monotone"
                      dataKey="neutral"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                    />
                    <Area
                      type="monotone"
                      dataKey="negative"
                      stackId="1"
                      stroke="#ef4444"
                      fill="#ef4444"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Chat Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Chat Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <th className="h-12 px-4 text-left align-middle font-medium">Agent</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Started</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Duration</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Messages</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Sentiment</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Success</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {chatsData && chatsData.length > 0 ? (
                    chatsData.slice(0, 10).map((chat) => (
                      <tr key={chat.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle">{chat.agentName || chat.agentId}</td>
                        <td className="p-4 align-middle">
                          {chat.startTimestamp
                            ? format(new Date(chat.startTimestamp), 'MMM dd, h:mm a')
                            : 'N/A'}
                        </td>
                        <td className="p-4 align-middle">
                          {chat.duration ? formatDuration(chat.duration) : 'N/A'}
                        </td>
                        <td className="p-4 align-middle">{chat.messageCount || 0}</td>
                        <td className="p-4 align-middle">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              chat.userSentiment === 'positive'
                                ? 'bg-green-100 text-green-800'
                                : chat.userSentiment === 'negative'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {chat.userSentiment || 'unknown'}
                          </span>
                        </td>
                        <td className="p-4 align-middle">{chat.chatSuccessful ? '✓' : '✗'}</td>
                        <td className="p-4 align-middle">${(chat.combinedCost || 0).toFixed(4)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-muted-foreground">
                        No chat sessions found for the selected date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
