import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Code } from 'lucide-react';
import { format } from 'date-fns';
import type { ApiKey } from '@shared/schema';

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(true); // Auto-show new keys by default

  // Query for API keys
  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['/api/api-keys'],
  });

  // Create API key mutation
  const createKey = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('POST', '/api/api-keys', { name });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      setNewlyCreatedKey(data.apiKey);
      setNewKeyName('');
      setIsCreateDialogOpen(false);
      toast({
        title: 'API key created',
        description: 'Your new API key has been generated. Make sure to copy it now!',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create API key.',
        variant: 'destructive',
      });
    },
  });

  // Delete API key mutation
  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/api-keys/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      // Clear the newly created key banner when deleting
      setNewlyCreatedKey(null);
      toast({
        title: 'API key deleted',
        description: 'The API key has been permanently deleted.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete API key.',
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'API key has been copied to your clipboard.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading API keys...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-2">
            Manage API keys for embedding your chat widget
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-key">
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for embedding your widget on websites.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Key Name (Optional)</Label>
                <Input
                  id="key-name"
                  placeholder="Production Website"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  data-testid="input-key-name"
                />
                <p className="text-sm text-muted-foreground">
                  A friendly name to help you identify this key
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createKey.mutate(newKeyName)}
                disabled={createKey.isPending}
                data-testid="button-generate"
              >
                {createKey.isPending ? 'Generating...' : 'Generate Key'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* New key display dialog */}
      {newlyCreatedKey && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Key className="h-5 w-5" />
              New API Key Created
            </CardTitle>
            <CardDescription>
              Copy this key now. For security reasons, it won't be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={
                  showNewKey
                    ? newlyCreatedKey
                    : newlyCreatedKey.substring(0, 12) + '••••••••••••••••'
                }
                readOnly
                className="font-mono"
                data-testid="text-new-key"
              />
              <Button
                onClick={() => setShowNewKey(!showNewKey)}
                variant="outline"
                size="icon"
                title={showNewKey ? 'Hide key' : 'Show key'}
                data-testid="button-toggle-new-key"
              >
                {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                onClick={() => copyToClipboard(newlyCreatedKey)}
                variant="outline"
                data-testid="button-copy-new-key"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setNewlyCreatedKey(null);
                  setShowNewKey(true); // Reset for next key
                }}
                variant="outline"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
              <p className="text-muted-foreground">
                Create your first API key to start embedding the chat widget on your website
              </p>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map((key) => (
            <Card key={key.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{key.name || 'Unnamed Key'}</CardTitle>
                    <CardDescription className="mt-1">
                      Created {format(new Date(key.createdAt), 'PPP')}
                      {key.lastUsed && <> • Last used {format(new Date(key.lastUsed), 'PPP')}</>}
                    </CardDescription>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-delete-${key.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. Any websites using this key will no longer
                          be able to load the chat widget.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteKey.mutate(key.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">API Key Prefix</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={`${key.keyPrefix}••••••••••••••••`}
                        readOnly
                        className="font-mono text-sm"
                        data-testid={`text-key-${key.id}`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Full key was only shown at creation time and is not stored in our database for
                      security.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Installation Instructions */}
      {apiKeys.length > 0 && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Installation Instructions
                </CardTitle>
                <CardDescription className="mt-2">
                  Copy and paste this code snippet into your website
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 inline-block">
                    Production URL:{' '}
                    <code className="text-primary">https://app.embellics.com/widget.js</code>
                  </span>
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const firstKey = apiKeys[0];
                  const embedCode = `<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/widget.js';
    script.setAttribute('data-api-key', '${firstKey.keyPrefix}...');
    document.head.appendChild(script);
  })();
</script>`;
                  copyToClipboard(embedCode);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <div className="bg-slate-950 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <code className="text-slate-50">
                  <span className="text-slate-500">&lt;</span>
                  <span className="text-pink-400">script</span>
                  <span className="text-slate-500">&gt;</span>
                  {'\n  '}
                  <span className="text-slate-500">(</span>
                  <span className="text-purple-400">function</span>
                  <span className="text-slate-500">() {'{'}</span>
                  {'\n    '}
                  <span className="text-purple-400">var</span>{' '}
                  <span className="text-blue-400">script</span> ={' '}
                  <span className="text-blue-400">document</span>.
                  <span className="text-yellow-400">createElement</span>
                  <span className="text-slate-500">(</span>
                  <span className="text-green-400">'script'</span>
                  <span className="text-slate-500">);</span>
                  {'\n    '}
                  <span className="text-blue-400">script</span>.
                  <span className="text-blue-400">src</span> ={' '}
                  <span className="text-green-400">'{window.location.origin}/widget.js'</span>;
                  {'\n    '}
                  <span className="text-blue-400">script</span>.
                  <span className="text-yellow-400">setAttribute</span>
                  <span className="text-slate-500">(</span>
                  <span className="text-green-400">'data-api-key'</span>,{' '}
                  <span className="text-green-400">
                    '
                    {newlyCreatedKey ||
                      (apiKeys[0] ? `${apiKeys[0].keyPrefix}...` : 'YOUR_API_KEY')}
                    '
                  </span>
                  <span className="text-slate-500">);</span>
                  {'\n    '}
                  <span className="text-blue-400">document</span>.
                  <span className="text-blue-400">head</span>.
                  <span className="text-yellow-400">appendChild</span>
                  <span className="text-slate-500">(</span>
                  <span className="text-blue-400">script</span>
                  <span className="text-slate-500">);</span>
                  {'\n  '}
                  <span className="text-slate-500">{'}'})();</span>
                  {'\n'}
                  <span className="text-slate-500">&lt;/</span>
                  <span className="text-pink-400">script</span>
                  <span className="text-slate-500">&gt;</span>
                </code>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                � Installation Steps:
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900 dark:text-blue-100">
                <li>Copy the code snippet above (or click the "Copy Code" button)</li>
                <li>Open your website's HTML file</li>
                <li>
                  Paste the code just before the closing{' '}
                  <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded font-mono">
                    {'</body>'}
                  </code>{' '}
                  tag
                </li>
                <li>Save and reload your website</li>
                <li>The chat widget will appear in the bottom-right corner</li>
              </ol>
            </div>

            {!newlyCreatedKey && apiKeys.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <strong>⚠️ Note:</strong> The code above shows your key prefix. Replace it with
                  your full API key shown when you created it.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
