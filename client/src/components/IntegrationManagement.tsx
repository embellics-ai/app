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
            {/* N8N Base Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>N8N Configuration</CardTitle>
                <CardDescription>Configure N8N base URL and API credentials</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...n8nForm}>
                  <form
                    onSubmit={n8nForm.handleSubmit((data) => updateN8NMutation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField
                      control={n8nForm.control}
                      name="baseUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>N8N Base URL</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="https://n8n.hostinger.com/webhook/tenant-id"
                            />
                          </FormControl>
                          <FormDescription>
                            Base URL for N8N webhooks (e.g., https://n8n.hostinger.com/webhook/
                            {tenantId})
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={n8nForm.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key (Optional)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showN8NKey ? 'text' : 'password'}
                                placeholder={
                                  integration?.n8nApiKey
                                    ? 'Leave blank to keep existing'
                                    : 'Your API key'
                                }
                                className="pr-10"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowN8NKey(!showN8NKey)}
                              >
                                {showN8NKey ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            {integration?.n8nApiKey && (
                              <span className="text-xs text-muted-foreground">
                                Current: {integration.n8nApiKey}
                              </span>
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={updateN8NMutation.isPending}>
                      {updateN8NMutation.isPending ? (
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
        <DialogContent>
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
                        placeholder="https://n8n.hostinger.com/webhook/tenant-id/workflow"
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
