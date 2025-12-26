/**
 * Embellics Customer Management API Documentation
 * Reference documentation for customer tracking endpoints.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface EmbellicsConfigPageProps {
  embedded?: boolean;
}

// Copy button component
function CopyButton({ text, url }: { text: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}${url}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-8 px-2"
      title={`Copy ${text}`}
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export default function EmbellicsConfigPage({ embedded = false }: EmbellicsConfigPageProps) {
  return (
    <div className={embedded ? '' : 'flex-1 space-y-4 p-8 pt-6'}>
      {!embedded && (
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Embellics Customer Management API</h2>
            <p className="text-muted-foreground">
              Track customers who book through your platform (Voice, Web, WhatsApp)
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>
              Customer management system for tracking bookings through the Embellics platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              The Embellics customer management endpoints allow you to track customers who book
              through your platform channels (Voice AI, Web Chat, WhatsApp). These endpoints should
              be called server-side when a booking is confirmed. All customer data is stored with
              tenant isolation for multi-tenant security.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                💡 Integration Point
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Call these endpoints from your Retell AI webhook handlers, chat completion logic, or
                N8N workflows after a booking is successfully confirmed.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Create Client Endpoint - Webhook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">POST</Badge>
              <code className="text-sm">/api/platform/webhook/clients</code>
              <CopyButton text="endpoint URL" url="/api/platform/webhook/clients" />
            </CardTitle>
            <CardDescription>Create or update customer from external systems (Retell AI, N8N)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">
                Creates a new customer record or updates an existing one. Phone number is used as the
                unique identifier per tenant. Designed for external systems like Retell AI, N8N, and webhooks.
              </p>
              <p className="text-sm text-red-600 font-medium mt-2">
                🔐 Authentication Required: X-API-Key header (not Bearer token)
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Headers</h4>
              <div className="bg-muted p-4 rounded-md">
                <code className="text-xs font-mono">
                  X-API-Key: Your API key from environment variables<br/>
                  Content-Type: application/json
                </code>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Request Body</h4>
              <div className="bg-muted p-4 rounded-md overflow-x-auto">
                <pre className="text-xs font-mono">
                  {JSON.stringify(
                    {
                      tenantId: 'string (required) - Your tenant ID',
                      firstName: 'string (required)',
                      lastName: 'string (required)',
                      phone: 'string (required) - E.164 format recommended',
                      email: 'string (optional)',
                      firstInteractionSource: 'voice | web | whatsapp (required)',
                      status: 'active | inactive | blocked (default: active)',
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  ℹ️ <strong>Auto-populated fields:</strong> <code>firstInteractionDate</code> is
                  automatically set to the current timestamp when the client is created.{' '}
                  <code>firstBookingDate</code> is automatically set when the client makes their
                  first booking.
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Example Request</h4>
              <div className="bg-muted p-4 rounded-md overflow-x-auto">
                <pre className="text-xs font-mono">{`POST /api/platform/webhook/clients
X-API-Key: YOUR_API_KEY
Content-Type: application/json

${JSON.stringify(
  {
    tenantId: 'ab40f9f0-e696-4f46-bf00-4c7cf96338cc',
    firstName: 'Emma',
    lastName: 'Johnson',
    phone: '+353871234567',
    email: 'emma.johnson@example.com',
    firstInteractionSource: 'voice',
    status: 'active',
  },
  null,
  2,
)}`}</pre>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Responses</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-600 hover:bg-green-700">201</Badge>
                    <span className="text-sm">Created - New customer created</span>
                  </div>
                  <div className="bg-muted p-3 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(
                        {
                          success: true,
                          client: {
                            id: '{CLIENT_UUID}',
                            tenantId: '{TENANT_ID}',
                            firstName: 'Emma',
                            lastName: 'Johnson',
                            phone: '+353871234567',
                            firstInteractionSource: 'voice',
                            firstInteractionDate: '2025-12-26T10:30:00Z', // Auto-set
                            firstBookingDate: null, // Set when first booking created
                            status: 'active',
                          },
                          message: 'Client created successfully',
                          existed: false,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600 hover:bg-blue-700">200</Badge>
                    <span className="text-sm">OK - Customer already exists</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">401</Badge>
                    <span className="text-sm">Unauthorized - Invalid X-API-Key</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">400</Badge>
                    <span className="text-sm">Bad Request - Missing required fields</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Removed old POST /bookings endpoint - Use /bookings/complete instead */}

        {/* Booking Lifecycle Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">POST</Badge>
              <code className="text-sm">/api/platform/tenants/:tenantId/bookings</code>
              <CopyButton text="endpoint URL" url="/api/platform/tenants/:tenantId/bookings" />
            </CardTitle>
            <CardDescription>Record a new booking for a customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">
                Creates a booking record linked to a customer. The customer must already exist in
                the system. This endpoint tracks all appointment details including service, staff,
                pricing, and booking source.
              </p>
              <p className="text-sm text-red-600 font-medium mt-2">
                🔐 Authentication Required: Bearer token with Platform Admin or Client Admin access
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">URL Parameters</h4>
              <div className="bg-muted p-4 rounded-md">
                <code className="text-xs font-mono">
                  tenantId: The unique identifier for the tenant/business
                </code>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Request Body</h4>
              <div className="bg-muted p-4 rounded-md overflow-x-auto">
                <pre className="text-xs font-mono">
                  {JSON.stringify(
                    {
                      clientId: 'string (required) - Customer UUID',
                      bookingDate: 'ISO 8601 datetime (required)',
                      serviceName: 'string (required)',
                      serviceCategory: 'string (optional)',
                      duration: 'number (optional) - minutes',
                      staffMember: 'string (optional)',
                      amount: 'number (required) - decimal',
                      currency: 'string (default: EUR)',
                      status: 'pending | confirmed | completed | cancelled (default: confirmed)',
                      paymentStatus: 'pending | paid | refunded (default: pending)',
                      source: 'voice | web | whatsapp (required)',
                      externalBookingId: 'string (optional) - Phorest/Fresha booking ID',
                      notes: 'string (optional)',
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Example Request</h4>
              <div className="bg-muted p-4 rounded-md overflow-x-auto">
                <pre className="text-xs font-mono">{`POST /api/platform/tenants/{TENANT_ID}/bookings
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

${JSON.stringify(
  {
    clientId: '{CLIENT_UUID}',
    bookingDate: '2025-12-27T14:00:00Z',
    serviceName: 'Deep Tissue Massage',
    serviceCategory: 'massage',
    duration: 60,
    staffMember: 'Emma Thompson',
    amount: 75.0,
    currency: 'EUR',
    status: 'confirmed',
    paymentStatus: 'pending',
    source: 'voice',
    externalBookingId: 'PHOREST-12345',
    notes: 'Customer requested firm pressure',
  },
  null,
  2,
)}`}</pre>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Responses</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-600 hover:bg-green-700">201</Badge>
                    <span className="text-sm">Created - Booking recorded</span>
                  </div>
                  <div className="bg-muted p-3 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(
                        {
                          id: '{BOOKING_UUID}',
                          tenantId: '{TENANT_ID}',
                          clientId: '{CLIENT_UUID}',
                          bookingDate: '2025-12-27T14:00:00Z',
                          serviceName: 'Deep Tissue Massage',
                          serviceCategory: 'massage',
                          duration: 60,
                          staffMember: 'Emma Thompson',
                          amount: 75.0,
                          currency: 'EUR',
                          status: 'confirmed',
                          paymentStatus: 'pending',
                          source: 'voice',
                          externalBookingId: 'PHOREST-12345',
                          createdAt: '2025-12-26T10:30:00Z',
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">404</Badge>
                    <span className="text-sm">Not Found - Customer doesn't exist</span>
                  </div>
                  <div className="bg-muted p-3 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(
                        {
                          error: 'Client not found or does not belong to this tenant',
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">403</Badge>
                    <span className="text-sm">Forbidden - Access denied</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Lifecycle Section */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Lifecycle Management</CardTitle>
            <CardDescription>
              Track bookings from reservation to completion/cancellation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                📋 Booking Status Flow
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                <strong>pending</strong> (reserved) → <strong>confirmed</strong> (deposit paid) →{' '}
                <strong>completed</strong> / <strong>cancelled</strong> / <strong>no_show</strong>
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                💳 Payment Status Flow
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                <strong>awaiting_deposit</strong> → <strong>deposit_paid</strong> →{' '}
                <strong>paid</strong> / <strong>refunded</strong> / <strong>no_payment</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Track Interaction Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">POST</Badge>
              <code className="text-sm">/api/platform/interactions/track</code>
              <CopyButton text="endpoint URL" url="/api/platform/interactions/track" />
            </CardTitle>
            <CardDescription>
              Track customer interaction (inquiry/reservation) without creating Phorest booking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">When to use</h4>
              <p className="text-sm text-muted-foreground">
                Use this endpoint when a customer makes an inquiry or reserves a booking but hasn't
                paid yet. This creates/updates a client record and optionally creates a lead for
                follow-up. Does NOT create booking in Phorest.
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Request Body</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {`{
  "tenantId": "{TENANT_ID}",
  "phone": "+353871234567",
  "email": "customer@example.com",
  "firstName": "Sarah",
  "lastName": "O'Brien",
  "source": "voice",
  "sourceDetails": {
    "callId": "call_abc123",
    "agentId": "agent_xyz"
  },
  "interactionType": "reservation",
  "notes": "Interested in facial treatment, wants to book for next week",
  "serviceInterest": "Premium Facial"
}`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Fields</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">tenantId</code>
                  <span className="text-red-600 ml-1">*</span> - Your tenant ID
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">phone</code>
                  <span className="text-red-600 ml-1">*</span> - Customer phone (unique identifier)
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">source</code>
                  <span className="text-red-600 ml-1">*</span> - 'voice', 'web', or 'whatsapp'
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">interactionType</code> - 'inquiry',
                  'reservation', 'callback_request'
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">email, firstName, lastName</code> -
                  Customer details (optional but recommended)
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">notes</code> - Any additional notes
                  from the interaction
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Response</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {`{
  "success": true,
  "client": {
    "id": "{CLIENT_UUID}",
    "tenantId": "{TENANT_ID}",
    "phone": "+353871234567",
    "email": "customer@example.com",
    "firstName": "Sarah",
    "lastName": "O'Brien",
    "firstInteractionSource": "voice",
    "status": "active",
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "lead": {
    "id": "{LEAD_UUID}",
    "tenantId": "{TENANT_ID}",
    "phone": "+353871234567",
    "status": "interested",
    "notes": "Interested in facial treatment...",
    "createdAt": "2025-01-15T10:30:00Z"
  },
  "message": "Interaction tracked successfully"
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Complete Booking Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="default">POST</Badge>
              <code className="text-sm">/api/platform/bookings/complete</code>
              <CopyButton text="endpoint URL" url="/api/platform/bookings/complete" />
            </CardTitle>
            <CardDescription>Create confirmed booking with Phorest integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">When to use</h4>
              <p className="text-sm text-muted-foreground">
                Use this endpoint when a customer pays a deposit or confirms their booking. This
                creates a booking record, integrates with Phorest to create the appointment, and
                updates the client status.
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Request Body</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {`{
  "tenantId": "{TENANT_ID}",
  "clientId": "{CLIENT_UUID}",
  "businessId": "{BUSINESS_UUID}",
  "branchId": "{BRANCH_UUID}",
  "serviceName": "Premium Facial Treatment",
  "serviceCategory": "facial",
  "amount": 89.00,
  "currency": "EUR",
  "depositAmount": 20.00,
  "bookingDateTime": "2025-01-20T14:30:00Z",
  "duration": 60,
  "staffMemberName": "Emma Smith",
  "staffMemberId": "staff_123",
  "bookingSource": "voice",
  "bookingSourceDetails": {
    "callId": "call_abc123",
    "agentId": "agent_xyz"
  },
  "createInPhorest": true
}`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Required Fields</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">tenantId</code> - Your tenant ID
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">clientId</code> - Customer's UUID
                  from previous call
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">serviceName</code> - Name of the
                  service/treatment
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">amount</code> - Total booking
                  amount
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">bookingDateTime</code> - ISO 8601
                  timestamp
                </li>
                <li>
                  <code className="bg-muted px-1 py-0.5 rounded">bookingSource</code> - 'voice',
                  'web', or 'whatsapp'
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Response</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {`{
  "success": true,
  "booking": {
    "id": "{BOOKING_UUID}",
    "tenantId": "{TENANT_ID}",
    "clientId": "{CLIENT_UUID}",
    "serviceName": "Premium Facial Treatment",
    "amount": 89.00,
    "depositAmount": 20.00,
    "status": "confirmed",
    "paymentStatus": "deposit_paid",
    "bookingDateTime": "2025-01-20T14:30:00Z",
    "confirmedAt": "2025-01-15T10:35:00Z",
    "serviceProviderBookingId": "phorest_appt_456",
    "createdAt": "2025-01-15T10:35:00Z"
  },
  "message": "Booking completed successfully"
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Update Booking Status Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary">PATCH</Badge>
              <code className="text-sm">/api/platform/tenants/:tenantId/bookings/:bookingId</code>
              <CopyButton
                text="endpoint URL"
                url="/api/platform/tenants/:tenantId/bookings/:bookingId"
              />
            </CardTitle>
            <CardDescription>Update booking status and lifecycle actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">When to use</h4>
              <p className="text-sm text-muted-foreground">
                Use this endpoint to update booking status throughout its lifecycle: confirm,
                complete, cancel, or mark as no-show.
              </p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Actions</h4>
              <div className="space-y-3">
                <div className="bg-muted p-3 rounded-lg">
                  <h5 className="font-medium text-sm mb-1">Confirm Booking (Deposit Paid)</h5>
                  <pre className="text-xs overflow-x-auto">
                    {`{
  "action": "confirm",
  "depositAmount": 20.00
}`}
                  </pre>
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <h5 className="font-medium text-sm mb-1">Complete Booking (Service Done)</h5>
                  <pre className="text-xs overflow-x-auto">
                    {`{
  "action": "complete"
}`}
                  </pre>
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <h5 className="font-medium text-sm mb-1">Cancel Booking</h5>
                  <pre className="text-xs overflow-x-auto">
                    {`{
  "action": "cancel",
  "reason": "Customer requested cancellation",
  "refundAmount": 20.00,
  "notes": "Full deposit refunded"
}`}
                  </pre>
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <h5 className="font-medium text-sm mb-1">Mark as No-Show</h5>
                  <pre className="text-xs overflow-x-auto">
                    {`{
  "action": "no_show"
}`}
                  </pre>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">General Update</h4>
              <p className="text-sm text-muted-foreground mb-2">
                You can also update any booking field directly without an action:
              </p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {`{
  "staffMemberName": "New Staff Name",
  "duration": 90,
  "amount": 120.00
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Integration Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Flow</CardTitle>
            <CardDescription>
              How to integrate customer tracking into your booking process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  1
                </div>
                <div>
                  <h5 className="font-semibold text-sm">Customer makes inquiry/reservation</h5>
                  <p className="text-sm text-muted-foreground">
                    Call POST /api/platform/interactions/track to record the initial contact
                  </p>
                  <Badge variant="outline" className="mt-1">
                    Status: pending
                  </Badge>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  2
                </div>
                <div>
                  <h5 className="font-semibold text-sm">Customer pays deposit</h5>
                  <p className="text-sm text-muted-foreground">
                    Call POST /api/platform/bookings/complete to create confirmed booking + Phorest
                    integration
                  </p>
                  <Badge variant="outline" className="mt-1">
                    Status: confirmed
                  </Badge>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  3
                </div>
                <div>
                  <h5 className="font-semibold text-sm">Service completed or cancelled</h5>
                  <p className="text-sm text-muted-foreground">
                    Call PATCH /bookings/:bookingId with action: 'complete', 'cancel', or 'no_show'
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">completed</Badge>
                    <Badge variant="outline">cancelled</Badge>
                    <Badge variant="outline">no_show</Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Where to integrate</h4>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Retell AI webhook handler - After voice call booking confirmation</li>
                <li>Chat widget completion - After web chat booking is finalized</li>
                <li>WhatsApp message handler - After WhatsApp booking confirmation</li>
                <li>N8N workflow - In your booking workflow after Phorest/Fresha creation</li>
              </ul>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                ⚡ Pro Tip: Server-Side Only
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                These endpoints should only be called from your backend/server-side code. Never
                expose your authentication tokens to the frontend or call these from client-side
                JavaScript.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
