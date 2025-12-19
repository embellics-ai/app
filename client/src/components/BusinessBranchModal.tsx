import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Star,
  StarOff,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface BusinessBranchModalProps {
  tenantId: string;
  tenantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Branch {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Business {
  id: string;
  tenantId: string;
  serviceName: string;
  businessId: string;
  businessName: string;
  createdAt: string;
  updatedAt: string;
  branches: Branch[];
}

export default function BusinessBranchModal({
  tenantId,
  tenantName,
  open,
  onOpenChange,
}: BusinessBranchModalProps) {
  const { toast } = useToast();
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<string | null>(null);
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState<string | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);
  const [addingBusinessToService, setAddingBusinessToService] = useState<string | null>(null);
  const [addingBranchToBusiness, setAddingBranchToBusiness] = useState<string | null>(null);

  // Form states
  const [newBusiness, setNewBusiness] = useState({
    serviceName: '',
    businessId: '',
    businessName: '',
  });
  const [editBusinessName, setEditBusinessName] = useState('');
  const [newBranch, setNewBranch] = useState({
    branchId: '',
    branchName: '',
  });
  const [editBranchData, setEditBranchData] = useState({
    branchName: '',
    isPrimary: false,
    isActive: true,
  });

  // Fetch businesses with branches
  const {
    data: businesses = [],
    isLoading,
    error,
  } = useQuery<Business[]>({
    queryKey: [`/api/platform/tenants/${tenantId}/businesses`],
    enabled: open,
  });

  // Create business mutation
  const createBusinessMutation = useMutation({
    mutationFn: async (data: typeof newBusiness) => {
      const response = await apiRequest(
        'POST',
        `/api/platform/tenants/${tenantId}/businesses`,
        data,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Business created',
        description: 'Business configuration saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platform/tenants/${tenantId}/businesses`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      setAddingBusinessToService(null);
      setNewBusiness({ serviceName: '', businessId: '', businessName: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create business',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Update business mutation
  const updateBusinessMutation = useMutation({
    mutationFn: async ({
      businessId,
      businessName,
    }: {
      businessId: string;
      businessName: string;
    }) => {
      const response = await apiRequest(
        'PUT',
        `/api/platform/tenants/${tenantId}/businesses/${businessId}`,
        { businessName },
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Business updated',
        description: 'Business name updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platform/tenants/${tenantId}/businesses`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      setEditingBusiness(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update business',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Delete business mutation
  const deleteBusinessMutation = useMutation({
    mutationFn: async (businessId: string) => {
      const response = await apiRequest(
        'DELETE',
        `/api/platform/tenants/${tenantId}/businesses/${businessId}`,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Business deleted',
        description: 'Business and all its branches have been deleted',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platform/tenants/${tenantId}/businesses`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      setDeletingBusiness(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete business',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Create branch mutation
  const createBranchMutation = useMutation({
    mutationFn: async ({ businessId, data }: { businessId: string; data: any }) => {
      const response = await apiRequest(
        'POST',
        `/api/platform/tenants/${tenantId}/businesses/${businessId}/branches`,
        data,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Branch created',
        description: 'Branch added successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platform/tenants/${tenantId}/businesses`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      setAddingBranchToBusiness(null);
      setNewBranch({ branchId: '', branchName: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create branch',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Update branch mutation
  const updateBranchMutation = useMutation({
    mutationFn: async ({
      businessId,
      branchDbId,
      data,
    }: {
      businessId: string;
      branchDbId: string;
      data: any;
    }) => {
      const response = await apiRequest(
        'PUT',
        `/api/platform/tenants/${tenantId}/businesses/${businessId}/branches/${branchDbId}`,
        data,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Branch updated',
        description: 'Branch configuration saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platform/tenants/${tenantId}/businesses`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      setEditingBranch(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update branch',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Delete branch mutation
  const deleteBranchMutation = useMutation({
    mutationFn: async ({ businessId, branchDbId }: { businessId: string; branchDbId: string }) => {
      const response = await apiRequest(
        'DELETE',
        `/api/platform/tenants/${tenantId}/businesses/${businessId}/branches/${branchDbId}`,
      );
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Branch deleted',
        description: 'Branch has been removed',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platform/tenants/${tenantId}/businesses`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/tenants'] });
      setDeletingBranch(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete branch',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleCreateBusiness = () => {
    if (!newBusiness.serviceName || !newBusiness.businessId || !newBusiness.businessName) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }
    createBusinessMutation.mutate(newBusiness);
  };

  const handleUpdateBusiness = (businessId: string) => {
    if (!editBusinessName.trim()) {
      toast({
        title: 'Invalid name',
        description: 'Business name cannot be empty',
        variant: 'destructive',
      });
      return;
    }
    updateBusinessMutation.mutate({ businessId, businessName: editBusinessName });
  };

  const handleCreateBranch = (businessId: string) => {
    if (!newBranch.branchId || !newBranch.branchName) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in branch ID and name',
        variant: 'destructive',
      });
      return;
    }
    createBranchMutation.mutate({
      businessId,
      data: {
        branchId: newBranch.branchId,
        branchName: newBranch.branchName,
        isPrimary: false,
        isActive: true,
      },
    });
  };

  const handleUpdateBranch = (businessId: string, branchDbId: string) => {
    if (!editBranchData.branchName.trim()) {
      toast({
        title: 'Invalid name',
        description: 'Branch name cannot be empty',
        variant: 'destructive',
      });
      return;
    }
    updateBranchMutation.mutate({ businessId, branchDbId, data: editBranchData });
  };

  const toggleBranchPrimary = (business: Business, branch: Branch) => {
    updateBranchMutation.mutate({
      businessId: business.id,
      branchDbId: branch.id,
      data: {
        branchName: branch.branchName,
        isPrimary: !branch.isPrimary,
        isActive: branch.isActive,
      },
    });
  };

  const toggleBranchActive = (business: Business, branch: Branch) => {
    updateBranchMutation.mutate({
      businessId: business.id,
      branchDbId: branch.id,
      data: {
        branchName: branch.branchName,
        isPrimary: branch.isPrimary,
        isActive: !branch.isActive,
      },
    });
  };

  const totalBranchCount = businesses.reduce((sum, b) => sum + (b.branches?.length || 0), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Business & Branches - {tenantName}
            </DialogTitle>
            <DialogDescription>
              Manage business configurations and branch locations for external API integrations
              {totalBranchCount > 0 &&
                ` • ${totalBranchCount} ${totalBranchCount === 1 ? 'branch' : 'branches'} total`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add Business Button */}
            {!addingBusinessToService && (
              <Button
                onClick={() => setAddingBusinessToService('new')}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Business Configuration
              </Button>
            )}

            {/* Add Business Form */}
            {addingBusinessToService && (
              <Card className="border-purple-500/50 bg-purple-950/20">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">New Business Configuration</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAddingBusinessToService(null);
                        setNewBusiness({ serviceName: '', businessId: '', businessName: '' });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="serviceName">Service Name</Label>
                      <Input
                        id="serviceName"
                        placeholder="e.g., phorest_api"
                        value={newBusiness.serviceName}
                        onChange={(e) =>
                          setNewBusiness({ ...newBusiness, serviceName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="businessId">Business ID</Label>
                      <Input
                        id="businessId"
                        placeholder="e.g., BUS123"
                        value={newBusiness.businessId}
                        onChange={(e) =>
                          setNewBusiness({ ...newBusiness, businessId: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input
                        id="businessName"
                        placeholder="e.g., Main Salon"
                        value={newBusiness.businessName}
                        onChange={(e) =>
                          setNewBusiness({ ...newBusiness, businessName: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateBusiness}
                    disabled={createBusinessMutation.isPending}
                    className="w-full"
                  >
                    {createBusinessMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Business
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-8 text-destructive">
                Failed to load businesses. Please try again.
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && businesses.length === 0 && !addingBusinessToService && (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No business configurations yet</p>
                <p className="text-sm mt-1">Add a business to start managing branches</p>
              </div>
            )}

            {/* Business List */}
            {!isLoading && !error && businesses.length > 0 && (
              <div className="space-y-3">
                {businesses.map((business) => (
                  <Card key={business.id} className="border-gray-700">
                    <CardContent className="p-4">
                      {/* Business Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setExpandedBusiness(
                                expandedBusiness === business.id ? null : business.id,
                              )
                            }
                          >
                            {expandedBusiness === business.id ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                          {editingBusiness === business.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editBusinessName}
                                onChange={(e) => setEditBusinessName(e.target.value)}
                                placeholder="Business name"
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleUpdateBusiness(business.id)}
                                disabled={updateBusinessMutation.isPending}
                              >
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingBusiness(null)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-purple-400" />
                                  <span className="font-semibold">{business.businessName}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {business.serviceName}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    ID: {business.businessId}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {business.branches?.length || 0}{' '}
                                  {business.branches?.length === 1 ? 'branch' : 'branches'}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingBusiness(business.id);
                                    setEditBusinessName(business.businessName);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingBusiness(business.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded Branches */}
                      {expandedBusiness === business.id && (
                        <div className="pl-10 space-y-2 border-l-2 border-purple-500/30 ml-2">
                          {/* Add Branch Form */}
                          {addingBranchToBusiness === business.id ? (
                            <Card className="border-purple-500/30 bg-purple-950/10">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold">New Branch</h4>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setAddingBranchToBusiness(null);
                                      setNewBranch({ branchId: '', branchName: '' });
                                    }}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label htmlFor="branchName" className="text-xs">
                                      Branch Name
                                    </Label>
                                    <Input
                                      id="branchName"
                                      placeholder="e.g., Downtown Location"
                                      value={newBranch.branchName}
                                      onChange={(e) =>
                                        setNewBranch({ ...newBranch, branchName: e.target.value })
                                      }
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="branchId" className="text-xs">
                                      Branch ID
                                    </Label>
                                    <Input
                                      id="branchId"
                                      placeholder="e.g., BR001"
                                      value={newBranch.branchId}
                                      onChange={(e) =>
                                        setNewBranch({ ...newBranch, branchId: e.target.value })
                                      }
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                                <Button
                                  onClick={() => handleCreateBranch(business.id)}
                                  disabled={createBranchMutation.isPending}
                                  size="sm"
                                  className="w-full"
                                >
                                  {createBranchMutation.isPending ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="w-3 h-3 mr-2" />
                                      Save Branch
                                    </>
                                  )}
                                </Button>
                              </CardContent>
                            </Card>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAddingBranchToBusiness(business.id)}
                              className="w-full"
                            >
                              <Plus className="w-3 h-3 mr-2" />
                              Add Branch
                            </Button>
                          )}

                          {/* Branch List */}
                          {business.branches && business.branches.length > 0 && (
                            <div className="space-y-2">
                              {business.branches.map((branch) => (
                                <Card
                                  key={branch.id}
                                  className={`border ${
                                    branch.isPrimary
                                      ? 'border-yellow-500/50 bg-yellow-950/10'
                                      : 'border-gray-700'
                                  }`}
                                >
                                  <CardContent className="p-3">
                                    {editingBranch === branch.id ? (
                                      <div className="space-y-2">
                                        <Input
                                          value={editBranchData.branchName}
                                          onChange={(e) =>
                                            setEditBranchData({
                                              ...editBranchData,
                                              branchName: e.target.value,
                                            })
                                          }
                                          placeholder="Branch name"
                                          className="h-8"
                                        />
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() =>
                                              handleUpdateBranch(business.id, branch.id)
                                            }
                                            disabled={updateBranchMutation.isPending}
                                          >
                                            <Save className="w-3 h-3 mr-1" />
                                            Save
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingBranch(null)}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">
                                              {branch.branchName}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                              ID: {branch.branchId}
                                            </Badge>
                                            {branch.isPrimary && (
                                              <Badge className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-500/50">
                                                <Star className="w-3 h-3 mr-1 fill-yellow-300" />
                                                Primary
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => toggleBranchPrimary(business, branch)}
                                            title={
                                              branch.isPrimary ? 'Remove primary' : 'Set as primary'
                                            }
                                            className="h-7 w-7"
                                          >
                                            {branch.isPrimary ? (
                                              <StarOff className="w-3 h-3" />
                                            ) : (
                                              <Star className="w-3 h-3" />
                                            )}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => toggleBranchActive(business, branch)}
                                            title={branch.isActive ? 'Deactivate' : 'Activate'}
                                            className="h-7 w-7"
                                          >
                                            {branch.isActive ? (
                                              <CheckCircle className="w-3 h-3 text-green-400" />
                                            ) : (
                                              <XCircle className="w-3 h-3 text-gray-400" />
                                            )}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                              setEditingBranch(branch.id);
                                              setEditBranchData({
                                                branchName: branch.branchName,
                                                isPrimary: branch.isPrimary,
                                                isActive: branch.isActive,
                                              });
                                            }}
                                            className="h-7 w-7"
                                          >
                                            <Edit className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeletingBranch(branch.id)}
                                            className="h-7 w-7"
                                          >
                                            <Trash2 className="w-3 h-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}

                          {business.branches && business.branches.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No branches yet. Add one to get started.
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Business Confirmation */}
      <AlertDialog
        open={!!deletingBusiness}
        onOpenChange={(open) => !open && setDeletingBusiness(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Business?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this business configuration and{' '}
              <strong>all its branches</strong>. This action cannot be undone!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBusiness && deleteBusinessMutation.mutate(deletingBusiness)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Business
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Branch Confirmation */}
      <AlertDialog
        open={!!deletingBranch}
        onOpenChange={(open) => !open && setDeletingBranch(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this branch. This action cannot be undone!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingBranch) {
                  const business = businesses.find((b) =>
                    b.branches.some((br) => br.id === deletingBranch),
                  );
                  if (business) {
                    deleteBranchMutation.mutate({
                      businessId: business.id,
                      branchDbId: deletingBranch,
                    });
                  }
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
