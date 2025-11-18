import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Sparkles,
  Palette,
  Key,
  Code,
  MessageSquare,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "@/components/ui/alert-dialog";
import type { WidgetConfig, ApiKey } from "@shared/schema";

export default function OnboardingPage() {
  const { toast } = useToast();

  // Widget config form state
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [greeting, setGreeting] = useState("Hi! How can I help you today?");
  const [placeholder, setPlaceholder] = useState("Type your message...");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">(
    "bottom-right"
  );

  // API key state
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Check for existing widget config
  const { data: existingConfig } = useQuery<WidgetConfig | null>({
    queryKey: ["/api/widget-config"],
    retry: false,
  });

  // Pre-populate form state from existing config
  useEffect(() => {
    if (existingConfig) {
      setPrimaryColor(existingConfig.primaryColor ?? "#6366f1");
      setPosition(
        (existingConfig.position as "bottom-right" | "bottom-left") ??
          "bottom-right"
      );
      setGreeting(existingConfig.greeting ?? "Hi! How can I help you today?");
      setPlaceholder(existingConfig.placeholder ?? "Type your message...");
    }
  }, [existingConfig]);

  // Check for existing API keys
  const { data: existingApiKeys } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
    retry: false,
  });

  // Get first API key or generated one
  const displayApiKey =
    generatedApiKey ||
    (existingApiKeys && existingApiKeys.length > 0
      ? existingApiKeys[0].keyPrefix + "..."
      : null);

  // Create or update widget config mutation
  const createWidgetConfig = useMutation({
    mutationFn: async () => {
      const configData = {
        primaryColor,
        position,
        greeting,
        placeholder,
        allowedDomains: [],
      };

      if (existingConfig) {
        const response = await apiRequest(
          "PATCH",
          "/api/widget-config",
          configData
        );
        return await response.json();
      }

      try {
        const response = await apiRequest(
          "POST",
          "/api/widget-config",
          configData
        );
        return await response.json();
      } catch (error: any) {
        if (error.response?.status === 400 || error.response?.status === 409) {
          const updateResponse = await apiRequest(
            "PATCH",
            "/api/widget-config",
            configData
          );
          return await updateResponse.json();
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widget-config"] });
      toast({
        title: "Widget configured!",
        description: "Your chat widget has been customized.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save widget configuration.",
        variant: "destructive",
      });
    },
  });

  // Generate API key mutation
  const generateApiKey = useMutation({
    mutationFn: async () => {
      if (existingApiKeys && existingApiKeys.length > 0) {
        return { key: existingApiKeys[0], plainTextKey: null };
      }

      const response = await apiRequest("POST", "/api/api-keys", {
        name: "My First API Key",
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      if (data.apiKey) {
        setGeneratedApiKey(data.apiKey);
        setShowApiKey(true); // Automatically show the newly generated key
      }
      toast({
        title: "API Key Ready!",
        description: data.apiKey
          ? "Your API key has been created successfully. Make sure to save it now!"
          : "Using existing API key.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate API key.",
        variant: "destructive",
      });
    },
  });

  // Delete API key mutation
  const deleteApiKey = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/api-keys/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setGeneratedApiKey(null);
      setShowApiKey(false);
      toast({
        title: "API key deleted",
        description: "The API key has been permanently deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete API key.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Copied to clipboard",
    });
  };

  const embedCode = displayApiKey
    ? `<script src="https://embellics.com/widget.js"></script>
<script>
  EmbellicsWidget.init({
    apiKey: "${displayApiKey}",
  });
</script>`
    : "";

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Welcome to Embellics!</h1>
            <p className="text-muted-foreground">
              Get started with your AI chat widget
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="customize" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customize" data-testid="tab-customize">
            <Palette className="h-4 w-4 mr-2" />
            Customize
          </TabsTrigger>
          <TabsTrigger value="api-key" data-testid="tab-api-key">
            <Key className="h-4 w-4 mr-2" />
            API Key
          </TabsTrigger>
          <TabsTrigger value="install" data-testid="tab-install">
            <Code className="h-4 w-4 mr-2" />
            Install
          </TabsTrigger>
        </TabsList>

        {/* Customize Widget Tab */}
        <TabsContent value="customize">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Customize Your Chat Widget
              </CardTitle>
              <CardDescription>
                Make the widget match your brand's look and feel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-24 h-12 cursor-pointer"
                    data-testid="input-primary-color"
                  />
                  <span
                    className="text-sm text-muted-foreground font-mono"
                    data-testid="text-color-value"
                  >
                    {primaryColor}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Widget Position</Label>
                <Select
                  value={position}
                  onValueChange={(val: any) => setPosition(val)}
                >
                  <SelectTrigger
                    id="position"
                    data-testid="select-widget-position"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="greeting">Greeting Message</Label>
                <Input
                  id="greeting"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Hi! How can I help you today?"
                  data-testid="input-greeting"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="placeholder">Input Placeholder</Label>
                <Input
                  id="placeholder"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="Type your message..."
                  data-testid="input-placeholder"
                />
              </div>

              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-12 w-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{greeting}</p>
                    <p className="text-muted-foreground text-xs">
                      {placeholder}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => createWidgetConfig.mutate()}
                disabled={createWidgetConfig.isPending}
                className="w-full"
                data-testid="button-save-widget-config"
              >
                {createWidgetConfig.isPending
                  ? "Saving..."
                  : "Save Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Key Tab */}
        <TabsContent value="api-key">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Get Your API Key
              </CardTitle>
              <CardDescription>
                Generate or view your API key for embedding the widget
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {displayApiKey ? (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-3">Your API Key:</p>
                      <div className="flex items-center gap-2 mb-3">
                        <Input
                          value={
                            generatedApiKey
                              ? showApiKey
                                ? generatedApiKey
                                : generatedApiKey.substring(0, 12) +
                                  "••••••••••••••••"
                              : existingApiKeys && existingApiKeys.length > 0
                              ? existingApiKeys[0].keyPrefix +
                                "••••••••••••••••"
                              : ""
                          }
                          readOnly
                          className="font-mono text-sm flex-1"
                          data-testid="input-api-key"
                        />
                        {generatedApiKey && (
                          <>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => setShowApiKey(!showApiKey)}
                              data-testid="button-toggle-api-key-visibility"
                              title={
                                showApiKey ? "Hide full key" : "Show full key"
                              }
                            >
                              {showApiKey ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => copyToClipboard(generatedApiKey)}
                              data-testid="button-copy-api-key"
                              title="Copy full API key"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                      {generatedApiKey && (
                        <p className="text-xs text-muted-foreground">
                          Make sure to save this key securely. You won't be able
                          to see the full key again after you leave this page.
                        </p>
                      )}
                      {!generatedApiKey && (
                        <div className="mt-2 p-2 bg-muted/50 rounded">
                          <p className="text-xs text-muted-foreground">
                            <strong>Security Notice:</strong> Full API keys are
                            only shown once at creation time and are not stored
                            in our database. Only the prefix is kept for
                            identification. If you need the full key, you must
                            delete this key and create a new one.
                          </p>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>

                  {existingApiKeys &&
                    existingApiKeys.length > 0 &&
                    !generatedApiKey && (
                      <div className="flex gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              className="flex-1"
                              data-testid="button-delete-api-key"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete & Regenerate
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete and Create New API Key?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete your current API
                                key. Any websites using this key will stop
                                working until you update them with the new key.
                                A new key will be generated and shown to you
                                after deletion.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  deleteApiKey.mutate(existingApiKeys[0].id);
                                  // After deletion, generate a new key
                                  setTimeout(() => {
                                    generateApiKey.mutate();
                                  }, 500);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete & Regenerate
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Generate an API key to embed your chat widget on your
                    website.
                  </p>
                  <Button
                    onClick={() => generateApiKey.mutate()}
                    disabled={generateApiKey.isPending}
                    className="w-full"
                    data-testid="button-generate-api-key"
                  >
                    {generateApiKey.isPending
                      ? "Generating..."
                      : "Generate API Key"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Install Tab */}
        <TabsContent value="install">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Add to Your Website
              </CardTitle>
              <CardDescription>
                Copy and paste this code before the closing &lt;/body&gt; tag
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {embedCode ? (
                <>
                  <div className="relative">
                    <Textarea
                      value={embedCode}
                      readOnly
                      className="font-mono text-sm"
                      rows={7}
                      data-testid="textarea-embed-code"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(embedCode)}
                      data-testid="button-copy-embed-code"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <Alert>
                    <AlertDescription className="text-sm">
                      <p className="font-medium mb-1">Installation Steps:</p>
                      <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Copy the code above</li>
                        <li>
                          Paste it before the closing &lt;/body&gt; tag in your
                          HTML
                        </li>
                        <li>Reload your website to see the widget</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <Alert>
                  <AlertDescription>
                    Please generate an API key first in the "API Key" tab.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
