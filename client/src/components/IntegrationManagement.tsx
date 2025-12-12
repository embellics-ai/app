import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  Edit,
  Power,
  PowerOff,
  MessageSquare,
  Mail,
  Webhook,
  Eye,
  EyeOff,
  Zap,
  Bell,
  Settings,
  Check,
  Copy,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import WebhookAnalyticsDashboard from '@/components/WebhookAnalyticsDashboard';

// WhatsApp configuration schema
const whatsappConfigSchema = z.object({
  enabled: z.boolean(),
  phoneNumberId: z.string().optional(),
  businessAccountId: z.string().optional(),
  accessToken: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  phoneNumber: z.string().optional(),
});

// SMS configuration schema
const smsConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['twilio', 'vonage', 'aws_sns']).optional(),
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  phoneNumber: z.string().optional(),
  messagingServiceSid: z.string().optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  from: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  region: z.string().optional(),
});

// N8N configuration schema
const n8nConfigSchema = z.object({
  baseUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  apiKey: z.string().optional(),
});

// Webhook schema
const webhookSchema = z.object({
  workflowName: z.string().min(1, 'Workflow name is required'),
  webhookUrl: z.string().url('Invalid webhook URL'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  authToken: z.string().optional(),
  webhookType: z.enum(['event_listener', 'function_call']).default('event_listener'),
  eventType: z.string().optional(), // For event_listener type
  functionName: z.string().optional(), // For function_call type
  responseTimeout: z.number().min(1000).max(30000).default(10000).optional(), // For function_call
  retryOnFailure: z.boolean().default(false).optional(),
});

type WhatsAppConfig = z.infer<typeof whatsappConfigSchema>;
type SMSConfig = z.infer<typeof smsConfigSchema>;
type N8NConfig = z.infer<typeof n8nConfigSchema>;
type WebhookFormData = z.infer<typeof webhookSchema>;

interface IntegrationManagementProps {
  tenantId: string | null;
  tenantName?: string;
}

interface Integration {
  id?: string;
  tenantId: string;
  whatsappEnabled?: boolean;
  whatsappConfig?: {
    phoneNumberId?: string;
    businessAccountId?: string;
    accessToken?: string;
    webhookVerifyToken?: string;
    phoneNumber?: string;
  } | null;
  smsEnabled?: boolean;
  smsConfig?: {
    provider?: 'twilio' | 'vonage' | 'aws_sns';
    accountSid?: string;
    authToken?: string;
    phoneNumber?: string;
    messagingServiceSid?: string;
  } | null;
  n8nBaseUrl?: string | null;
  n8nApiKey?: string | null;
}

export default function IntegrationManagement({
  tenantId,
  tenantName,
}: IntegrationManagementProps) {
  const { toast } = useToast();
  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);
  const [showSMSToken, setShowSMSToken] = useState(false);
  const [showN8NKey, setShowN8NKey] = useState(false);
  const [webhookDialog, setWebhookDialog] = useState<{
    open: boolean;
    webhook: any | null;
  }>({
    open: false,
    webhook: null,
  });

  // Fetch integration configuration
  const { data: integration, isLoading: integrationLoading } = useQuery<Integration>({
    queryKey: [`/api/platform/tenants/${tenantId}/integrations`],
    enabled: !!tenantId,
  });

  // Fetch webhooks
  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery<any[]>({
    queryKey: [`/api/platform/tenants/${tenantId}/webhooks`],
    enabled: !!tenantId,
  });

  // WhatsApp form
  const whatsappForm = useForm<WhatsAppConfig>({
    resolver: zodResolver(whatsappConfigSchema),
    values: {
      enabled: integration?.whatsappEnabled || false,
      phoneNumberId: integration?.whatsappConfig?.phoneNumberId || '',
      businessAccountId: integration?.whatsappConfig?.businessAccountId || '',
      accessToken: '', // Never pre-fill sensitive data
      webhookVerifyToken: '',
      phoneNumber: integration?.whatsappConfig?.phoneNumber || '',
    },
  });

  // SMS form
  const smsForm = useForm<SMSConfig>({
    resolver: zodResolver(smsConfigSchema),
    values: {
      enabled: integration?.smsEnabled || false,
      provider: integration?.smsConfig?.provider || 'twilio',
      accountSid: integration?.smsConfig?.accountSid || '',
      authToken: '', // Never pre-fill
      phoneNumber: integration?.smsConfig?.phoneNumber || '',
      messagingServiceSid: integration?.smsConfig?.messagingServiceSid || '',
    },
  });

  // N8N form
  const n8nForm = useForm<N8NConfig>({
    resolver: zodResolver(n8nConfigSchema),
    values: {
      baseUrl: integration?.n8nBaseUrl || '',
      apiKey: '', // Never pre-fill
    },
  });

  // Webhook form
  const webhookForm = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      workflowName: '',
      webhookUrl: '',
      description: '',
      isActive: true,
      authToken: '',
      webhookType: 'event_listener',
      eventType: 'chat_analyzed',
      functionName: '',
      responseTimeout: 10000,
      retryOnFailure: false,
    },
  });

  // WhatsApp mutation
  const updateWhatsAppMutation = useMutation({
    mutationFn: async (data: WhatsAppConfig) => {
      const response = await apiRequest(
        'PUT',
        `/api/platform/tenants/${tenantId}/integrations/whatsapp`,
        data,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'WhatsApp configuration updated',
        description: 'Changes saved successfully',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/integrations`],
      });
      // Reset sensitive fields
      whatsappForm.setValue('accessToken', '');
      whatsappForm.setValue('webhookVerifyToken', '');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update WhatsApp configuration',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // SMS mutation
  const updateSMSMutation = useMutation({
    mutationFn: async (data: SMSConfig) => {
      const response = await apiRequest(
        'PUT',
        `/api/platform/tenants/${tenantId}/integrations/sms`,
        data,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'SMS configuration updated',
        description: 'Changes saved successfully',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/integrations`],
      });
      // Reset sensitive fields
      smsForm.setValue('authToken', '');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update SMS configuration',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // N8N mutation
  const updateN8NMutation = useMutation({
    mutationFn: async (data: N8NConfig) => {
      const response = await apiRequest(
        'PUT',
        `/api/platform/tenants/${tenantId}/integrations/n8n`,
        data,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'N8N configuration updated',
        description: 'Changes saved successfully',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/integrations`],
      });
      // Reset sensitive fields
      n8nForm.setValue('apiKey', '');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update N8N configuration',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (data: WebhookFormData) => {
      const response = await apiRequest('POST', `/api/platform/tenants/${tenantId}/webhooks`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Webhook created',
        description: 'N8N webhook added successfully',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/webhooks`],
      });
      setWebhookDialog({ open: false, webhook: null });
      webhookForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create webhook',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Update webhook mutation
  const updateWebhookMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WebhookFormData> }) => {
      const response = await apiRequest(
        'PUT',
        `/api/platform/tenants/${tenantId}/webhooks/${id}`,
        data,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Webhook updated',
        description: 'Changes saved successfully',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/webhooks`],
      });
      setWebhookDialog({ open: false, webhook: null });
      webhookForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update webhook',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(
        'DELETE',
        `/api/platform/tenants/${tenantId}/webhooks/${id}`,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Webhook deleted',
        description: 'Webhook removed successfully',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/webhooks`],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete webhook',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  if (!tenantId) {
    return (
      <Alert>
        <AlertDescription>Please select a tenant to manage integrations</AlertDescription>
      </Alert>
    );
  }

  if (integrationLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integration Management</h2>
        {tenantName && (
          <p className="text-muted-foreground">Configure integrations for {tenantName}</p>
        )}
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="w-4 h-4 mr-2" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="sms">
            <Bell className="w-4 h-4 mr-2" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="n8n">
            <Zap className="w-4 h-4 mr-2" />
            N8N Webhooks
          </TabsTrigger>
          <TabsTrigger value="external-apis">
            <Settings className="w-4 h-4 mr-2" />
            External APIs
          </TabsTrigger>
        </TabsList>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Business API</CardTitle>
              <CardDescription>
                Configure WhatsApp Business API credentials for this tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...whatsappForm}>
                <form
                  onSubmit={whatsappForm.handleSubmit((data) =>
                    updateWhatsAppMutation.mutate(data),
                  )}
                  className="space-y-4"
                >
                  <FormField
                    control={whatsappForm.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable WhatsApp Integration</FormLabel>
                          <FormDescription>
                            Allow this tenant to send/receive WhatsApp messages
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {whatsappForm.watch('enabled') && (
                    <>
                      <FormField
                        control={whatsappForm.control}
                        name="phoneNumberId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="123456789012345" />
                            </FormControl>
                            <FormDescription>
                              WhatsApp Business Account Phone Number ID
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={whatsappForm.control}
                        name="businessAccountId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Account ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="987654321098765" />
                            </FormControl>
                            <FormDescription>WhatsApp Business Account ID</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={whatsappForm.control}
                        name="accessToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Access Token</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type={showWhatsAppToken ? 'text' : 'password'}
                                  placeholder={
                                    integration?.whatsappConfig
                                      ? 'Leave blank to keep existing'
                                      : 'EAAxxxxx...'
                                  }
                                  className="pr-10"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3"
                                  onClick={() => setShowWhatsAppToken(!showWhatsAppToken)}
                                >
                                  {showWhatsAppToken ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </FormControl>
                            <FormDescription>
                              {integration?.whatsappConfig?.accessToken && (
                                <span className="text-xs text-muted-foreground">
                                  Current: {integration.whatsappConfig.accessToken}
                                </span>
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={whatsappForm.control}
                        name="webhookVerifyToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Webhook Verify Token</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder={
                                  integration?.whatsappConfig
                                    ? 'Leave blank to keep existing'
                                    : 'Your secret token'
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              Token used to verify webhook requests from WhatsApp
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={whatsappForm.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="+1234567890" />
                            </FormControl>
                            <FormDescription>
                              Display phone number (e.g., +1 555-123-4567)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <Button type="submit" disabled={updateWhatsAppMutation.isPending}>
                    {updateWhatsAppMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle>SMS Configuration</CardTitle>
              <CardDescription>
                Configure SMS provider credentials (Twilio, Vonage, or AWS SNS)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...smsForm}>
                <form
                  onSubmit={smsForm.handleSubmit((data) => updateSMSMutation.mutate(data))}
                  className="space-y-4"
                >
                  <FormField
                    control={smsForm.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable SMS Integration</FormLabel>
                          <FormDescription>Allow this tenant to send SMS messages</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {smsForm.watch('enabled') && (
                    <>
                      <FormField
                        control={smsForm.control}
                        name="provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMS Provider</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="twilio">Twilio</SelectItem>
                                <SelectItem value="vonage">Vonage</SelectItem>
                                <SelectItem value="aws_sns">AWS SNS</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {smsForm.watch('provider') === 'twilio' && (
                        <>
                          <FormField
                            control={smsForm.control}
                            name="accountSid"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Account SID</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="ACxxxxx..." />
                                </FormControl>
                                <FormDescription>Twilio Account SID</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={smsForm.control}
                            name="authToken"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Auth Token</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      {...field}
                                      type={showSMSToken ? 'text' : 'password'}
                                      placeholder={
                                        integration?.smsConfig
                                          ? 'Leave blank to keep existing'
                                          : 'Your auth token'
                                      }
                                      className="pr-10"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3"
                                      onClick={() => setShowSMSToken(!showSMSToken)}
                                    >
                                      {showSMSToken ? (
                                        <EyeOff className="w-4 h-4" />
                                      ) : (
                                        <Eye className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  {integration?.smsConfig?.authToken && (
                                    <span className="text-xs text-muted-foreground">
                                      Current: {integration.smsConfig.authToken}
                                    </span>
                                  )}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={smsForm.control}
                            name="phoneNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="+1234567890" />
                                </FormControl>
                                <FormDescription>Twilio phone number</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={smsForm.control}
                            name="messagingServiceSid"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Messaging Service SID (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="MGxxxxx..." />
                                </FormControl>
                                <FormDescription>
                                  Optional: Use messaging service instead of phone number
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                    </>
                  )}

                  <Button type="submit" disabled={updateSMSMutation.isPending}>
                    {updateSMSMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* N8N Webhooks Tab */}
        <TabsContent value="n8n">
          <div className="space-y-4">
            {/* Webhooks List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>N8N Webhooks</CardTitle>
                  <CardDescription>Manage workflow webhooks for this tenant</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    webhookForm.reset();
                    setWebhookDialog({ open: true, webhook: null });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Webhook
                </Button>
              </CardHeader>
              <CardContent>
                {webhooksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No webhooks configured
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Workflow Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Stats</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {webhooks.map((webhook: any) => (
                          <TableRow key={webhook.id}>
                            <TableCell className="font-medium">{webhook.workflowName}</TableCell>
                            <TableCell>
                              {webhook.webhookType === 'function_call' ? (
                                <Badge variant="outline" className="bg-blue-50">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Function: {webhook.functionName}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-purple-50">
                                  <Bell className="w-3 h-3 mr-1" />
                                  Event: {webhook.eventType || '*'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {webhook.webhookUrl}
                            </TableCell>
                            <TableCell>
                              {webhook.isActive ? (
                                <Badge variant="default">
                                  <Power className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <PowerOff className="w-3 h-3 mr-1" />
                                  Disabled
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div>
                                {webhook.totalCalls || 0} calls ({webhook.successfulCalls || 0}{' '}
                                success)
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    const functionUrl =
                                      webhook.webhookType === 'function_call'
                                        ? `https://embellics-app.onrender.com/api/functions/${webhook.functionName}`
                                        : webhook.webhookUrl;

                                    try {
                                      await navigator.clipboard.writeText(functionUrl);
                                      toast({
                                        title: 'URL Copied!',
                                        description: 'Webhook URL copied to clipboard',
                                      });
                                    } catch (err) {
                                      toast({
                                        title: 'Copy Failed',
                                        description: 'Failed to copy URL to clipboard',
                                        variant: 'destructive',
                                      });
                                    }
                                  }}
                                  title="Copy URL"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    webhookForm.reset({
                                      workflowName: webhook.workflowName,
                                      webhookUrl: webhook.webhookUrl,
                                      description: webhook.description || '',
                                      isActive: webhook.isActive,
                                      authToken: '',
                                      webhookType: webhook.webhookType || 'event_listener',
                                      eventType: webhook.eventType || 'chat_analyzed',
                                      functionName: webhook.functionName || '',
                                      responseTimeout: webhook.responseTimeout || 10000,
                                      retryOnFailure: webhook.retryOnFailure || false,
                                    });
                                    setWebhookDialog({ open: true, webhook });
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the webhook "
                                        {webhook.workflowName}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analytics Dashboard */}
            <WebhookAnalyticsDashboard tenantId={tenantId} tenantName={tenantName} />
          </div>
        </TabsContent>

        {/* External APIs Tab */}
        <TabsContent value="external-apis">
          <ExternalAPIsTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>

      {/* Webhook Dialog */}
      <Dialog
        open={webhookDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setWebhookDialog({ open: false, webhook: null });
            webhookForm.reset();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{webhookDialog.webhook ? 'Edit' : 'Add'} Webhook</DialogTitle>
            <DialogDescription>
              {webhookDialog.webhook ? 'Update webhook configuration' : 'Create a new N8N webhook'}
            </DialogDescription>
          </DialogHeader>
          <Form {...webhookForm}>
            <form
              onSubmit={webhookForm.handleSubmit((data) => {
                if (webhookDialog.webhook) {
                  updateWebhookMutation.mutate({ id: webhookDialog.webhook.id, data });
                } else {
                  createWebhookMutation.mutate(data);
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={webhookForm.control}
                name="workflowName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workflow Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="contact_form"
                        disabled={!!webhookDialog.webhook}
                      />
                    </FormControl>
                    <FormDescription>
                      Unique name for this workflow (e.g., contact_form, booking_request)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={webhookForm.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="url"
                        autoComplete="off"
                        placeholder="https://n8n.example.com/webhook/your-tenant/workflow-name"
                      />
                    </FormControl>
                    <FormDescription>Full URL to the N8N webhook endpoint</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={webhookForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="What does this webhook do?" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={webhookForm.control}
                name="webhookType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook Type</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        onChange={(e) => {
                          field.onChange(e);
                          // Reset conditional fields when type changes
                          if (e.target.value === 'event_listener') {
                            webhookForm.setValue('functionName', '');
                            webhookForm.setValue('eventType', 'chat_analyzed');
                          } else {
                            webhookForm.setValue('eventType', '');
                          }
                        }}
                      >
                        <option value="event_listener">Event Listener (Async)</option>
                        <option value="function_call">Function Call (Sync)</option>
                      </select>
                    </FormControl>
                    <FormDescription>
                      Event listeners receive async notifications. Function calls are called during
                      conversations and must respond.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {webhookForm.watch('webhookType') === 'event_listener' && (
                <>
                  <FormField
                    control={webhookForm.control}
                    name="eventType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Type</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="chat_analyzed">Chat Analyzed</option>
                            <option value="call_analyzed">Call Analyzed</option>
                            <option value="chat_started">Chat Started</option>
                            <option value="chat_ended">Chat Ended</option>
                            <option value="call_started">Call Started</option>
                            <option value="call_ended">Call Ended</option>
                            <option value="whatsapp_message">WhatsApp Message</option>
                            <option value="*">All Events (*)</option>
                          </select>
                        </FormControl>
                        <FormDescription>
                          Which Retell event should trigger this webhook?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Event Webhook URL Display */}
                  {webhookForm.watch('webhookUrl') && (
                    <div className="space-y-2 rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-purple-900">
                        <Webhook className="h-4 w-4" />
                        N8N Webhook URL:
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-white px-3 py-2 text-xs text-gray-800 border border-purple-200 break-all">
                          {webhookForm.watch('webhookUrl')}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const url = webhookForm.watch('webhookUrl');
                            try {
                              await navigator.clipboard.writeText(url);
                              toast({
                                title: 'URL Copied!',
                                description: 'N8N webhook URL copied to clipboard',
                              });
                            } catch (err) {
                              toast({
                                title: 'Copy Failed',
                                description: 'Failed to copy URL to clipboard',
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-purple-700">
                        This is your N8N workflow webhook endpoint that receives{' '}
                        {webhookForm.watch('eventType')} events
                      </p>
                    </div>
                  )}
                </>
              )}

              {webhookForm.watch('webhookType') === 'function_call' && (
                <>
                  <FormField
                    control={webhookForm.control}
                    name="functionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Function Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="get_booking_details"
                            disabled={!!webhookDialog.webhook}
                          />
                        </FormControl>
                        <FormDescription>
                          Exact function name as configured in Retell agent (e.g.,
                          get_booking_details, create_booking)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Function Endpoint URL Display */}
                  {webhookForm.watch('functionName') && (
                    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                        <Settings className="h-4 w-4" />
                        Function Endpoint URL:
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-white px-3 py-2 text-xs text-gray-800 border border-blue-200">
                          https://embellics-app.onrender.com/api/functions/
                          {webhookForm.watch('functionName')}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const url = `https://embellics-app.onrender.com/api/functions/${webhookForm.watch('functionName')}`;
                            try {
                              await navigator.clipboard.writeText(url);
                              toast({
                                title: 'URL Copied!',
                                description: 'Function endpoint URL copied to clipboard',
                              });
                            } catch (err) {
                              toast({
                                title: 'Copy Failed',
                                description: 'Failed to copy URL to clipboard',
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-blue-700">
                        Use this URL in Retell's custom function configuration
                      </p>
                    </div>
                  )}

                  <FormField
                    control={webhookForm.control}
                    name="responseTimeout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response Timeout (ms)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1000}
                            max={30000}
                            step={1000}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum wait time for N8N response (1000-30000ms)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={webhookForm.control}
                    name="retryOnFailure"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Retry on Failure</FormLabel>
                          <FormDescription>
                            Automatically retry if N8N webhook fails
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={webhookForm.control}
                name="authToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auth Token (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={
                          webhookDialog.webhook ? 'Leave blank to keep existing' : 'Optional token'
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Optional: Bearer token for webhook authentication
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={webhookForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Enable or disable this webhook</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setWebhookDialog({ open: false, webhook: null });
                    webhookForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createWebhookMutation.isPending || updateWebhookMutation.isPending}
                >
                  {createWebhookMutation.isPending || updateWebhookMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// External APIs Tab Component
function ExternalAPIsTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<any>(null);

  // Helper function to get the base URL - simply use current origin
  const getBaseUrl = () => window.location.origin;

  // Helper function to format auth type labels
  const formatAuthType = (authType: string) => {
    const authTypeLabels: Record<string, string> = {
      bearer: 'Bearer Token',
      api_key: 'API Key',
      basic: 'Basic Auth',
      oauth2: 'OAuth2',
      google_service_account: 'Google Service Account',
      custom_header: 'Custom Header',
      none: 'None',
    };
    return authTypeLabels[authType] || authType;
  };

  // Simple form state
  const [formData, setFormData] = useState({
    serviceName: '',
    displayName: '',
    baseUrl: '',
    authType: 'bearer',
    description: '',
    credentials: {} as Record<string, string>,
  });

  // Fetch external API configurations
  const { data: externalApis, isLoading } = useQuery({
    queryKey: [`/api/platform/tenants/${tenantId}/external-apis`],
  });

  const apis = Array.isArray(externalApis) ? externalApis : [];

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      let response;
      if (editingApi) {
        response = await apiRequest(
          'PUT',
          `/api/platform/tenants/${tenantId}/external-apis/${editingApi.id}`,
          data,
        );
      } else {
        response = await apiRequest(
          'POST',
          `/api/platform/tenants/${tenantId}/external-apis`,
          data,
        );
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: `External API ${editingApi ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/external-apis`],
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${editingApi ? 'update' : 'create'} external API`,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(
        'DELETE',
        `/api/platform/tenants/${tenantId}/external-apis/${id}`,
        undefined,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'External API deleted successfully',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/external-apis`],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete external API',
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (api: any) => {
    setEditingApi(api);
    setFormData({
      serviceName: api.serviceName,
      displayName: api.displayName,
      baseUrl: api.baseUrl,
      authType: api.authType,
      description: api.description || '',
      credentials: {},
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingApi(null);
    setFormData({
      serviceName: '',
      displayName: '',
      baseUrl: '',
      authType: 'bearer',
      description: '',
      credentials: {},
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingApi(null);
    setFormData({
      serviceName: '',
      displayName: '',
      baseUrl: '',
      authType: 'bearer',
      description: '',
      credentials: {},
    });
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateCredential = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData: any = {
      serviceName: formData.serviceName,
      displayName: formData.displayName,
      baseUrl: formData.baseUrl,
      authType: formData.authType,
      description: formData.description,
      credentials: formData.credentials,
    };

    saveMutation.mutate(submitData);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>External API Configurations</CardTitle>
            <CardDescription>
              Configure external APIs that N8N can call through the generic HTTP proxy. No coding
              required!
            </CardDescription>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="w-4 h-4 mr-2" />
            Add API
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : apis.length === 0 ? (
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              No external APIs configured yet. Add your first API to enable N8N workflows to call
              Google Calendar, Stripe, SendGrid, or any other external service without exposing
              credentials.
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Auth Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Proxy URL</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apis.map((api: any) => {
                const proxyUrl = `${getBaseUrl()}/api/proxy/${tenantId}/http/${api.serviceName}/ENDPOINT_PATH`;
                return (
                  <TableRow key={api.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{api.displayName}</div>
                        <div className="text-sm text-muted-foreground">{api.serviceName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{api.baseUrl}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatAuthType(api.authType)}</Badge>
                    </TableCell>
                    <TableCell>
                      {api.isActive ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{api.totalCalls || 0} calls</div>
                        <div className="text-muted-foreground">
                          {api.successfulCalls || 0} success / {api.failedCalls || 0} failed
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(proxyUrl);
                          toast({
                            title: 'Copied!',
                            description: 'Proxy URL copied to clipboard',
                          });
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy URL
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(api)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {api.displayName}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this API configuration. N8N workflows
                                using this API will stop working.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(api.id)}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  'Delete'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Add/Edit Dialog */}
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (!open) handleCloseDialog();
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingApi ? 'Edit' : 'Add'} External API</DialogTitle>
              <DialogDescription>
                Configure an external API that N8N can call through the proxy endpoint.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Service Name</label>
                <Input
                  value={formData.serviceName}
                  onChange={(e) => updateField('serviceName', e.target.value)}
                  placeholder="google_calendar"
                  disabled={!!editingApi}
                  required
                  pattern="[a-z0-9_]+"
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for the proxy URL (lowercase, numbers, underscores only)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  value={formData.displayName}
                  onChange={(e) => updateField('displayName', e.target.value)}
                  placeholder="Google Calendar"
                  required
                />
                <p className="text-xs text-muted-foreground">User-friendly name shown in the UI</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Base URL</label>
                <Input
                  value={formData.baseUrl}
                  onChange={(e) => updateField('baseUrl', e.target.value)}
                  placeholder="https://www.googleapis.com"
                  type="url"
                  required
                />
                <p className="text-xs text-muted-foreground">Base URL of the external API</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Authentication Type</label>
                <Select
                  value={formData.authType}
                  onValueChange={(value) => {
                    updateField('authType', value);
                    updateField('credentials', {});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select auth type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="api_key">API Key (Custom Header)</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="oauth2">OAuth2</SelectItem>
                    <SelectItem value="google_service_account">
                      Google Service Account (JSON)
                    </SelectItem>
                    <SelectItem value="custom_header">Custom Header</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">How to authenticate with this API</p>
              </div>

              {/* Credentials based on auth type */}
              {formData.authType === 'bearer' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bearer Token</label>
                  {editingApi && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950 rounded-md border border-purple-200 dark:border-purple-800 mb-2">
                      <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-mono text-purple-700 dark:text-purple-300">
                        {editingApi.serviceName}_********
                      </span>
                      <Badge variant="secondary" className="ml-auto">
                        Current
                      </Badge>
                    </div>
                  )}
                  <Input
                    value={formData.credentials.token || ''}
                    onChange={(e) => updateCredential('token', e.target.value)}
                    type="password"
                    placeholder={
                      editingApi ? 'Enter new token to update' : 'Enter your bearer token'
                    }
                    required={!editingApi}
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingApi
                      ? 'Enter a new token to update, or leave empty to keep existing.'
                      : 'The bearer token for authentication'}
                  </p>
                </div>
              )}

              {formData.authType === 'api_key' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Header Name</label>
                    <Input
                      value={formData.credentials.headerName || ''}
                      onChange={(e) => updateCredential('headerName', e.target.value)}
                      placeholder="X-API-Key"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Header name for the API key</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">API Key</label>
                    <Input
                      value={formData.credentials.key || ''}
                      onChange={(e) => updateCredential('key', e.target.value)}
                      type="password"
                      placeholder="abc123..."
                      required
                    />
                    <p className="text-xs text-muted-foreground">Your API key</p>
                  </div>
                </>
              )}

              {formData.authType === 'basic' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <Input
                      value={formData.credentials.username || ''}
                      onChange={(e) => updateCredential('username', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                      value={formData.credentials.password || ''}
                      onChange={(e) => updateCredential('password', e.target.value)}
                      type="password"
                      required
                    />
                  </div>
                </>
              )}

              {formData.authType === 'oauth2' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Access Token</label>
                  <Input
                    value={formData.credentials.accessToken || ''}
                    onChange={(e) => updateCredential('accessToken', e.target.value)}
                    type="password"
                    placeholder="ya29.a0..."
                    required
                  />
                  <p className="text-xs text-muted-foreground">OAuth2 access token</p>
                </div>
              )}

              {formData.authType === 'custom_header' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Header Name</label>
                    <Input
                      value={formData.credentials.headerName || ''}
                      onChange={(e) => updateCredential('headerName', e.target.value)}
                      placeholder="X-Custom-Auth"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Header Value</label>
                    <Input
                      value={formData.credentials.headerValue || ''}
                      onChange={(e) => updateCredential('headerValue', e.target.value)}
                      type="password"
                      required
                    />
                  </div>
                </>
              )}

              {formData.authType === 'google_service_account' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service Account JSON</label>
                  {editingApi && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800 mb-2">
                      <Settings className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-700 dark:text-green-300">
                        Current: {editingApi.serviceName}_service_account (encrypted)
                      </span>
                      <Badge variant="secondary" className="ml-auto">
                        Configured
                      </Badge>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const json = event.target?.result as string;
                              const parsed = JSON.parse(json);

                              // Validate required fields
                              if (
                                !parsed.client_email ||
                                !parsed.private_key ||
                                !parsed.project_id
                              ) {
                                toast({
                                  variant: 'destructive',
                                  title: 'Invalid Service Account',
                                  description:
                                    'JSON must contain client_email, private_key, and project_id',
                                });
                                return;
                              }

                              updateCredential('serviceAccountJson', json);
                              toast({
                                title: 'File Loaded',
                                description: `Service account: ${parsed.client_email}`,
                              });
                            } catch (error) {
                              toast({
                                variant: 'destructive',
                                title: 'Invalid JSON',
                                description: 'Please upload a valid service account JSON file',
                              });
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                      required={!editingApi}
                    />
                    <p className="text-xs text-muted-foreground">
                      {editingApi
                        ? 'Upload a new service account JSON to update, or leave empty to keep existing.'
                        : 'Upload the Google service account JSON key file'}
                    </p>
                  </div>
                  {formData.credentials.serviceAccountJson && (
                    <Alert>
                      <Settings className="h-4 w-4" />
                      <AlertDescription>
                        Service Account:{' '}
                        <code className="font-mono text-xs">
                          {JSON.parse(formData.credentials.serviceAccountJson).client_email}
                        </code>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="What this API is used for..."
                />
              </div>

              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-3">
                    <div>
                      <strong>Proxy Endpoint URL (This Tenant):</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">
                        {getBaseUrl()}/api/proxy/{tenantId}/http/
                        {formData.serviceName || 'SERVICE_NAME'}/ENDPOINT_PATH
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `${getBaseUrl()}/api/proxy/${tenantId}/http/${formData.serviceName || 'SERVICE_NAME'}/ENDPOINT_PATH`;
                          navigator.clipboard.writeText(url);
                          toast({
                            title: 'Copied!',
                            description: 'Static proxy URL copied to clipboard',
                          });
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use this for single-tenant workflows
                    </p>

                    <div className="border-t pt-3">
                      <strong>Dynamic URL (Multi-Tenant):</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 break-all">
                        {getBaseUrl()}/api/proxy/{`{{ tenantId }}`}/http/
                        {formData.serviceName || 'SERVICE_NAME'}/{`{{ endpoint }}`}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `${getBaseUrl()}/api/proxy/{{ tenantId }}/http/${formData.serviceName || 'SERVICE_NAME'}/{{ endpoint }}`;
                          navigator.clipboard.writeText(url);
                          toast({
                            title: 'Copied!',
                            description: 'Dynamic N8N expression copied to clipboard',
                          });
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use this to get tenantId and endpoint from previous node (e.g., from webhook
                      body)
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
