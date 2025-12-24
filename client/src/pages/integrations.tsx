/**
 * Integrations Configuration Page
 *
 * Unified page for managing all external service integrations.
 * Uses tabs to organize different services (Phorest, future services).
 *
 * ACCESS CONTROL: Platform Admin only
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Package } from 'lucide-react';
import PhorestConfigPage from '@/pages/phorest-config';
import { useAuth } from '@/contexts/auth-context';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('phorest');
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Access control: Only platform admins can view this page
  useEffect(() => {
    if (!isLoading && user && !user.isPlatformAdmin) {
      toast({
        title: 'Access Denied',
        description:
          "You don't have permission to access integrations. This page is for Platform Admins only.",
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

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Integration Documentation</h2>
          <p className="text-muted-foreground">
            Configure external service integrations for your tenant
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="phorest" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Phorest
          </TabsTrigger>
          <TabsTrigger value="other" className="flex items-center gap-2" disabled>
            <Package className="h-4 w-4" />
            Other Services
            <span className="text-xs text-muted-foreground ml-1">(Coming Soon)</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phorest" className="space-y-4">
          <PhorestConfigPage embedded={true} />
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Additional Integrations</CardTitle>
              <CardDescription>
                More service integrations will be available here in the future
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Stay tuned for integrations with other salon management systems, booking platforms,
                and business tools.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
