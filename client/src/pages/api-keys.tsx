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
import { Key, Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
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
              <p className="text-muted-foreground mb-4">
                Create your first API key to start embedding the chat widget on your website
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
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

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Embedding the Widget</CardTitle>
          <CardDescription>
            Add this code snippet to your website to embed the chat widget
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md font-mono text-sm overflow-x-auto">
            <code>
              {`<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://embellics.com/widget.js';
    script.setAttribute('data-api-key', 'YOUR_API_KEY');
    document.head.appendChild(script);
  })();
</script>`}
            </code>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Replace <code className="bg-muted px-1 py-0.5 rounded">YOUR_API_KEY</code> with your
            actual API key
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
