import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone,
  MessageSquare,
  Activity,
  DollarSign,
  Clock,
  CheckCircle2,
  TrendingUp,
  Smile,
  Frown,
  Meh,
  Loader2,
  CalendarIcon,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';

// Helper function to format camelCase to readable labels
const formatLabel = (label: string): string => {
  const abbreviations: Record<string, string> = {
    avg: 'Average',
  };

  const formatted = label
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return formatted
    .split(' ')
    .map(
      (word) => abbreviations[word.toLowerCase()] || word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
};

type AnalyticsType = 'all' | 'voice' | 'chat';

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  createdAt: string;
}

interface VoiceAnalytics {
  totalCalls: number;
  successfulCalls: number;
  totalDuration: number;
  averageDuration: number;
  totalCost: number;
  averageCost: number;
  sentimentBreakdown: Record<string, number>;
}

interface ChatAnalytics {
  totalChats: number;
  successfulChats: number;
  averageDuration: number;
  totalCost: number;
  averageCost: number;
  sentimentBreakdown: Record<string, number>;
}

interface UnifiedAnalytics {
  voice: VoiceAnalytics;
  chat: ChatAnalytics;
  combined: {
    totalInteractions: number;
    totalCost: number;
    averageCost: number;
  };
}

export default function UnifiedAnalytics() {
  const { user } = useAuth();
  const [analyticsType, setAnalyticsType] = useState<AnalyticsType>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

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

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setCalendarOpen(false);
    }
  };

  // Fetch all tenants (for platform admin)
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['/api/platform/tenants'],
    enabled: user?.role === 'owner' || user?.isPlatformAdmin,
  });

  // Auto-select tenant for client admins
  const tenantId =
    user?.role === 'owner' || user?.isPlatformAdmin ? selectedTenantId : user?.tenantId;

  // Fetch unified analytics overview (voice + chat from our database)
  const { data: analyticsOverview, isLoading: overviewLoading } = useQuery<UnifiedAnalytics>({
    queryKey: [
      'analytics-overview',
      tenantId,
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      if (!tenantId || !dateRange?.from || !dateRange?.to) return null as any;
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/overview?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId && !!dateRange?.from && !!dateRange?.to,
  });

  // Fetch voice analytics from Retell API (legacy - for detailed charts only)
  const { data: voiceData, isLoading: voiceLoading } = useQuery({
    queryKey: [
      'voice-analytics',
      tenantId,
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      if (!tenantId || !dateRange?.from || !dateRange?.to) return null;
      const params = new URLSearchParams({
        start_date: dateRange.from.toISOString(),
        end_date: dateRange.to.toISOString(),
      });
      const response = await apiRequest(
        'GET',
        `/api/platform/analytics/retell/${tenantId}?${params}`,
      );
      return await response.json();
    },
    enabled:
      !!tenantId &&
      !!dateRange?.from &&
      !!dateRange?.to &&
      (analyticsType === 'all' || analyticsType === 'voice'),
  });

  // Fetch chat analytics - DEPRECATED, use analyticsOverview instead
  const chatOverview = analyticsOverview?.chat;

  // Fetch chat sessions
  const { data: chatSessions = [], isLoading: chatSessionsLoading } = useQuery({
    queryKey: [
      'chat-sessions',
      tenantId,
      dateRange?.from?.toISOString(),
      dateRange?.to?.toISOString(),
    ],
    queryFn: async () => {
      if (!tenantId || !dateRange?.from || !dateRange?.to) return [];
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        limit: '50',
      });
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/chats?${params}`,
      );
      const data = await response.json();
      console.log('[Unified Analytics] Chat sessions data:', data);
      if (data.length > 0) {
        console.log('[Unified Analytics] First chat session:', {
          chatId: data[0].chatId,
          duration: data[0].duration,
          messageCount: data[0].messageCount,
          agentName: data[0].agentName,
          userSentiment: data[0].userSentiment,
          combinedCost: data[0].combinedCost,
          startTimestamp: data[0].startTimestamp,
          endTimestamp: data[0].endTimestamp,
        });
      }
      return data;
    },
    enabled: !!tenantId && (analyticsType === 'all' || analyticsType === 'chat'),
  });

  const isLoading = voiceLoading || overviewLoading || chatSessionsLoading;

  // Calculate combined metrics
  const getCombinedMetrics = () => {
    const voiceAnalytics = analyticsOverview?.voice;
    const chatAnalytics = analyticsOverview?.chat;
    const combined = analyticsOverview?.combined;

    // For display purposes based on selected analytics type
    if (analyticsType === 'voice') {
      return {
        totalInteractions: voiceAnalytics?.totalCalls || 0,
        voiceCalls: voiceAnalytics?.totalCalls || 0,
        chats: 0,
        totalCost: voiceAnalytics?.totalCost || 0,
        averageCost: voiceAnalytics?.averageCost || 0,
        voiceCost: voiceAnalytics?.totalCost || 0,
        chatCost: 0,
      };
    }

    if (analyticsType === 'chat') {
      return {
        totalInteractions: chatAnalytics?.totalChats || 0,
        voiceCalls: 0,
        chats: chatAnalytics?.totalChats || 0,
        totalCost: chatAnalytics?.totalCost || 0,
        averageCost: chatAnalytics?.averageCost || 0,
        voiceCost: 0,
        chatCost: chatAnalytics?.totalCost || 0,
      };
    }

    // analyticsType === 'all'
    return {
      totalInteractions: combined?.totalInteractions || 0,
      voiceCalls: voiceAnalytics?.totalCalls || 0,
      chats: chatAnalytics?.totalChats || 0,
      totalCost: combined?.totalCost || 0,
      averageCost: combined?.averageCost || 0,
      voiceCost: voiceAnalytics?.totalCost || 0,
      chatCost: chatAnalytics?.totalCost || 0,
    };
  };

  const metrics = getCombinedMetrics();

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Please log in to view analytics</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Unified view of voice calls and chat interactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        {(user.role === 'owner' || user.isPlatformAdmin) && (
          <div className="space-y-2">
            <Label>Select Tenant</Label>
            <Select value={selectedTenantId || ''} onValueChange={setSelectedTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Analytics Type</Label>
          <Select value={analyticsType} onValueChange={(v) => setAnalyticsType(v as AnalyticsType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (Voice + Chat)</SelectItem>
              <SelectItem value="voice">Voice Only</SelectItem>
              <SelectItem value="chat">Chat Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date Range</Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start" disabled={isLoading}>
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
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {!tenantId ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Please select a tenant to view analytics</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading analytics...</span>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(analyticsType === 'all' || analyticsType === 'voice' || analyticsType === 'chat') && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalInteractions}</div>
                  {analyticsType === 'all' && (
                    <p className="text-xs text-muted-foreground">
                      {metrics.voiceCalls} calls, {metrics.chats} chats
                    </p>
                  )}
                  {analyticsType === 'voice' && (
                    <p className="text-xs text-muted-foreground">{metrics.voiceCalls} calls</p>
                  )}
                  {analyticsType === 'chat' && (
                    <p className="text-xs text-muted-foreground">{metrics.chats} chats</p>
                  )}
                </CardContent>
              </Card>
            )}

            {(analyticsType === 'all' || analyticsType === 'voice') && analyticsOverview?.voice && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Voice Success Rate</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analyticsOverview.voice.totalCalls > 0
                      ? (
                          (analyticsOverview.voice.successfulCalls /
                            analyticsOverview.voice.totalCalls) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analyticsOverview.voice.successfulCalls} completed calls
                  </p>
                </CardContent>
              </Card>
            )}

            {(analyticsType === 'all' || analyticsType === 'chat') && chatOverview && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Chat Success Rate</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {chatOverview.totalChats > 0
                      ? ((chatOverview.successfulChats / chatOverview.totalChats) * 100).toFixed(1)
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {chatOverview.successfulChats} successful chats
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics.totalCost)}</div>
                <p className="text-xs text-muted-foreground">
                  Avg: {formatCurrency(metrics.averageCost)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Voice Analytics Charts - Only show if we have voice data from our database */}
          {(analyticsType === 'all' || analyticsType === 'voice') &&
            analyticsOverview?.voice &&
            analyticsOverview.voice.totalCalls > 0 &&
            voiceData?.dailyMetrics &&
            voiceData.dailyMetrics.length > 0 && (
              <>
                <div className="grid gap-4 md:grid-cols-3 mb-8">
                  {/* Pickup Rate */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Call Picked Up Rate</CardTitle>
                      <p className="text-xs text-muted-foreground">All agents</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px] cursor-pointer">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={voiceData.dailyMetrics.map((d: any) => ({
                              date: format(new Date(d.date), 'MMM dd'),
                              pickupRate: d.pickupRate || 0,
                            }))}
                          >
                            <defs>
                              <linearGradient id="pickupGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value, name) => [value, formatLabel(String(name))]}
                            />
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

                  {/* Success Rate */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Call Successful Rate</CardTitle>
                      <p className="text-xs text-muted-foreground">All agents</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px] cursor-pointer">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={voiceData.dailyMetrics.map((d: any) => ({
                              date: format(new Date(d.date), 'MMM dd'),
                              successRate: d.successRate || 0,
                            }))}
                          >
                            <defs>
                              <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value, name) => [value, formatLabel(String(name))]}
                            />
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

                  {/* Transfer Rate */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Call Transfer Rate</CardTitle>
                      <p className="text-xs text-muted-foreground">All agents</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px] cursor-pointer">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={voiceData.dailyMetrics.map((d: any) => ({
                              date: format(new Date(d.date), 'MMM dd'),
                              transferRate: d.transferRate || 0,
                            }))}
                          >
                            <defs>
                              <linearGradient id="transferGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value, name) => [value, formatLabel(String(name))]}
                            />
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
                          <AreaChart
                            data={voiceData.dailyMetrics.map((d: any) => ({
                              date: format(new Date(d.date), 'MMM dd'),
                              voicemailRate: d.voicemailRate || 0,
                            }))}
                          >
                            <defs>
                              <linearGradient id="voicemailGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value, name) => [value, formatLabel(String(name))]}
                            />
                            <Area
                              type="monotone"
                              dataKey="voicemailRate"
                              stroke="#ef4444"
                              fill="url(#voicemailGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Average Duration */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
                      <p className="text-xs text-muted-foreground">All agents</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px] cursor-pointer">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={voiceData.dailyMetrics.map((d: any) => ({
                              date: format(new Date(d.date), 'MMM dd'),
                              avgDuration: Math.round((d.avgDuration || 0) / 60),
                            }))}
                          >
                            <defs>
                              <linearGradient id="durationGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value, name) => [
                                `${value} min`,
                                formatLabel(String(name)),
                              ]}
                            />
                            <Area
                              type="monotone"
                              dataKey="avgDuration"
                              stroke="#8b5cf6"
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
                          <AreaChart
                            data={voiceData.dailyMetrics.map((d: any) => ({
                              date: format(new Date(d.date), 'MMM dd'),
                              avgLatency: d.avgLatency || 0,
                            }))}
                          >
                            <defs>
                              <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(value, name) => [`${value}ms`, formatLabel(String(name))]}
                            />
                            <Area
                              type="monotone"
                              dataKey="avgLatency"
                              stroke="#06b6d4"
                              fill="url(#latencyGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Stacked Bar Charts */}
                <div className="grid gap-4 md:grid-cols-3 mb-8">
                  {/* Call Successful */}
                  {voiceData.callsByDateStacked && voiceData.callsByDateStacked.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Call Successful</CardTitle>
                        <p className="text-xs text-muted-foreground">All agents</p>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] cursor-pointer">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={voiceData.callsByDateStacked.map((d: any) => ({
                                date: format(new Date(d.date), 'MMM dd'),
                                successful: d.successful || 0,
                                unsuccessful: d.unsuccessful || 0,
                              }))}
                            >
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
                  )}

                  {/* Disconnection Reason */}
                  {voiceData.callsByDateStacked && voiceData.callsByDateStacked.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Disconnection Reason</CardTitle>
                        <p className="text-xs text-muted-foreground">All agents</p>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] cursor-pointer">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={voiceData.callsByDateStacked.map((d: any) => ({
                                date: format(new Date(d.date), 'MMM dd'),
                                agentHangup: d.agentHangup || 0,
                                callTransfer: d.callTransfer || 0,
                                userHangup: d.userHangup || 0,
                                other: d.otherDisconnection || 0,
                              }))}
                            >
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
                  )}

                  {/* User Sentiment */}
                  {voiceData.callsByDateStacked && voiceData.callsByDateStacked.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">User Sentiment</CardTitle>
                        <p className="text-xs text-muted-foreground">All agents</p>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[250px] cursor-pointer">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={voiceData.callsByDateStacked.map((d: any) => ({
                                date: format(new Date(d.date), 'MMM dd'),
                                negative: d.negative || 0,
                                neutral: d.neutral || 0,
                                positive: d.positive || 0,
                                other: d.otherSentiment || 0,
                              }))}
                            >
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
                  )}
                </div>
              </>
            )}

          {/* No Voice Data Message */}
          {(analyticsType === 'all' || analyticsType === 'voice') &&
            analyticsOverview?.voice &&
            analyticsOverview.voice.totalCalls === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Phone className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No Voice Analytics Data Yet</p>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Voice analytics will appear here once you configure Retell to send{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">call.ended</code> webhooks to{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">/api/retell/call-ended</code>
                  </p>
                </CardContent>
              </Card>
            )}

          {/* Chat Analytics Charts */}
          {(analyticsType === 'all' || analyticsType === 'chat') &&
            chatOverview &&
            chatOverview.sentimentBreakdown && (
              <div className="grid gap-4 md:grid-cols-3 mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Chat Sentiment Distribution
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">All chat sessions</p>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] cursor-pointer">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              name: 'Sentiment',
                              negative: chatOverview.sentimentBreakdown.negative || 0,
                              neutral: chatOverview.sentimentBreakdown.neutral || 0,
                              positive: chatOverview.sentimentBreakdown.positive || 0,
                              unknown: chatOverview.sentimentBreakdown.unknown || 0,
                            },
                          ]}
                        >
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            cursor={{ fill: 'transparent' }}
                            formatter={(value, name) => [value, formatLabel(String(name))]}
                          />
                          <Bar dataKey="negative" stackId="a" fill="#ef4444" />
                          <Bar dataKey="neutral" stackId="a" fill="#f97316" />
                          <Bar dataKey="positive" stackId="a" fill="#10b981" />
                          <Bar dataKey="unknown" stackId="a" fill="#6b7280" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          {/* Chat Analytics Details */}
          {(analyticsType === 'all' || analyticsType === 'chat') && chatSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Chat Sessions</CardTitle>
                <CardDescription>Latest chat interactions with users</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chat ID</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Sentiment</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chatSessions.slice(0, 10).map((chat: any) => (
                      <TableRow key={chat.id}>
                        <TableCell className="font-mono text-xs">
                          {chat.chatId.substring(0, 12)}...
                        </TableCell>
                        <TableCell>{chat.agentName || 'Unknown'}</TableCell>
                        <TableCell>{formatDuration(chat.duration)}</TableCell>
                        <TableCell>{chat.messageCount}</TableCell>
                        <TableCell>
                          {chat.userSentiment?.toLowerCase() === 'positive' && (
                            <Badge className="bg-green-100 text-green-800">
                              <Smile className="h-3 w-3 mr-1" />
                              Positive
                            </Badge>
                          )}
                          {chat.userSentiment?.toLowerCase() === 'neutral' && (
                            <Badge className="bg-gray-100 text-gray-800">
                              <Meh className="h-3 w-3 mr-1" />
                              Neutral
                            </Badge>
                          )}
                          {chat.userSentiment?.toLowerCase() === 'negative' && (
                            <Badge className="bg-red-100 text-red-800">
                              <Frown className="h-3 w-3 mr-1" />
                              Negative
                            </Badge>
                          )}
                          {!chat.userSentiment ||
                            (chat.userSentiment?.toLowerCase() !== 'positive' &&
                              chat.userSentiment?.toLowerCase() !== 'neutral' &&
                              chat.userSentiment?.toLowerCase() !== 'negative' && (
                                <Badge variant="outline">Unknown</Badge>
                              ))}
                        </TableCell>
                        <TableCell>{formatCurrency(chat.combinedCost)}</TableCell>
                        <TableCell>
                          {chat.chatSuccessful ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline">Incomplete</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Voice Analytics Details - Add if needed */}
          {(analyticsType === 'all' || analyticsType === 'voice') && voiceData && (
            <Card>
              <CardHeader>
                <CardTitle>Voice Call Metrics</CardTitle>
                <CardDescription>Overview of voice call performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Average Duration
                    </div>
                    <div className="text-2xl font-bold">
                      {formatDuration(voiceData.averageDuration)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Total Calls</div>
                    <div className="text-2xl font-bold">{voiceData.totalCalls}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Completed</div>
                    <div className="text-2xl font-bold">{voiceData.completedCalls}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
