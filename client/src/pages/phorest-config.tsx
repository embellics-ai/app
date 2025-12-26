/**
 * Phorest API Documentation
 * Simple reference documentation for Phorest integration endpoints.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';
import { useState } from 'react';

interface PhorestConfigPageProps {
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

export default function PhorestConfigPage({ embedded = false }: PhorestConfigPageProps) {
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({
    'create-client': false,
    'get-client': false,
    'service-categories': false,
    health: false,
    'config-check': false,
  });

  const toggleAll = () => {
    const newState = !allExpanded;
    setAllExpanded(newState);
    setExpandedEndpoints({
      'create-client': newState,
      'get-client': newState,
      'service-categories': newState,
      health: newState,
      'config-check': newState,
    });
  };

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoints((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className={embedded ? '' : 'flex-1 space-y-4 p-8 pt-6'}>
      <div className="flex items-center justify-between space-y-2">
        <div>
          {!embedded && (
            <>
              <h2 className="text-3xl font-bold tracking-tight">Phorest API Documentation</h2>
              <p className="text-muted-foreground">
                Reference documentation for Phorest integration endpoints
              </p>
            </>
          )}
        </div>
        <Button onClick={toggleAll} variant="outline" className="flex items-center gap-2">
          {allExpanded ? (
            <>
              <ChevronsUpDown className="h-4 w-4" />
              Collapse All
            </>
          ) : (
            <>
              <ChevronsDownUp className="h-4 w-4" />
              Expand All
            </>
          )}
        </Button>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>
              Integration with Phorest salon management system for client creation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              The Phorest integration allows you to create clients in Phorest from any channel
              (Widget, Voice, WhatsApp, n8n workflows). All API credentials are stored securely in
              the database and automatically fetched per tenant.
            </p>
          </CardContent>
        </Card>

        {/* POST /api/phorest/clients */}
        <Card>
          <Collapsible
            open={expandedEndpoints['create-client']}
            onOpenChange={() => toggleEndpoint('create-client')}
          >
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="default">POST</Badge>
                    <code className="text-sm">/api/phorest/clients</code>
                    <CopyButton text="endpoint URL" url="/api/phorest/clients" />
                  </CardTitle>
                  {expandedEndpoints['create-client'] ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <CardDescription className="text-left mt-2">
                  Create a new client in Phorest
                </CardDescription>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    Creates a new client in the Phorest salon management system. Phone numbers are
                    automatically formatted to Irish format (+353XXXXXXXXX).
                  </p>
                  <p className="text-sm text-red-600 font-medium mt-2">
                    🔐 Authentication Required: X-API-Key header must be included
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <div className="bg-muted p-4 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(
                        {
                          businessId: 'string (required)',
                          firstName: 'string (required)',
                          lastName: 'string (required)',
                          mobile: 'string (required)',
                          email: 'string (required)',
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Example</h4>
                  <div className="bg-muted p-4 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">{`POST /api/phorest/clients

${JSON.stringify(
  {
    businessId: 'your-phorest-business-id',
    firstName: 'John',
    lastName: 'Doe',
    mobile: '0871234567',
    email: 'john.doe@example.com',
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
                        <span className="text-sm">Success</span>
                      </div>
                      <div className="bg-muted p-3 rounded-md overflow-x-auto">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(
                            {
                              success: true,
                              client: {
                                clientId: '12345',
                                firstName: 'John',
                                lastName: 'Doe',
                                mobile: '+353871234567',
                                email: 'john.doe@example.com',
                              },
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">400</Badge>
                        <span className="text-sm">Validation Error</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">404</Badge>
                        <span className="text-sm">Tenant not configured</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">409</Badge>
                        <span className="text-sm">Client already exists</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* GET /api/phorest/clients */}
        <Card>
          <Collapsible
            open={expandedEndpoints['get-client']}
            onOpenChange={() => toggleEndpoint('get-client')}
          >
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="default">GET</Badge>
                    <code className="text-sm">/api/phorest/clients</code>
                    <CopyButton text="endpoint URL" url="/api/phorest/clients" />
                  </CardTitle>
                  {expandedEndpoints['get-client'] ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <CardDescription className="text-left mt-2">
                  Retrieve an existing client by phone number
                </CardDescription>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    Retrieves an existing client from the Phorest salon management system using
                    their phone number. Returns 404 if no client found.
                  </p>
                  <p className="text-sm text-red-600 font-medium mt-2">
                    🔐 Authentication Required: X-API-Key header must be included
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Query Parameters</h4>
                  <div className="bg-muted p-4 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(
                        {
                          businessId: 'string (required)',
                          phone: 'string (required)',
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Example</h4>
                  <div className="bg-muted p-4 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">{`GET /api/phorest/clients?businessId=your-business-id&phone=353871234567`}</pre>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Responses</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-600 hover:bg-green-700">200</Badge>
                        <span className="text-sm">Success - Client Found</span>
                      </div>
                      <div className="bg-muted p-3 rounded-md overflow-x-auto">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(
                            {
                              success: true,
                              client: {
                                clientId: '12345',
                                firstName: 'John',
                                lastName: 'Doe',
                                mobile: '+353871234567',
                                email: 'john.doe@example.com',
                                createdAt: '2024-12-24T10:30:00Z',
                              },
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
                        <span className="text-sm">Client not found</span>
                      </div>
                      <div className="bg-muted p-3 rounded-md overflow-x-auto">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(
                            {
                              success: false,
                              error: 'Client not found',
                              message: 'No client found with the provided phone number',
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">400</Badge>
                        <span className="text-sm">Validation Error</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* GET /api/phorest/service-categories */}
        <Card>
          <Collapsible
            open={expandedEndpoints['service-categories']}
            onOpenChange={() => toggleEndpoint('service-categories')}
          >
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="default">GET</Badge>
                    <code className="text-sm">/api/phorest/service-categories</code>
                    <CopyButton text="endpoint URL" url="/api/phorest/service-categories" />
                  </CardTitle>
                  {expandedEndpoints['service-categories'] ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <CardDescription className="text-left mt-2">
                  Retrieve service categories for a business and branch
                </CardDescription>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    Retrieves the list of service categories available for a specific business and
                    branch in the Phorest salon management system. Use this to display available
                    service categories to clients.
                  </p>
                  <p className="text-sm text-red-600 font-medium mt-2">
                    🔐 Authentication Required: X-API-Key header must be included
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Query Parameters</h4>
                  <div className="bg-muted p-4 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(
                        {
                          businessId: 'string (required)',
                          branchId: 'string (required)',
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Example</h4>
                  <div className="bg-muted p-4 rounded-md overflow-x-auto">
                    <pre className="text-xs font-mono">{`GET /api/phorest/service-categories?businessId=your-business-id&branchId=your-branch-id`}</pre>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Responses</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-600 hover:bg-green-700">200</Badge>
                        <span className="text-sm">Success - Service Categories Retrieved</span>
                      </div>
                      <div className="bg-muted p-3 rounded-md overflow-x-auto">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(
                            {
                              success: true,
                              data: {
                                businessId: 'your-business-id',
                                branchId: 'your-branch-id',
                                categories: [
                                  {
                                    categoryId: 'cat-123',
                                    categoryName: 'Hair Services',
                                    description: 'All hair-related services',
                                    sortOrder: 1,
                                  },
                                  {
                                    categoryId: 'cat-456',
                                    categoryName: 'Nail Services',
                                    description: 'Manicure and pedicure services',
                                    sortOrder: 2,
                                  },
                                ],
                              },
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">400</Badge>
                        <span className="text-sm">
                          Validation Error - Missing required parameters
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">404</Badge>
                        <span className="text-sm">Business not configured</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive">401/403</Badge>
                        <span className="text-sm">Authentication failed</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* GET /api/phorest/health */}
        <Card>
          <Collapsible
            open={expandedEndpoints['health']}
            onOpenChange={() => toggleEndpoint('health')}
          >
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="default">GET</Badge>
                    <code className="text-sm">/api/phorest/health</code>
                    <CopyButton text="endpoint URL" url="/api/phorest/health" />
                  </CardTitle>
                  {expandedEndpoints['health'] ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <CardDescription className="text-left mt-2">
                  Check Phorest service health
                </CardDescription>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Returns the operational status of the Phorest integration service.
                </p>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* GET /api/phorest/config/check */}
        <Card>
          <Collapsible
            open={expandedEndpoints['config-check']}
            onOpenChange={() => toggleEndpoint('config-check')}
          >
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="default">GET</Badge>
                    <code className="text-sm">/api/phorest/config/check</code>
                    <CopyButton text="endpoint URL" url="/api/phorest/config/check" />
                  </CardTitle>
                  {expandedEndpoints['config-check'] ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <CardDescription className="text-left mt-2">
                  Check tenant Phorest configuration
                </CardDescription>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Diagnostic endpoint to check if a tenant has Phorest properly configured.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Query Parameters</h4>
                  <p className="text-sm text-muted-foreground font-mono">?tenantId=tenant_123</p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm mb-1">Automatic Credential Fetching</h4>
              <p className="text-sm text-muted-foreground">
                API credentials are automatically fetched from the database based on businessId. The
                tenant is automatically resolved from the business ID. You never pass credentials in
                API requests.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Database Tables</h4>
              <p className="text-sm text-muted-foreground">
                • <code className="text-xs bg-muted px-1 py-0.5 rounded">external_api_configs</code>{' '}
                - Encrypted API credentials
                <br />•{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">tenant_businesses</code> -
                Business ID and name mapping
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">Multi-Tenant Support</h4>
              <p className="text-sm text-muted-foreground">
                Each tenant has isolated Phorest configuration. Use businessId to specify which
                account to use. The system automatically resolves the tenant from the business ID.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
