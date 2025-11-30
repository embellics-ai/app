import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import {
  BarChart3,
  MessageSquare,
  Phone,
  TrendingUp,
  DollarSign,
  Smile,
  Frown,
  Meh,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EnhancedChatAnalytics from './EnhancedChatAnalytics';

interface AgentAnalyticsDashboardProps {
  tenantId: string | null;
  tenantName?: string;
}

interface AnalyticsOverview {
  chat: {
    totalChats: number;
    successfulChats: number;
    totalDuration: number;
    averageDuration: number;
    totalCost: number;
    averageCost: number;
    sentimentBreakdown: Record<string, number>;
  };
  combined: {
    totalInteractions: number;
    totalCost: number;
    averageCost: number;
  };
}

interface ChatAnalytics {
  id: string;
  chatId: string;
  agentId: string;
  agentName: string | null;
  chatType: string | null;
  chatStatus: string | null;
  startTimestamp: string | null;
  endTimestamp: string | null;
  duration: number | null;
  transcript: string | null;
  messageCount: number;
  toolCallsCount: number;
  chatSummary: string | null;
  userSentiment: string | null;
  chatSuccessful: boolean | null;
  combinedCost: number;
}

interface SentimentAnalytics {
  sentimentBreakdown: Record<string, number>;
  totalChats: number;
  successRate: number;
}

interface CostAnalytics {
  totalCost: number;
  averageCost: number;
  totalChats: number;
  costsByDay: Record<string, number>;
}

export default function AgentAnalyticsDashboard({
  tenantId,
  tenantName,
}: AgentAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');

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

  // Fetch analytics overview
  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics-overview', tenantId, timeRange, selectedAgentId],
    queryFn: async (): Promise<AnalyticsOverview> => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (selectedAgentId !== 'all') {
        params.append('agentId', selectedAgentId);
      }
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/overview?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch chat sessions
  const { data: chats = [], isLoading: chatsLoading } = useQuery<ChatAnalytics[]>({
    queryKey: ['analytics-chats', tenantId, timeRange, selectedAgentId],
    queryFn: async (): Promise<ChatAnalytics[]> => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: '50',
      });
      if (selectedAgentId !== 'all') {
        params.append('agentId', selectedAgentId);
      }
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/chats?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  // Fetch sentiment analytics
  const { data: sentiment, isLoading: sentimentLoading } = useQuery<SentimentAnalytics>({
    queryKey: ['analytics-sentiment', tenantId, timeRange, selectedAgentId],
    queryFn: async (): Promise<SentimentAnalytics> => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (selectedAgentId !== 'all') {
        params.append('agentId', selectedAgentId);
      }
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/sentiment?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  // Fetch cost analytics
  const { data: costs, isLoading: costsLoading } = useQuery<CostAnalytics>({
    queryKey: ['analytics-costs', tenantId, timeRange, selectedAgentId],
    queryFn: async (): Promise<CostAnalytics> => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (selectedAgentId !== 'all') {
        params.append('agentId', selectedAgentId);
      }
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/analytics/costs?${params}`,
      );
      return await response.json();
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });

  // Helper functions
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatCost = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSentimentIcon = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
      case 'satisfied':
        return <Smile className="h-4 w-4 text-green-600" />;
      case 'negative':
      case 'frustrated':
        return <Frown className="h-4 w-4 text-red-600" />;
      case 'neutral':
        return <Meh className="h-4 w-4 text-gray-600" />;
      default:
        return <Meh className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    const variantMap: Record<string, 'default' | 'destructive' | 'secondary'> = {
      positive: 'default',
      satisfied: 'default',
      negative: 'destructive',
      frustrated: 'destructive',
      neutral: 'secondary',
    };
    return (
      <Badge variant={variantMap[sentiment?.toLowerCase() || ''] || 'secondary'}>
        {sentiment || 'Unknown'}
      </Badge>
    );
  };

  if (!tenantId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Please select a tenant to view analytics</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Agent Analytics</h2>
        {tenantName && <p className="text-sm text-muted-foreground">Analytics for {tenantName}</p>}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="time-range">Time Range</Label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger id="time-range">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-filter">Agent</Label>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger id="agent-filter">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {/* TODO: Add dynamic agent list */}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="visualizations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visualizations">
            <BarChart3 className="w-4 h-4 mr-2" />
            Visualizations
          </TabsTrigger>
          <TabsTrigger value="overview">
            <TrendingUp className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="chats">
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat Sessions
          </TabsTrigger>
          <TabsTrigger value="sentiment">
            <Smile className="w-4 h-4 mr-2" />
            Sentiment
          </TabsTrigger>
          <TabsTrigger value="costs">
            <DollarSign className="w-4 h-4 mr-2" />
            Cost Tracking
          </TabsTrigger>
        </TabsList>

        {/* Enhanced Visualizations Tab */}
        <TabsContent value="visualizations">
          <EnhancedChatAnalytics
            tenantId={tenantId!}
            startDate={getDateRange().startDate}
            endDate={getDateRange().endDate}
            agentId={selectedAgentId !== 'all' ? selectedAgentId : undefined}
          />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {overviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{overview?.chat.totalChats || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {overview?.chat.successfulChats || 0} successful
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  {overviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-green-600">
                        {overview?.chat.totalChats
                          ? Math.round(
                              (overview.chat.successfulChats / overview.chat.totalChats) * 100,
                            )
                          : 0}
                        %
                      </div>
                      <p className="text-xs text-muted-foreground">Chat completion rate</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {overviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {formatDuration(Math.round(overview?.chat.averageDuration || 0))}
                      </div>
                      <p className="text-xs text-muted-foreground">Average chat length</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {overviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {formatCost(overview?.chat.totalCost || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatCost(overview?.chat.averageCost || 0)} avg per chat
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sentiment Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Distribution</CardTitle>
                <CardDescription>User sentiment across all chats</CardDescription>
              </CardHeader>
              <CardContent>
                {sentimentLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(sentiment?.sentimentBreakdown || {}).map(([key, value]) => (
                      <div key={key} className="flex flex-col items-center p-4 border rounded-lg">
                        {getSentimentIcon(key)}
                        <div className="mt-2 text-2xl font-bold">{value}</div>
                        <div className="text-sm text-muted-foreground capitalize">{key}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Chat Sessions Tab */}
        <TabsContent value="chats">
          <Card>
            <CardHeader>
              <CardTitle>Recent Chat Sessions</CardTitle>
              <CardDescription>Last 50 chat sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {chatsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No chat sessions in the selected time range
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Messages</TableHead>
                        <TableHead>Sentiment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chats.map((chat) => (
                        <TableRow key={chat.id}>
                          <TableCell className="text-sm">
                            {formatTimestamp(chat.startTimestamp)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {chat.agentName || chat.agentId}
                          </TableCell>
                          <TableCell>{formatDuration(chat.duration)}</TableCell>
                          <TableCell>{chat.messageCount}</TableCell>
                          <TableCell>{getSentimentBadge(chat.userSentiment)}</TableCell>
                          <TableCell>
                            {chat.chatSuccessful ? (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <XCircle className="h-3 w-3 mr-1" />
                                Incomplete
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCost(chat.combinedCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sentiment Tab */}
        <TabsContent value="sentiment">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Analysis</CardTitle>
                <CardDescription>User sentiment breakdown and trends</CardDescription>
              </CardHeader>
              <CardContent>
                {sentimentLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-4xl font-bold">
                          {sentiment?.successRate.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">Success Rate</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-4xl font-bold">{sentiment?.totalChats}</div>
                        <div className="text-sm text-muted-foreground mt-2">Total Chats</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-4xl font-bold">
                          {Object.keys(sentiment?.sentimentBreakdown || {}).length}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          Sentiment Categories
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {Object.entries(sentiment?.sentimentBreakdown || {})
                        .sort(([, a], [, b]) => b - a)
                        .map(([sentiment, count]) => {
                          const percentage = (count / (overview?.chat.totalChats || 1)) * 100;
                          return (
                            <div key={sentiment} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {getSentimentIcon(sentiment)}
                                  <span className="capitalize font-medium">{sentiment}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">{count}</span>
                                  <span className="text-sm font-medium">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2">
                                <div
                                  className="bg-primary rounded-full h-2 transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cost Tracking Tab */}
        <TabsContent value="costs">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cost Analytics</CardTitle>
                <CardDescription>Track and analyze AI usage costs</CardDescription>
              </CardHeader>
              <CardContent>
                {costsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-4xl font-bold">
                          {formatCost(costs?.totalCost || 0)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">Total Cost</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-4xl font-bold">
                          {formatCost(costs?.averageCost || 0)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">Average per Chat</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-4xl font-bold">{costs?.totalChats}</div>
                        <div className="text-sm text-muted-foreground mt-2">Total Chats</div>
                      </div>
                    </div>

                    {/* Daily costs breakdown */}
                    <div>
                      <h4 className="font-medium mb-4">Daily Cost Breakdown</h4>
                      <div className="space-y-2">
                        {Object.entries(costs?.costsByDay || {})
                          .sort(([a], [b]) => b.localeCompare(a))
                          .slice(0, 10)
                          .map(([day, cost]) => (
                            <div
                              key={day}
                              className="flex items-center justify-between p-2 border rounded"
                            >
                              <span className="text-sm">
                                {new Date(day).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              <span className="font-medium">{formatCost(cost)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
