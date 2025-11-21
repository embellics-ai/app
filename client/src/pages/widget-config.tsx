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
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #3B82F6)'),
  position: z.enum(['bottom-right', 'bottom-left']),
  greeting: z.string().min(1, 'Greeting is required').max(200),
  placeholder: z.string().min(1, 'Placeholder is required').max(100),
  allowedDomains: z.string().optional(),
  customCss: z.string().optional(),
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
      primaryColor: '#3B82F6',
      position: 'bottom-right',
      greeting: 'Hi! How can I help you today?',
      placeholder: 'Type your message...',
      allowedDomains: '',
      customCss: '',
    },
  });

  // Update form when config loads (using useEffect to prevent infinite render loop)
  useEffect(() => {
    if (config) {
      form.reset({
        // Note: primaryColor, position, placeholder, customCss removed from schema
        // Widget styling is now fixed in CSS following application design system
        primaryColor: '#3b82f6', // Default value (not stored in DB)
        position: 'bottom-right', // Default value (not stored in DB)
        greeting: config.greeting || 'Hi! How can I help you today?',
        placeholder: 'Type your message...', // Default value (not stored in DB)
        allowedDomains: config.allowedDomains?.join(', ') || '',
        customCss: '', // Default value (not stored in DB)
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
                    <FormDescription>Click the color box to pick your brand color</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-position">
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Where the widget appears on your website</FormDescription>
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
                    <FormLabel>Greeting Message</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Hi! How can I help you today?"
                        data-testid="input-greeting"
                      />
                    </FormControl>
                    <FormDescription>
                      The first message users see when opening the chat
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="placeholder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Input Placeholder</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Type your message..."
                        data-testid="input-placeholder"
                      />
                    </FormControl>
                    <FormDescription>Placeholder text in the message input field</FormDescription>
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
                Security & Advanced
              </CardTitle>
              <CardDescription>Configure security settings and custom styles</CardDescription>
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
                        placeholder="example.com, app.example.com"
                        data-testid="input-allowed-domains"
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated list of domains where the widget can be embedded (leave empty
                      to allow all)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customCss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom CSS</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder=".chat-widget { border-radius: 12px; }"
                        className="font-mono text-sm"
                        rows={4}
                        data-testid="input-custom-css"
                      />
                    </FormControl>
                    <FormDescription>
                      Optional CSS to customize the widget appearance
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
