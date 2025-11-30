import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Phone, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Platform Analytics Page
 *
 * NOTE: This page previously used the old Retell API endpoint (/api/platform/analytics/retell)
 * which made direct calls to Retell's API. This has been deprecated in favor of database-driven
 * analytics.
 *
 * To re-enable voice analytics on this page:
 * 1. Configure Retell webhooks to send call.ended events to /api/retell/call-ended
 * 2. Update this page to use /api/platform/tenants/:id/analytics/overview endpoint
 * 3. Implement charts using the voice analytics data from the database
 *
 * The unified-analytics.tsx page already uses the new database-driven approach and can
 * serve as a reference implementation.
 */

export default function PlatformAnalytics() {
  return (
    <div className="min-h-screen bg-background p-8" data-testid="page-analytics">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-page-title">
          Platform Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Voice Analytics Dashboard (Currently Under Maintenance)
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Analytics Migration in Progress</AlertTitle>
        <AlertDescription>
          This page is being updated to use the new database-driven analytics system. In the
          meantime, please use the <strong>Analytics</strong> page from the main menu to view
          unified voice and chat analytics.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Voice Analytics Migration
          </CardTitle>
          <CardDescription>What you need to know</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Why is this page temporarily disabled?</h3>
            <p className="text-sm text-muted-foreground">
              We've migrated from directly calling the Retell API to a database-driven analytics
              system. This provides faster performance, historical data storage, and eliminates API
              rate limits.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">Where can I view analytics now?</h3>
            <p className="text-sm text-muted-foreground">
              Navigate to the <strong>Analytics</strong> page from the main menu. This page shows
              unified voice and chat analytics with real-time data.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">To enable voice analytics data:</h3>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Configure your Retell account to send webhooks</li>
              <li>
                Set the webhook URL to:{' '}
                <code className="bg-muted px-1 py-0.5 rounded">/api/retell/call-ended</code>
              </li>
              <li>Voice analytics will automatically populate as calls are completed</li>
            </ol>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>For developers:</strong> The old endpoint{' '}
              <code className="bg-muted px-1 py-0.5 rounded">/api/platform/analytics/retell</code>
              has been removed. Please update any code referencing it to use the new{' '}
              <code className="bg-muted px-1 py-0.5 rounded">
                /api/platform/tenants/:id/analytics/overview
              </code>
              endpoint instead.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
