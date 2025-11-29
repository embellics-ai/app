import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WebhookAnalyticsDashboardProps {
  tenantId: string | null;
  tenantName?: string;
}

interface WebhookSummary {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
}

interface WebhookAnalytic {
  id: string;
  webhookId: string;
  tenantId: string;
  requestPayload: any;
  responseBody: any;
  statusCode: number;
  responseTime: number;
  success: boolean;
  errorMessage: string | null;
  timestamp: string;
}

interface Webhook {
  id: string;
  workflowName: string;
  webhookUrl: string;
  description: string | null;
  isActive: boolean;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastCalledAt: string | null;
}

export default function WebhookAnalyticsDashboard({
  tenantId,
  tenantName,
}: WebhookAnalyticsDashboardProps) {
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');

  // Fetch analytics summary
  const { data: summary, isLoading: summaryLoading } = useQuery<WebhookSummary>({
    queryKey: ['webhook-analytics-summary', tenantId],
    queryFn: async (): Promise<WebhookSummary> => {
      const response = await apiRequest(
        `GET`,
        `/api/platform/tenants/${tenantId}/webhooks/analytics/summary`,
      );
      return await response.json();
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch webhooks list
  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery<Webhook[]>({
    queryKey: ['webhooks', tenantId],
    queryFn: async (): Promise<Webhook[]> => {
      const response = await apiRequest(`GET`, `/api/platform/tenants/${tenantId}/webhooks`);
      return await response.json();
    },
    enabled: !!tenantId,
  });

  // Fetch analytics for selected webhook or all webhooks
  const { data: analytics = [], isLoading: analyticsLoading } = useQuery<WebhookAnalytic[]>({
    queryKey: ['webhook-analytics', tenantId, selectedWebhookId],
    queryFn: async (): Promise<WebhookAnalytic[]> => {
      if (selectedWebhookId === 'all') {
        // Fetch analytics for all webhooks
        const allAnalytics: WebhookAnalytic[] = [];
        for (const webhook of webhooks) {
          const response = await apiRequest(
            `GET`,
            `/api/platform/tenants/${tenantId}/webhooks/${webhook.id}/analytics`,
          );
          const data: WebhookAnalytic[] = await response.json();
          allAnalytics.push(...data);
        }
        return allAnalytics.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
      } else {
        // Fetch analytics for specific webhook
        const response = await apiRequest(
          `GET`,
          `/api/platform/tenants/${tenantId}/webhooks/${selectedWebhookId}/analytics`,
        );
        const data: WebhookAnalytic[] = await response.json();
        return data.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
      }
    },
    enabled: !!tenantId && webhooks.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate success rate
  const successRate = summary
    ? summary.totalCalls > 0
      ? ((summary.successfulCalls / summary.totalCalls) * 100).toFixed(1)
      : '0'
    : '0';

  // Filter analytics by time range
  const filteredAnalytics = analytics.filter((analytic) => {
    const timestamp = new Date(analytic.timestamp).getTime();
    const now = Date.now();
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return now - timestamp <= ranges[timeRange as keyof typeof ranges];
  });

  // Get webhook name by ID
  const getWebhookName = (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId);
    return webhook?.workflowName || 'Unknown';
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!tenantId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Please select a tenant to view webhook analytics</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Webhook Analytics</h2>
        {tenantName && <p className="text-sm text-muted-foreground">Analytics for {tenantName}</p>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary?.totalCalls || 0}</div>
                <p className="text-xs text-muted-foreground">All webhook calls</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {summary?.successfulCalls || 0}
                </div>
                <p className="text-xs text-muted-foreground">Success rate: {successRate}%</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold text-destructive">
                  {summary?.failedCalls || 0}
                </div>
                <p className="text-xs text-muted-foreground">Error calls</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.averageResponseTime
                    ? `${Math.round(summary.averageResponseTime)}ms`
                    : '0ms'}
                </div>
                <p className="text-xs text-muted-foreground">Average time</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-filter">Webhook</Label>
          <Select value={selectedWebhookId} onValueChange={setSelectedWebhookId}>
            <SelectTrigger id="webhook-filter">
              <SelectValue placeholder="Select webhook" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Webhooks</SelectItem>
              {webhooksLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                webhooks.map((webhook) => (
                  <SelectItem key={webhook.id} value={webhook.id}>
                    {webhook.workflowName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-range">Time Range</Label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger id="time-range">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Webhook Performance Table */}
      {webhooks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Webhook Performance
            </CardTitle>
            <CardDescription>Performance metrics for each webhook</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow Name</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Total Calls</TableHead>
                    <TableHead className="text-right">Successful</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                    <TableHead>Last Called</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooksLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : webhooks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No webhooks configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    webhooks.map((webhook) => {
                      const webhookSuccessRate =
                        webhook.totalCalls > 0
                          ? ((webhook.successfulCalls / webhook.totalCalls) * 100).toFixed(1)
                          : '0';
                      return (
                        <TableRow key={webhook.id}>
                          <TableCell className="font-medium">{webhook.workflowName}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                              {webhook.isActive ? 'Active' : 'Disabled'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{webhook.totalCalls}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {webhook.successfulCalls}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {webhook.failedCalls}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                parseFloat(webhookSuccessRate) >= 95
                                  ? 'default'
                                  : parseFloat(webhookSuccessRate) >= 80
                                    ? 'secondary'
                                    : 'destructive'
                              }
                            >
                              {webhookSuccessRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {webhook.lastCalledAt ? formatTimestamp(webhook.lastCalledAt) : 'Never'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Webhook Calls
          </CardTitle>
          <CardDescription>
            {filteredAnalytics.length} calls in the{' '}
            {timeRange === '1h'
              ? 'last hour'
              : timeRange === '24h'
                ? 'last 24 hours'
                : timeRange === '7d'
                  ? 'last 7 days'
                  : 'last 30 days'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredAnalytics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhook calls in the selected time range
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Webhook</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Response Time</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnalytics.slice(0, 50).map((analytic) => (
                    <TableRow key={analytic.id}>
                      <TableCell className="text-sm">
                        {formatTimestamp(analytic.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getWebhookName(analytic.webhookId)}
                      </TableCell>
                      <TableCell className="text-center">
                        {analytic.success ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {analytic.statusCode}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            {analytic.statusCode || 'Error'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {Math.round(analytic.responseTime)}ms
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {analytic.errorMessage || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
