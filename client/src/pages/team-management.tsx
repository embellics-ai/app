import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  UserPlus,
  Users,
  Loader2,
  AlertCircle,
  Trash2,
  Mail,
  Headphones,
  Eye,
  EyeOff,
  Copy,
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

const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['client_admin', 'support_staff']),
});

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

export default function TeamManagementPage() {
  const { toast } = useToast();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showTempPassword, setShowTempPassword] = useState(true); // Auto-show by default
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Redirect support staff away from team management page - only client admins can access
  useEffect(() => {
    if (user && user.role === 'support_staff') {
      toast({
        title: 'Access Denied',
        description: "You don't have permission to access team management.",
        variant: 'destructive',
      });
      setLocation('/agent-dashboard');
    }
  }, [user, setLocation, toast]);

  const form = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'support_staff',
    },
  });

  // Fetch tenant information to display company name
  const { data: tenantInfo } = useQuery<any>({
    queryKey: [`/api/tenants/${user?.tenantId}`],
    enabled: !!user?.tenantId,
  });

  // Fetch all team members
  const { data: allTeamMembers = [], isLoading: teamLoading } = useQuery<any[]>({
    queryKey: ['/api/tenant/team'],
  });

  // Fetch pending invitations for this tenant
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<any[]>({
    queryKey: ['/api/tenant/invitations/pending'],
  });

  // Separate team members by role
  const clientAdmins = allTeamMembers.filter((member: any) => member.role === 'client_admin');
  const supportStaff = allTeamMembers.filter((member: any) => member.role === 'support_staff');

  const inviteMemberMutation = useMutation({
    mutationFn: async (data: InviteMemberFormData) => {
      const response = await apiRequest('POST', '/api/tenant/invite-member', data);
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.emailSent) {
        toast({
          title: 'Team member invited successfully',
          description:
            'Invitation email sent. Check the Invitations tab for the temporary password.',
        });
      } else {
        toast({
          title: 'Invitation created',
          description: `Email failed to send: ${
            data.emailError || 'Unknown error'
          }. Check the Invitations tab for the temporary password.`,
          variant: 'destructive',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/tenant/team'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/tenant/invitations/pending'],
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to invite team member',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('DELETE', `/api/tenant/team/${userId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Team member deleted successfully',
        description: 'The team member has been removed from your team.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/team'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/tenant/invitations/pending'],
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete team member',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'Temporary password has been copied to your clipboard.',
    });
  };

  const onSubmit = (data: InviteMemberFormData) => {
    setTempPassword(null);
    setShowTempPassword(true); // Reset for next invitation
    inviteMemberMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Team Management</h1>
        <p className="text-muted-foreground">
          Invite and manage your team members (client admins and support staff)
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team-members">
            <Headphones className="w-4 h-4 mr-2" />
            Team Members
          </TabsTrigger>
          <TabsTrigger value="invited" data-testid="tab-invited">
            <Mail className="w-4 h-4 mr-2" />
            Invited
          </TabsTrigger>
          <TabsTrigger value="invite" data-testid="tab-invite-member">
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </TabsTrigger>
        </TabsList>

        {/* Users Tab - Client Admins */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Admins</CardTitle>
              <CardDescription>
                All client administrator accounts for your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : clientAdmins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No client admin users found.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientAdmins.map((member: any) => (
                        <TableRow key={member.id} data-testid={`row-user-${member.id}`}>
                          <TableCell className="font-medium">
                            {member.firstName} {member.lastName}
                          </TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{member.role.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.phoneNumber || 'Not provided'}
                          </TableCell>
                          <TableCell>
                            {member.onboardingCompleted ? (
                              <Badge variant="secondary">Active</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user?.id !== member.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    data-testid={`button-delete-user-${member.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Client Admin</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete {member.firstName}{' '}
                                      {member.lastName}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel
                                      data-testid={`button-cancel-delete-${member.id}`}
                                    >
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMemberMutation.mutate(member.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      data-testid={`button-confirm-delete-${member.id}`}
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

        {/* Team Members Tab - Support Staff */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Support Staff</CardTitle>
              <CardDescription>
                All support staff members who handle live chat handoffs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : supportStaff.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No support staff members yet. Invite your first support staff member!
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supportStaff.map((member: any) => (
                        <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                          <TableCell className="font-medium">
                            {member.firstName} {member.lastName}
                          </TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{member.role.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.phoneNumber || 'Not provided'}
                          </TableCell>
                          <TableCell>
                            {member.onboardingCompleted ? (
                              <Badge variant="secondary">Active</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  data-testid={`button-delete-member-${member.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Support Staff</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {member.firstName}{' '}
                                    {member.lastName}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel
                                    data-testid={`button-cancel-delete-${member.id}`}
                                  >
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMemberMutation.mutate(member.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    data-testid={`button-confirm-delete-${member.id}`}
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

        {/* Invited Tab - Pending Invitations */}
        <TabsContent value="invited" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Team members who have been invited but haven't logged in yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No pending invitations</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invited Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((invitation: any) => (
                        <TableRow
                          key={invitation.id}
                          data-testid={`row-invitation-${invitation.id}`}
                        >
                          <TableCell className="font-medium">
                            {invitation.firstName} {invitation.lastName}
                          </TableCell>
                          <TableCell>{invitation.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{invitation.role.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{invitation.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(invitation.createdAt).toLocaleDateString()}
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

        {/* Invite Member Tab */}
        <TabsContent value="invite" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invite Team Member</CardTitle>
              <CardDescription>
                Send an invitation to a new client admin or support staff member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane" {...field} data-testid="input-firstName" />
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
                            <Input placeholder="Smith" {...field} data-testid="input-lastName" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="jane@example.com"
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            <SelectItem value="client_admin">Client Admin</SelectItem>
                            <SelectItem value="support_staff">Support Staff</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Display company name (read-only) */}
                  <div className="space-y-2">
                    <FormLabel>Company</FormLabel>
                    <Input
                      value={tenantInfo?.name || 'Loading...'}
                      disabled
                      className="bg-muted cursor-not-allowed"
                      data-testid="input-company-name-readonly"
                    />
                    <p className="text-xs text-muted-foreground">
                      New team members will be added to your company
                    </p>
                  </div>

                  {tempPassword && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-medium mb-2">Temporary Password:</p>
                        <div className="flex items-center gap-2 mb-2">
                          <Input
                            value={showTempPassword ? tempPassword : '••••••••••••'}
                            readOnly
                            className="font-mono text-sm flex-1"
                            data-testid="input-temp-password"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => setShowTempPassword(!showTempPassword)}
                            title={showTempPassword ? 'Hide password' : 'Show password'}
                            data-testid="button-toggle-temp-password"
                          >
                            {showTempPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => copyToClipboard(tempPassword)}
                            title="Copy password"
                            data-testid="button-copy-temp-password"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Please share this with the invited team member. They will be prompted to
                          change it on first login.
                        </span>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={inviteMemberMutation.isPending}
                    data-testid="button-invite-member"
                    className="w-full"
                  >
                    {inviteMemberMutation.isPending ? (
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
      </Tabs>
    </div>
  );
}
