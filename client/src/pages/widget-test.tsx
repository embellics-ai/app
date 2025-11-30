import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Loader2, AlertCircle, TestTube2, Building2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Tenant {
  id: string;
  name: string;
  retellApiKey: string | null;
  retellAgentId: string | null;
}

/**
 * Widget Test Page - Platform Admin Only
 *
 * Allows platform admins to test any tenant's widget configuration.
 * Useful for troubleshooting client widget issues.
 */
export default function WidgetTest() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      fetchTenants();
    }
  }, [user]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/platform/tenants', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }

      const data = await response.json();
      setTenants(data);
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setError('Failed to load tenants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWidget = async () => {
    if (!selectedTenantId) {
      setError('Please select a tenant to test');
      return;
    }

    // Check if selected tenant has widget configured
    const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
    if (!selectedTenant?.retellAgentId) {
      setError(
        `The selected tenant "${selectedTenant?.name}" does not have a widget configured. Please configure the Retell Agent ID in the Platform Admin panel first.`,
      );
      return;
    }

    // Clear any previous errors
    setError(null);

    try {
      // Fetch the widget test HTML with authentication
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(`/api/platform/widget-test-page?tenantId=${selectedTenantId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Widget test page error:', response.status, errorData);
        setError(`Failed to load widget test page: ${response.status} ${response.statusText}`);
        return;
      }

      const htmlContent = await response.text();

      // Open HTML in new window
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      } else {
        setError('Failed to open new window. Please check your popup blocker settings.');
      }
    } catch (err) {
      console.error('Error opening widget test page:', err);
      setError(
        `Failed to load widget test page: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  };

  // Loading state
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Access denied for non-platform admins
  if (!user.isPlatformAdmin) {
    return (
      <div className="container mx-auto p-8 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            This page is only accessible to platform administrators. If you believe you should have
            access, please contact your system administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Platform admin - show tenant selector
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TestTube2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Widget Test Environment</h1>
        </div>
        <p className="text-muted-foreground">
          Test any tenant's chat widget configuration for troubleshooting and verification
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Tenant to Test</CardTitle>
          <CardDescription>
            Choose a tenant to load their widget configuration and test the chat widget
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading tenants...</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="tenant-select">Tenant</Label>
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger id="tenant-select">
                    <SelectValue placeholder="Select a tenant to test" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{tenant.name}</span>
                          {!tenant.retellAgentId && (
                            <span className="text-xs text-muted-foreground">
                              (No widget configured)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tenants.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tenants found</p>
                )}
              </div>

              {selectedTenantId && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm">Selected Tenant Info</h3>
                  {(() => {
                    const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
                    return selectedTenant ? (
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="font-medium">Name:</span> {selectedTenant.name}
                        </p>
                        <p>
                          <span className="font-medium">Widget Status:</span>{' '}
                          {selectedTenant.retellAgentId ? (
                            <span className="text-green-600 dark:text-green-400">✓ Configured</span>
                          ) : (
                            <span className="text-yellow-600 dark:text-yellow-400">
                              ⚠ Not Configured
                            </span>
                          )}
                        </p>
                        {selectedTenant.retellAgentId ? (
                          <p className="text-xs text-muted-foreground">
                            Agent ID: {selectedTenant.retellAgentId}
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                            This tenant needs a Retell Agent ID configured before the widget can be
                            tested. Please configure it in Platform Admin → Tenants.
                          </p>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              <Button
                onClick={handleTestWidget}
                disabled={
                  !selectedTenantId ||
                  !tenants.find((t) => t.id === selectedTenantId)?.retellAgentId
                }
                className="w-full"
                size="lg"
              >
                <TestTube2 className="mr-2 h-5 w-5" />
                {selectedTenantId && !tenants.find((t) => t.id === selectedTenantId)?.retellAgentId
                  ? 'Widget Not Configured'
                  : 'Open Widget Test Page'}
              </Button>

              <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
                <p className="font-semibold">Testing Instructions:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Select a tenant from the dropdown above</li>
                  <li>
                    Click "Open Widget Test Page" to launch the test environment in a new window
                  </li>
                  <li>The widget will load with the selected tenant's configuration</li>
                  <li>Test all widget features: chat initiation, messaging, handoff, etc.</li>
                  <li>Check browser console for any errors or warnings</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
