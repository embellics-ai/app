import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Settings, Palette, MessageSquare, Code } from 'lucide-react';
import type { WidgetConfig } from '@shared/schema';
import { useEffect } from 'react';

const widgetConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #9b7ddd)'),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #ffffff)'),
  borderRadius: z.string().regex(/^\d+(px|rem|em)$/, 'Must be a valid CSS size (e.g., 12px)'),
  position: z
    .enum([
      'top-left',
      'top-center',
      'top-right',
      'middle-left',
      'middle-right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
    ])
    .default('bottom-right'),
  greeting: z.string().max(200).optional(),
  allowedDomains: z.string().optional(),
});

type WidgetConfigFormData = z.infer<typeof widgetConfigSchema>;

export default function WidgetConfigPage() {
  const { toast } = useToast();

  // Query for current widget config (404 means no config exists yet, which is OK)
  const {
    data: config,
    isLoading,
    isError,
    error,
  } = useQuery<WidgetConfig>({
    queryKey: ['/api/widget-config'],
    retry: false, // Don't retry on 404
    meta: {
      skipDefaultFetch: true,
    },
    queryFn: async () => {
      const response = await fetch('/api/widget-config', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      // 404 is OK - it just means no config exists yet
      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch widget configuration');
      }

      return response.json();
    },
  });

  const form = useForm<WidgetConfigFormData>({
    resolver: zodResolver(widgetConfigSchema),
    defaultValues: {
      primaryColor: '#9b7ddd',
      textColor: '#ffffff',
      borderRadius: '12px',
      greeting: 'Hi! How can I help you today?',
      allowedDomains: '',
    },
  });

  // Update form when config loads (using useEffect to prevent infinite render loop)
  useEffect(() => {
    if (config) {
      form.reset({
        primaryColor: config.primaryColor || '#9b7ddd',
        textColor: config.textColor || '#ffffff',
        borderRadius: config.borderRadius || '12px',
        position: (config.position || 'bottom-right') as
          | 'top-left'
          | 'top-center'
          | 'top-right'
          | 'middle-left'
          | 'middle-right'
          | 'bottom-left'
          | 'bottom-center'
          | 'bottom-right',
        greeting: config.greeting || 'Hi! How can I help you today?',
        allowedDomains: config.allowedDomains?.join(', ') || '',
      });
    }
  }, [config]);

  // Update widget config mutation
  const updateConfig = useMutation({
    mutationFn: async (data: WidgetConfigFormData) => {
      const payload = {
        ...data,
        allowedDomains: data.allowedDomains
          ? data.allowedDomains
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean)
          : [],
      };

      // Use POST if config doesn't exist, PATCH if it does
      const method = config ? 'PATCH' : 'POST';
      const response = await apiRequest(method, '/api/widget-config', payload);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/widget-config'] });
      toast({
        title: 'Widget configuration updated',
        description: 'Your changes have been saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update widget configuration.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: WidgetConfigFormData) => {
    updateConfig.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading widget configuration...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Widget Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Customize the appearance and behavior of your chat widget
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Appearance Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>Customize the visual style of your chat widget</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          {...field}
                          type="color"
                          className="w-24 h-12 cursor-pointer"
                          data-testid="input-primary-color"
                        />
                        <span
                          className="text-sm text-muted-foreground font-mono"
                          key={field.value}
                          data-testid="text-color-value"
                        >
                          {field.value}
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Main theme color for buttons, header, and accents
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="textColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Text Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          {...field}
                          type="color"
                          className="w-24 h-12 cursor-pointer"
                          data-testid="input-text-color"
                        />
                        <span className="text-sm text-muted-foreground font-mono" key={field.value}>
                          {field.value}
                        </span>
                      </div>
                    </FormControl>
                    <FormDescription>Text color on primary colored backgrounds</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="borderRadius"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Border Radius</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="12px" data-testid="input-border-radius" />
                    </FormControl>
                    <FormDescription>
                      Corner roundness for widget elements (e.g., 12px, 1rem)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Widget Position</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'bottom-right'}>
                      <FormControl>
                        <SelectTrigger data-testid="select-position">
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="top-left">Top Left</SelectItem>
                        <SelectItem value="top-center">Top Center</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="middle-left">Middle Left</SelectItem>
                        <SelectItem value="middle-right">Middle Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="bottom-center">Bottom Center</SelectItem>
                        <SelectItem value="bottom-right">Bottom Right (Default)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Where the chat widget appears on your website</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Content Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Content
              </CardTitle>
              <CardDescription>Set the default messages for your chat widget</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="greeting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Greeting Message (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Hi! How can I help you today?"
                        data-testid="input-greeting"
                      />
                    </FormControl>
                    <FormDescription>
                      Used as the widget title. Leave empty to show "Let's Chat"
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Configure domain restrictions for your widget</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="allowedDomains"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Domains</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="example.com, *.yourdomain.com"
                        data-testid="input-allowed-domains"
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of domains (with ports) where the widget can be embedded.
                      Examples: localhost:3000, app.example.com, *.example.com (wildcard). Leave
                      empty to allow all domains.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              data-testid="button-reset"
            >
              Reset
            </Button>
            <Button type="submit" disabled={updateConfig.isPending} data-testid="button-save">
              {updateConfig.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
