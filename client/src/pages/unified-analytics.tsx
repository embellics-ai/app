import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  completedCalls: number;
  averageDuration: number;
  totalCost: number;
  successRate: number;
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
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [analyticsType, setAnalyticsType] = useState<AnalyticsType>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Calculate date range
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch all tenants (for platform admin)
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['/api/platform/tenants'],
    enabled: user?.role === 'owner' || user?.isPlatformAdmin,
  });

  // Auto-select tenant for client admins
  const tenantId = (user?.role === 'owner' || user?.isPlatformAdmin) ? selectedTenantId : user?.tenantId;

  // Fetch voice analytics
  const { data: voiceData, isLoading: voiceLoading } = useQuery({
    queryKey: ['voice-analytics', tenantId, timeRange],
    queryFn: async () => {
      if (!tenantId) return null;
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      });
      const response = await apiRequest(
        'GET',
        `/api/platform/analytics/retell/${tenantId}?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId && (analyticsType === 'all' || analyticsType === 'voice'),
  });

  // Fetch chat analytics
  const { data: chatOverview, isLoading: chatLoading } = useQuery<ChatAnalytics>({
    queryKey: ['chat-analytics-overview', tenantId, timeRange],
    queryFn: async () => {
      if (!tenantId) return null as any;
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/overview?${params}`,
      );
      const data = await response.json();
      return data.chat;
    },
    enabled: !!tenantId && (analyticsType === 'all' || analyticsType === 'chat'),
  });

  // Fetch chat sessions
  const { data: chatSessions = [], isLoading: chatSessionsLoading } = useQuery({
    queryKey: ['chat-sessions', tenantId, timeRange],
    queryFn: async () => {
      if (!tenantId) return [];
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: '50',
      });
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/chats?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId && (analyticsType === 'all' || analyticsType === 'chat'),
  });

  const isLoading = voiceLoading || chatLoading || chatSessionsLoading;

  // Calculate combined metrics
  const getCombinedMetrics = () => {
    const voiceCalls = voiceData?.totalCalls || 0;
    const chats = chatOverview?.totalChats || 0;
    const voiceCost = voiceData?.totalCost || 0;
    const chatCost = chatOverview?.totalCost || 0;
    const totalInteractions = voiceCalls + chats;
    const totalCost = voiceCost + chatCost;
    const averageCost = totalInteractions > 0 ? totalCost / totalInteractions : 0;

    return {
      totalInteractions,
      voiceCalls,
      chats,
      totalCost,
      averageCost,
      voiceCost,
      chatCost,
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
          <Label>Time Range</Label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
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

            {(analyticsType === 'all' || analyticsType === 'voice') && voiceData && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Voice Success Rate</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {((voiceData.successRate || 0) * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {voiceData.completedCalls} completed calls
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
                          {chat.userSentiment === 'positive' && (
                            <Badge className="bg-green-100 text-green-800">
                              <Smile className="h-3 w-3 mr-1" />
                              Positive
                            </Badge>
                          )}
                          {chat.userSentiment === 'neutral' && (
                            <Badge className="bg-gray-100 text-gray-800">
                              <Meh className="h-3 w-3 mr-1" />
                              Neutral
                            </Badge>
                          )}
                          {chat.userSentiment === 'negative' && (
                            <Badge className="bg-red-100 text-red-800">
                              <Frown className="h-3 w-3 mr-1" />
                              Negative
                            </Badge>
                          )}
                          {!chat.userSentiment && <Badge variant="outline">Unknown</Badge>}
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
