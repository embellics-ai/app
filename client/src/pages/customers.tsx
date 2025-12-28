import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { Users, UserPlus, Phone, Mail, Activity } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Tenant {
  id: string;
  name: string;
}

interface Client {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  firstInteractionSource: string;
  firstInteractionDate: string;
  firstBookingDate: string | null;
  lastBookingDate: string | null;
  status: string;
  createdAt: string;
}

interface ClientStats {
  totalClients: number;
  activeClients: number;
  newThisMonth: number;
  bySource: Record<string, number>;
}

export default function CustomersPage() {
  const { user } = useAuth();
  const [selectedSource, setSelectedSource] = useState<string | undefined>();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Fetch all tenants (for platform admin)
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['/api/platform/tenants'],
    enabled: user?.role === 'owner' || user?.isPlatformAdmin,
  });

  // Determine which tenantId to use
  const tenantId =
    user?.role === 'owner' || user?.isPlatformAdmin ? selectedTenantId : user?.tenantId;

  // Fetch client stats
  const { data: stats, isLoading: statsLoading } = useQuery<ClientStats>({
    queryKey: [`/api/platform/tenants/${tenantId}/clients/stats`],
    enabled: !!tenantId,
  });

  // Fetch clients list - construct URL with query params
  const clientsQueryParams = selectedSource ? `?source=${selectedSource}` : '';
  const clientsUrl = `/api/platform/tenants/${tenantId}/clients${clientsQueryParams}`;

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: [clientsUrl],
    enabled: !!tenantId,
  });

  if (!tenantId) {
    return (
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Management</h1>
          <p className="text-muted-foreground mt-1">
            View and manage customers who booked through your platform
          </p>
        </div>

        {/* Tenant Selector for Platform Admin */}
        {(user?.role === 'owner' || user?.isPlatformAdmin) && (
          <div className="max-w-xs space-y-2">
            <Label>Select Tenant</Label>
            <Select value={selectedTenantId || ''} onValueChange={setSelectedTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Please select a tenant to view customer data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Management</h1>
          <p className="text-muted-foreground mt-1">
            View and manage customers who booked through your platform
          </p>
        </div>
      </div>

      {/* Tenant Selector for Platform Admin */}
      {(user?.role === 'owner' || user?.isPlatformAdmin) && (
        <div className="max-w-xs space-y-2">
          <Label>Select Tenant</Label>
          <Select value={selectedTenantId || ''} onValueChange={setSelectedTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Clients */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">All time customers</p>
            </CardContent>
          </Card>

          {/* Active Clients */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeClients || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently active</p>
            </CardContent>
          </Card>

          {/* New This Month */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New This Month</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.newThisMonth || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Joined this month</p>
            </CardContent>
          </Card>

          {/* Top Source */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Source</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {(stats &&
                  stats.bySource &&
                  Object.entries(stats.bySource).sort((a, b) => b[1] - a[1])[0]?.[0]) ||
                  'N/A'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Most common acquisition channel</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Source Filter Buttons */}
      {stats?.bySource && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Filter by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedSource === undefined ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSource(undefined)}
              >
                All Sources
                <span className="ml-2 text-xs opacity-70">({stats?.totalClients || 0})</span>
              </Button>
              {Object.entries(stats.bySource).map(([source, count]) => (
                <Button
                  key={source}
                  variant={selectedSource === source ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSource(source)}
                >
                  <span className="capitalize">{source}</span>
                  <span className="ml-2 text-xs opacity-70">({String(count)})</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {clientsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading clients...</div>
          ) : !clients || clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients found. Clients will appear here when they book through your platform.
            </div>
          ) : (
            <div className="space-y-4">
              {clients.map((client: Client) => (
                <Link key={client.id} href={`/customers/${tenantId}/${client.id}`}>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {client.firstName.charAt(0)}
                          {client.lastName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {client.firstName} {client.lastName}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </span>
                          {client.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium capitalize">{client.status}</div>
                      <div className="text-xs text-muted-foreground mt-1 capitalize">
                        via {client.firstInteractionSource}
                      </div>
                      {client.lastBookingDate && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last booking: {new Date(client.lastBookingDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
