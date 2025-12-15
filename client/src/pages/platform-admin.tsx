import { useState, useEffect } from 'react';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  AlertCircle,
  UserPlus,
  Users,
  Mail,
  Loader2,
  Trash2,
  Building2,
  Key,
  Edit,
  Eye,
  EyeOff,
  Copy,
  Webhook,
  BarChart3,
  Save,
} from 'lucide-react';
import IntegrationManagement from '@/components/IntegrationManagement';
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
import { useAuth } from '@/contexts/auth-context';
import { useLocation } from 'wouter';

const inviteUserSchema = z
  .object({
    email: z.string().email('Invalid email address').min(1, 'Email is required'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    role: z.enum(['admin', 'client_admin']),
    // Client/Tenant onboarding fields
    companyName: z.string().optional(),
    companyPhone: z.string().optional(),
  })
  .refine(
    (data) => {
      // If role is client_admin, company name is required
      if (data.role === 'client_admin') {
        return !!data.companyName;
      }
      return true;
    },
    {
      message: 'Company Name is required for Client Admin',
      path: ['companyName'],
    },
  );

type InviteUserFormData = z.infer<typeof inviteUserSchema>;

export default function PlatformAdminPage() {
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [editApiKeyDialog, setEditApiKeyDialog] = useState<{
    open: boolean;
    tenant: any | null;
  }>({
    open: false,
    tenant: null,
  });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [whatsappAgentId, setWhatsappAgentId] = useState<string>('');
  const [selectedIntegrationTenant, setSelectedIntegrationTenant] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [agentManagementDialog, setAgentManagementDialog] = useState<{
    open: boolean;
    tenant: any | null;
  }>({
    open: false,
    tenant: null,
  });

  // Access control: Only platform admins can view this page
  useEffect(() => {
    if (!isLoading && user && !user.isPlatformAdmin) {
      toast({
        title: 'Access Denied',
        description: "You don't have permission to access this page.",
        variant: 'destructive',
      });
      setLocation('/analytics');
    }
  }, [user, isLoading, setLocation, toast]);

  // Show loading or redirect while checking access
  if (isLoading || (user && !user.isPlatformAdmin)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const form = useForm<InviteUserFormData>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'client_admin',
      companyName: '',
      companyPhone: '',
    },
  });

  // Watch the role field to show/hide client onboarding fields
  const selectedRole = form.watch('role');

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/platform/users'],
  });

  const { data: currentUser } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<any[]>({
    queryKey: ['/api/platform/invitations/pending'],
  });

  const isOwner = currentUser?.email === 'admin@embellics.com';

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<any[]>({
    queryKey: ['/api/platform/tenants'],
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data: InviteUserFormData) => {
      const response = await apiRequest('POST', '/api/platform/invite-user', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.emailSent) {
        toast({
          title: 'User invited successfully',
          description:
            'Invitation email sent with login credentials. They can now log in and will be prompted to change their password.',
        });
      } else {
        toast({
          title: 'Invitation created but email failed to send',
          description: `Email error: ${
            data.emailError || 'Unknown error'
          }. Please contact the user directly to share the invitation.`,
          variant: 'destructive',
        });
      }

      queryClient.invalidateQueries({
        queryKey: ['/api/platform/invitations/pending'],
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to invite user',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('DELETE', `/api/platform/users/${userId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'User deleted successfully',
        description: 'The user has been removed from the system.',
      });
      // Invalidate ALL queries that might show this user
      queryClient.invalidateQueries({ queryKey: ['/api/platform/users'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/platform/invitations/pending'],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete user',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest('DELETE', `/api/platform/tenants/${tenantId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Tenant deleted successfully',
        description: 'The tenant and all associated data have been removed.',
      });
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/users'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/platform/invitations/pending'],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete tenant',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiRequest('DELETE', `/api/platform/invitations/${invitationId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Invitation deleted successfully',
        description: 'The invitation has been removed from the system.',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/platform/invitations/pending'],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete invitation',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const updateRetellApiKeyMutation = useMutation({
    mutationFn: async ({
      tenantId,
      retellApiKey,
      retellAgentId,
      whatsappAgentId,
    }: {
      tenantId: string;
      retellApiKey?: string;
      retellAgentId?: string;
      whatsappAgentId?: string;
    }) => {
      const response = await apiRequest(
        'PATCH',
        `/api/platform/tenants/${tenantId}/retell-api-key`,
        {
          retellApiKey: retellApiKey || undefined,
          retellAgentId: retellAgentId || undefined,
          whatsappAgentId: whatsappAgentId || undefined,
        },
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Retell Configuration updated',
        description: 'The Retell AI API key and agent have been successfully assigned.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      setEditApiKeyDialog({ open: false, tenant: null });
      setApiKeyInput('');
      setSelectedAgentId('');
      setWhatsappAgentId('');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update configuration',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: InviteUserFormData) => {
    inviteUserMutation.mutate(data);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'client_admin':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="h-full bg-background">
      <div className="container max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Platform Administration</h1>
          <p className="text-muted-foreground">
            Manage users, invitations, and platform-wide settings
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="tenants" data-testid="tab-tenants">
              <Building2 className="w-4 h-4 mr-2" />
              Tenants
            </TabsTrigger>
            <TabsTrigger value="invitations" data-testid="tab-invitations">
              <Mail className="w-4 h-4 mr-2" />
              Invitations
            </TabsTrigger>
            <TabsTrigger value="invite" data-testid="tab-invite">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              <Webhook className="w-4 h-4 mr-2" />
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>View and manage all users across all tenants</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No users found</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user: any) => (
                          <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                            <TableCell
                              className="font-medium"
                              data-testid={`text-user-name-${user.id}`}
                            >
                              {user.firstName} {user.lastName}
                            </TableCell>
                            <TableCell data-testid={`text-user-email-${user.id}`}>
                              {user.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getRoleBadgeVariant(user.role)}
                                data-testid={`badge-user-role-${user.id}`}
                              >
                                {user.role.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className="text-muted-foreground"
                              data-testid={`text-user-tenant-${user.id}`}
                            >
                              {user.tenantId ? user.tenantId.slice(0, 8) : 'Platform'}
                            </TableCell>
                            <TableCell>
                              {user.isPlatformAdmin && (
                                <Badge
                                  variant="default"
                                  data-testid={`badge-platform-admin-${user.id}`}
                                >
                                  Platform Admin
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {!user.isPlatformAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      data-testid={`button-delete-user-${user.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete {user.firstName}{' '}
                                        {user.lastName}? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel
                                        data-testid={`button-cancel-delete-${user.id}`}
                                      >
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteUserMutation.mutate(user.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        data-testid={`button-confirm-delete-${user.id}`}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Client Tenants</CardTitle>
                <CardDescription>
                  Manage client tenants and assign Retell AI API keys
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tenantsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tenants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No tenants found</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Retell API Key</TableHead>
                          <TableHead>Web Chat Agent ID</TableHead>
                          <TableHead>WhatsApp Agent ID</TableHead>
                          <TableHead className="w-[120px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenants.map((tenant: any) => (
                          <TableRow key={tenant.id} data-testid={`row-tenant-${tenant.id}`}>
                            <TableCell
                              className="font-medium"
                              data-testid={`text-tenant-name-${tenant.id}`}
                            >
                              {tenant.name}
                            </TableCell>
                            <TableCell data-testid={`text-tenant-email-${tenant.id}`}>
                              {tenant.email}
                            </TableCell>
                            <TableCell
                              className="text-muted-foreground"
                              data-testid={`text-tenant-phone-${tenant.id}`}
                            >
                              {tenant.phone || '-'}
                            </TableCell>
                            <TableCell>
                              {tenant.hasRetellApiKey ? (
                                <Badge
                                  variant="default"
                                  data-testid={`badge-api-key-configured-${tenant.id}`}
                                >
                                  <Key className="w-3 h-3 mr-1" />
                                  Configured
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  data-testid={`badge-api-key-not-configured-${tenant.id}`}
                                >
                                  Not Set
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {tenant.hasRetellAgentId ? (
                                <Badge
                                  variant="default"
                                  data-testid={`badge-agent-id-configured-${tenant.id}`}
                                >
                                  <Key className="w-3 h-3 mr-1" />
                                  Configured
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  data-testid={`badge-agent-id-not-configured-${tenant.id}`}
                                >
                                  Not Set
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {tenant.hasWhatsappAgentId ? (
                                <Badge
                                  variant="default"
                                  data-testid={`badge-whatsapp-agent-id-configured-${tenant.id}`}
                                >
                                  <Key className="w-3 h-3 mr-1" />
                                  Configured
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  data-testid={`badge-whatsapp-agent-id-not-configured-${tenant.id}`}
                                >
                                  Not Set
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditApiKeyDialog({ open: true, tenant });
                                    // Clear inputs - users should only enter new values
                                    setApiKeyInput('');
                                    setSelectedAgentId('');
                                    setWhatsappAgentId('');
                                  }}
                                  data-testid={`button-edit-api-key-${tenant.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      data-testid={`button-delete-tenant-${tenant.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Tenant?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete <strong>{tenant.name}</strong>{' '}
                                        and all associated data including:
                                        <ul className="list-disc list-inside mt-2 space-y-1">
                                          <li>All users in this tenant</li>
                                          <li>Widget configuration</li>
                                          <li>API keys</li>
                                          <li>Chat history and analytics</li>
                                        </ul>
                                        <p className="mt-2 font-semibold text-destructive">
                                          This action cannot be undone!
                                        </p>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteTenantMutation.mutate(tenant.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete Tenant
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
          </TabsContent>

          <TabsContent value="invitations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>Active user invitations waiting to be accepted</CardDescription>
              </CardHeader>
              <CardContent>
                {invitationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : invitations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending invitations
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sent</TableHead>
                          {isOwner && <TableHead>Temp Password</TableHead>}
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((invitation: any) => (
                          <TableRow
                            key={invitation.id}
                            data-testid={`row-invitation-${invitation.id}`}
                          >
                            <TableCell
                              className="font-medium"
                              data-testid={`text-invitation-name-${invitation.id}`}
                            >
                              {invitation.firstName} {invitation.lastName}
                            </TableCell>
                            <TableCell data-testid={`text-invitation-email-${invitation.id}`}>
                              {invitation.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getRoleBadgeVariant(invitation.role)}
                                data-testid={`badge-invitation-role-${invitation.id}`}
                              >
                                {invitation.role.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className="text-muted-foreground text-sm"
                              data-testid={`text-invitation-company-${invitation.id}`}
                            >
                              {invitation.companyName || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={invitation.status === 'sent' ? 'default' : 'secondary'}
                                data-testid={`badge-invitation-status-${invitation.id}`}
                              >
                                {invitation.status}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className="text-muted-foreground text-sm"
                              data-testid={`text-invitation-sent-${invitation.id}`}
                            >
                              {invitation.lastSentAt
                                ? new Date(invitation.lastSentAt).toLocaleDateString()
                                : '-'}
                            </TableCell>
                            {isOwner && (
                              <TableCell>
                                {/* For security we no longer return plaintext temporary passwords from the API.
                                  Show a short explanatory message instead and suggest using the
                                  "Resend invite" action or checking email logs (MailDev) to retrieve
                                  the temporary password if needed. */}
                                <span
                                  className="text-muted-foreground text-sm"
                                  data-testid={`text-temp-password-info-${invitation.id}`}
                                >
                                  {invitation.status === 'sent' ? 'Sent via email' : '-'}
                                </span>
                              </TableCell>
                            )}
                            <TableCell>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`button-delete-invitation-${invitation.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the invitation for{' '}
                                      {invitation.email}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel
                                      data-testid={`button-cancel-delete-${invitation.id}`}
                                    >
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      data-testid={`button-confirm-delete-invitation-${invitation.id}`}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invite" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invite New User</CardTitle>
                <CardDescription>Send an invitation to join the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Email <span className="text-destructive">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="user@example.com"
                              {...field}
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} data-testid="input-firstName" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} data-testid="input-lastName" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-role">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">Admin (Platform Admin)</SelectItem>
                              <SelectItem value="client_admin">Client Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedRole === 'client_admin' && (
                      <>
                        <div className="border-t pt-4 mt-4">
                          <h3 className="text-sm font-medium mb-3">Client Onboarding Details</h3>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="companyName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Company Name <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Acme Corporation"
                                        {...field}
                                        data-testid="input-companyName"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="companyPhone"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Company Phone (Optional)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="tel"
                                        placeholder="+1 (555) 123-4567"
                                        {...field}
                                        data-testid="input-companyPhone"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <Button
                      type="submit"
                      disabled={inviteUserMutation.isPending}
                      data-testid="button-invite"
                      className="w-full"
                    >
                      {inviteUserMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending Invitation...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Integrations</CardTitle>
                <CardDescription>
                  Manage WhatsApp, SMS, and N8N integrations for each tenant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tenant Selector */}
                <div className="space-y-2">
                  <Label htmlFor="integration-tenant-select">Select Tenant</Label>
                  <Select
                    value={selectedIntegrationTenant?.id || ''}
                    onValueChange={(value) => {
                      const tenant = tenants.find((t: any) => t.id === value);
                      if (tenant) {
                        setSelectedIntegrationTenant({
                          id: tenant.id,
                          name: tenant.name,
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="integration-tenant-select" className="w-full">
                      <SelectValue placeholder="Select a tenant to manage integrations" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenantsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : tenants.length === 0 ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No tenants available
                        </div>
                      ) : (
                        tenants.map((tenant: any) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Integration Management Component */}
                {selectedIntegrationTenant ? (
                  <IntegrationManagement
                    tenantId={selectedIntegrationTenant.id}
                    tenantName={selectedIntegrationTenant.name}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a tenant to view and manage their integrations</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Retell API Key Dialog */}
        <Dialog
          open={editApiKeyDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setEditApiKeyDialog({ open: false, tenant: null });
              setApiKeyInput('');
              setSelectedAgentId('');
              setWhatsappAgentId('');
            }
          }}
        >
          <DialogContent data-testid="dialog-edit-api-key">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Assign Retell AI Configuration
              </DialogTitle>
              <DialogDescription>
                Set or update the Retell AI API key and chat agent for{' '}
                {editApiKeyDialog.tenant?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="retell-api-key">Retell AI API Key</Label>
                {editApiKeyDialog.tenant?.hasRetellApiKey && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900/50 transition-colors">
                    <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-mono text-sm font-medium text-purple-900 dark:text-purple-100">
                      {editApiKeyDialog.tenant.maskedRetellApiKey || 'Configured (hidden)'}
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                    >
                      Current
                    </Badge>
                  </div>
                )}
                <Input
                  id="retell-api-key"
                  type="text"
                  placeholder={
                    editApiKeyDialog.tenant?.hasRetellApiKey
                      ? 'Enter new key to update'
                      : 'Enter Retell AI API key'
                  }
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  data-testid="input-retell-api-key"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {editApiKeyDialog.tenant?.hasRetellApiKey
                    ? 'Enter a new key to update, or leave empty to keep existing.'
                    : 'This key will be encrypted and stored securely. It will be used for analytics and chat functionality.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retell-agent-id">Retell Widget Chat Agent ID</Label>
                {editApiKeyDialog.tenant?.hasRetellAgentId && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900/50 transition-colors">
                    <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-mono text-sm font-medium text-purple-900 dark:text-purple-100">
                      {editApiKeyDialog.tenant.maskedAgentId || 'Configured (hidden)'}
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                    >
                      Current
                    </Badge>
                  </div>
                )}
                <Input
                  id="retell-agent-id"
                  type="text"
                  placeholder={
                    editApiKeyDialog.tenant?.hasRetellAgentId
                      ? 'Enter new agent ID to update'
                      : 'Enter Retell Widget Chat Agent ID (optional)'
                  }
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  data-testid="input-retell-agent-id"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {editApiKeyDialog.tenant?.hasRetellAgentId
                    ? 'Enter a new agent ID to update, or leave empty to keep existing.'
                    : "The agent ID to use for this tenant's web chat widget."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp-agent-id">WhatsApp Chat Agent ID</Label>
                {editApiKeyDialog.tenant?.hasWhatsappAgentId && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-900/50 transition-colors">
                    <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-mono text-sm font-medium text-purple-900 dark:text-purple-100">
                      {editApiKeyDialog.tenant.maskedWhatsappAgentId || 'Configured (hidden)'}
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                    >
                      Current
                    </Badge>
                  </div>
                )}
                <Input
                  id="whatsapp-agent-id"
                  type="text"
                  placeholder={
                    editApiKeyDialog.tenant?.hasWhatsappAgentId
                      ? 'Enter new WhatsApp agent ID to update'
                      : 'Enter WhatsApp Agent ID (optional)'
                  }
                  value={whatsappAgentId}
                  onChange={(e) => setWhatsappAgentId(e.target.value)}
                  data-testid="input-whatsapp-agent-id"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {editApiKeyDialog.tenant?.hasWhatsappAgentId
                    ? 'Enter a new agent ID to update, or leave empty to keep existing.'
                    : "The agent ID to use for this tenant's WhatsApp integration."}
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setAgentManagementDialog({
                      open: true,
                      tenant: editApiKeyDialog.tenant,
                    });
                    setEditApiKeyDialog({ open: false, tenant: null });
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage All Agents (Advanced)
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Configure multiple agents with channel assignments, sync from Retell API
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditApiKeyDialog({ open: false, tenant: null });
                  setApiKeyInput('');
                  setSelectedAgentId('');
                  setWhatsappAgentId('');
                }}
                data-testid="button-cancel-api-key"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editApiKeyDialog.tenant) {
                    const payload: any = {
                      tenantId: editApiKeyDialog.tenant.id,
                    };

                    // If user entered a new API key, send it
                    if (apiKeyInput.trim()) {
                      payload.retellApiKey = apiKeyInput.trim();
                    } else if (editApiKeyDialog.tenant.hasRetellApiKey) {
                      // If API key exists but user didn't enter a new one, send sentinel value
                      payload.retellApiKey = '__KEEP_EXISTING__';
                    }

                    // Send widget agent ID if user entered a value
                    if (selectedAgentId.trim()) {
                      payload.retellAgentId = selectedAgentId.trim();
                    }

                    // Send WhatsApp agent ID if user entered a value
                    if (whatsappAgentId.trim()) {
                      payload.whatsappAgentId = whatsappAgentId.trim();
                    }

                    updateRetellApiKeyMutation.mutate(payload);
                  }
                }}
                disabled={
                  // Enable if user typed anything in any field, or if saving
                  (!apiKeyInput.trim() && !selectedAgentId.trim() && !whatsappAgentId.trim()) ||
                  updateRetellApiKeyMutation.isPending
                }
                data-testid="button-save-api-key"
              >
                {updateRetellApiKeyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Agent Management Dialog */}
        <AgentManagementDialog
          open={agentManagementDialog.open}
          tenant={agentManagementDialog.tenant}
          onClose={() => {
            setAgentManagementDialog({ open: false, tenant: null });
          }}
          onBack={() => {
            setEditApiKeyDialog({
              open: true,
              tenant: agentManagementDialog.tenant,
            });
            setAgentManagementDialog({ open: false, tenant: null });
          }}
        />
      </div>
    </div>
  );
}

// Agent Management Dialog Component
function AgentManagementDialog({
  open,
  tenant,
  onClose,
  onBack,
}: {
  open: boolean;
  tenant: any | null;
  onClose: () => void;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [retellAgents, setRetellAgents] = useState<any[]>([]);
  const [configuredAgents, setConfiguredAgents] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Record<string, 'inbound' | 'outbound'>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRetellAgents, setShowRetellAgents] = useState(false);

  // Fetch configured agents when dialog opens
  useEffect(() => {
    if (open && tenant?.id) {
      fetchConfiguredAgents();
    }
  }, [open, tenant]);

  const fetchConfiguredAgents = async () => {
    try {
      const response = await apiRequest(
        'GET',
        `/api/platform/tenants/${tenant.id}/retell/agents/configured`,
      );
      const data = await response.json();
      // API returns { agents: [...], count: ... }
      const agents = Array.isArray(data.agents) ? data.agents : Array.isArray(data) ? data : [];
      setConfiguredAgents(agents);
    } catch (error) {
      console.error('Failed to fetch configured agents:', error);
      setConfiguredAgents([]);
    }
  };

  const syncFromRetell = async () => {
    if (!tenant?.hasRetellApiKey) {
      toast({
        title: 'Retell API Key Required',
        description: 'Please configure a Retell API key first to sync agents.',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const response = await apiRequest('GET', `/api/platform/tenants/${tenant.id}/retell/agents`);
      const data = await response.json();
      // API returns { agents: [...], totalAgents, configuredCount }
      const agents = Array.isArray(data.agents) ? data.agents : [];
      setRetellAgents(agents);
      setShowRetellAgents(true);

      // Pre-select already configured agents
      const preselected: Record<string, 'inbound' | 'outbound'> = {};
      agents.forEach((agent: any) => {
        if (agent.enabled) {
          preselected[agent.agentId] = agent.channel || 'inbound';
        }
      });
      setSelectedAgents(preselected);

      toast({
        title: 'Agents synced successfully',
        description: `Found ${agents.length} agents from Retell AI`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to sync agents',
        description: error.message || 'Could not fetch agents from Retell AI',
        variant: 'destructive',
      });
      setRetellAgents([]);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveAgentConfiguration = async () => {
    const agentsToSave = Object.entries(selectedAgents).map(([agentId, channel]) => ({
      agentId,
      channel,
    }));

    if (agentsToSave.length === 0) {
      toast({
        title: 'No agents selected',
        description: 'Please select at least one agent to configure.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest('POST', `/api/platform/tenants/${tenant.id}/retell/agents/sync`, {
        agents: agentsToSave,
      });

      toast({
        title: 'Agents configured successfully',
        description: `Configured ${agentsToSave.length} agent(s) for webhook routing.`,
      });

      // Refresh configured agents list
      await fetchConfiguredAgents();
      setShowRetellAgents(false);
      setRetellAgents([]);
    } catch (error: any) {
      toast({
        title: 'Failed to save configuration',
        description: error.message || 'Could not save agent configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const removeAgent = async (agentId: string) => {
    try {
      await apiRequest('DELETE', `/api/platform/tenants/${tenant.id}/retell/agents/${agentId}`);

      toast({
        title: 'Agent removed',
        description: 'Agent has been removed from configuration.',
      });

      await fetchConfiguredAgents();
    } catch (error: any) {
      toast({
        title: 'Failed to remove agent',
        description: error.message || 'Could not remove agent',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Manage Retell AI Agents - {tenant?.name}
          </DialogTitle>
          <DialogDescription>
            Configure multiple agents with channel assignments. Sync agents from your Retell AI
            account or manage existing configurations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={syncFromRetell} disabled={isSyncing || !tenant?.hasRetellApiKey}>
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Sync from Retell AI
                </>
              )}
            </Button>
            {!tenant?.hasRetellApiKey && (
              <p className="text-sm text-muted-foreground my-auto">
                Configure Retell API key first to sync agents
              </p>
            )}
          </div>

          {/* Retell Agents Selection (after sync) */}
          {showRetellAgents && retellAgents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Agents to Configure</CardTitle>
                <CardDescription>
                  Choose which agents to enable and specify their call direction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Enable</TableHead>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Agent ID</TableHead>
                      <TableHead className="w-40">Direction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retellAgents.map((agent) => (
                      <TableRow key={agent.agentId}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={!!selectedAgents[agent.agentId]}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAgents({
                                  ...selectedAgents,
                                  [agent.agentId]: agent.channel || 'inbound',
                                });
                              } else {
                                const { [agent.agentId]: _, ...rest } = selectedAgents;
                                setSelectedAgents(rest);
                              }
                            }}
                            className="w-4 h-4"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{agent.agentName}</TableCell>
                        <TableCell className="font-mono text-sm">{agent.agentId}</TableCell>
                        <TableCell>
                          <Select
                            value={selectedAgents[agent.agentId] || 'inbound'}
                            onValueChange={(value: 'inbound' | 'outbound') => {
                              setSelectedAgents({
                                ...selectedAgents,
                                [agent.agentId]: value,
                              });
                            }}
                            disabled={!selectedAgents[agent.agentId]}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inbound">
                                <span className="inline-flex items-center">
                                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                                  Inbound
                                </span>
                              </SelectItem>
                              <SelectItem value="outbound">
                                <span className="inline-flex items-center">
                                  <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>
                                  Outbound
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex gap-2 mt-4">
                  <Button onClick={saveAgentConfiguration} disabled={isSaving}>
                    {isSaving ? (
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRetellAgents(false);
                      setRetellAgents([]);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Currently Configured Agents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Currently Configured Agents</CardTitle>
              <CardDescription>
                Agents that are actively configured for webhook routing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configuredAgents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No agents configured yet. Sync from Retell AI to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Agent ID</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configuredAgents.map((agent) => (
                      <TableRow key={agent.agentId}>
                        <TableCell className="font-medium">{agent.agentName}</TableCell>
                        <TableCell className="font-mono text-sm">{agent.agentId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{agent.channel}</Badge>
                        </TableCell>
                        <TableCell>
                          {agent.isActive ? (
                            <Badge variant="default" className="bg-green-500">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAgent(agent.agentId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onBack}>
            Back to Basic Configuration
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
