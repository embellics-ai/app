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
            <Mail className="w-4 h-4 mr-2" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="n8n">
            <Webhook className="w-4 h-4 mr-2" />
            N8N Webhooks
          </TabsTrigger>
          <TabsTrigger value="oauth">
            <Zap className="w-4 h-4 mr-2" />
            OAuth Connections
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

        {/* OAuth Connections Tab */}
        <TabsContent value="oauth">
          <Card>
            <CardHeader>
              <CardTitle>OAuth Connections</CardTitle>
              <CardDescription>
                Connect third-party services securely with OAuth. Your credentials are encrypted and
                never exposed to N8N workflows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* WhatsApp OAuth Card */}
              <OAuthConnectionCard
                tenantId={tenantId}
                provider="whatsapp"
                title="WhatsApp Business API"
                description="Connect your WhatsApp Business Account to send messages through N8N workflows without exposing your access token."
                icon={<MessageSquare className="w-6 h-6" />}
              />

              {/* Future: Add more OAuth providers here */}
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertDescription>
                  More OAuth providers (Google Sheets, Slack, etc.) will be available soon.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
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

// OAuth Connection Card Component
function OAuthConnectionCard({
  tenantId,
  provider,
  title,
  description,
  icon,
}: {
  tenantId: string;
  provider: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  // Fetch OAuth credential status
  const { data: oauthStatus, isLoading } = useQuery({
    queryKey: [`/api/platform/tenants/${tenantId}/oauth/${provider}`],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenantId}/oauth/${provider}`,
      );
      return await response.json();
    },
  });

  // Configure OAuth app mutation
  const configureMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/platform/tenants/${tenantId}/oauth/${provider}/configure`,
        {
          clientId,
          clientSecret,
        },
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Configured successfully',
        description: 'Your OAuth app credentials have been saved. You can now connect.',
      });
      setConfiguring(false);
      setClientId('');
      setClientSecret('');
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/oauth/${provider}`],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Configuration failed',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Delete OAuth credential mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'DELETE',
        `/api/platform/tenants/${tenantId}/oauth/${provider}`,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Disconnected',
        description: `${title} has been disconnected successfully`,
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/platform/tenants/${tenantId}/oauth/${provider}`],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to disconnect',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Test connection function
  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch(`/api/proxy/${tenantId}/${provider}/test`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_N8N_WEBHOOK_SECRET || ''}`,
        },
      });
      const result = await response.json();

      if (result.connected) {
        toast({
          title: 'Connection successful',
          description: `Connected to ${result.phoneNumber || result.verifiedName || provider}`,
        });
      } else {
        toast({
          title: 'Connection failed',
          description: result.message || 'Unable to connect',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Connection test failed',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  // Connect function - redirect to OAuth authorization
  const handleConnect = () => {
    window.location.href = `/api/platform/tenants/${tenantId}/oauth/${provider}/authorize`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConfigured = oauthStatus?.configured || false;
  const isConnected = oauthStatus?.connected || false;
  const tokenExpiry = oauthStatus?.tokenExpiry ? new Date(oauthStatus.tokenExpiry) : null;
  const isExpired = tokenExpiry && tokenExpiry < new Date();
  const daysUntilExpiry = tokenExpiry
    ? Math.ceil((tokenExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Show configuration form if not configured
  if (!isConfigured && !configuring) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
              <div className="space-y-1">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
                <Alert className="mt-3">
                  <AlertDescription className="text-sm">
                    Configure your OAuth app credentials first. Get these from your{' '}
                    {provider === 'whatsapp' ? 'Meta Developer' : 'provider'} account.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
            <Button onClick={() => setConfiguring(true)} size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show configuration form
  if (configuring) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-semibold">{title} - Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your OAuth app credentials from{' '}
                    {provider === 'whatsapp' ? 'Meta Developer Portal' : 'provider settings'}.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">App ID / Client ID</label>
                    <Input
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder={provider === 'whatsapp' ? 'Your Facebook App ID' : 'Your Client ID'}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">App Secret / Client Secret</label>
                    <Input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder={provider === 'whatsapp' ? 'Your Facebook App Secret' : 'Your Client Secret'}
                      className="mt-1"
                    />
                  </div>

                  {provider === 'whatsapp' && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        Get these from:{' '}
                        <a
                          href="https://developers.facebook.com/apps/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Meta Developer Portal → Your App → Settings → Basic
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={() => configureMutation.mutate()}
                    disabled={!clientId || !clientSecret || configureMutation.isPending}
                    size="sm"
                  >
                    {configureMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setConfiguring(false);
                      setClientId('');
                      setClientSecret('');
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
            <div className="space-y-1">
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>

              {isConnected && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant={isExpired ? 'destructive' : 'default'}>
                      {isExpired ? 'Expired' : 'Connected'}
                    </Badge>
                    {tokenExpiry && !isExpired && (
                      <span className="text-xs text-muted-foreground">
                        Expires in {daysUntilExpiry} days
                      </span>
                    )}
                  </div>

                  {oauthStatus.lastUsedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last used: {new Date(oauthStatus.lastUsedAt).toLocaleDateString()}
                    </p>
                  )}

                  {isExpired && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-sm">
                        Your access token has expired. Please reconnect to continue using this
                        integration.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            {!isConnected ? (
              <Button onClick={handleConnect} size="sm">
                <Zap className="w-4 h-4 mr-2" />
                Connect
              </Button>
            ) : (
              <>
                <Button
                  onClick={testConnection}
                  disabled={testing || Boolean(isExpired)}
                  size="sm"
                  variant="outline"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
                {isExpired && (
                  <Button onClick={handleConnect} size="sm">
                    <Zap className="w-4 h-4 mr-2" />
                    Reconnect
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <PowerOff className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect {title}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove your OAuth credentials. N8N workflows using this connection
                        will stop working until you reconnect.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => disconnectMutation.mutate()}
                        disabled={disconnectMutation.isPending}
                      >
                        {disconnectMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          'Disconnect'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
