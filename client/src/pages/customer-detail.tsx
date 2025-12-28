import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Clock,
  MapPin,
  Activity,
  TrendingUp,
  User,
  Heart,
} from 'lucide-react';
import { useRoute, Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { SentimentBadge } from '@/components/sentiment-badge';

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
  externalServiceName: string | null;
  externalServiceClientId: string | null;
  createdAt: string;
  sentimentScore: number | null;
  sentimentCategory: string | null;
  sentimentTrend: string | null;
  sentimentUpdatedAt: string | null;
}

interface Booking {
  id: string;
  serviceName: string;
  amount: number;
  currency: string;
  bookingDateTime: string;
  status: string;
  bookingSource: string;
  paymentStatus: string;
}

interface BookingStats {
  totalBookings: number;
  totalSpent: number;
  averageSpent: number;
  lastBookingDate: string | null;
  favoriteServices: { serviceName: string; count: number }[];
}

interface ClientDetail extends Client {
  bookings: Booking[];
  stats: BookingStats;
}

export default function CustomerDetailPage() {
  const { user } = useAuth();
  const [, params] = useRoute('/customers/:tenantId/:id');
  const clientId = params?.id;
  const tenantId = params?.tenantId;

  // Fetch client details
  const {
    data: clientDetail,
    isLoading,
    error,
  } = useQuery<ClientDetail>({
    queryKey: [`/api/platform/tenants/${tenantId}/clients/${clientId}`],
    enabled: !!tenantId && !!clientId,
  });

  if (!clientId || !tenantId) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Invalid request - missing client or tenant ID</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loading client details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">
              Error loading client: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clientDetail) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Client not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'inactive':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'blocked':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getBookingStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'confirmed':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'pending':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'no_show':
      case 'no-show':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'deposit_paid':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'awaiting_deposit':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'refunded':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'no_payment':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const formatStatusText = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl">
      {/* Back Button */}
      <Link href="/customers">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
      </Link>

      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl font-semibold text-primary">
              {clientDetail.firstName.charAt(0)}
              {clientDetail.lastName.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {clientDetail.firstName} {clientDetail.lastName}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={getStatusColor(clientDetail.status)}>{clientDetail.status}</Badge>
              <Badge variant="outline" className="capitalize">
                via {clientDetail.firstInteractionSource}
              </Badge>
              <SentimentBadge
                score={clientDetail.sentimentScore}
                category={clientDetail.sentimentCategory}
                trend={clientDetail.sentimentTrend}
                showScore={true}
                showTrend={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{clientDetail.phone}</p>
              </div>
            </div>
            {clientDetail.email && (
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{clientDetail.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">First Contact</p>
                <p className="font-medium">
                  {new Date(clientDetail.firstInteractionDate).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(clientDetail.firstInteractionDate), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            {clientDetail.lastBookingDate && (
              <div className="flex items-center space-x-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Last Booking</p>
                  <p className="font-medium">
                    {new Date(clientDetail.lastBookingDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(clientDetail.lastBookingDate), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Health</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clientDetail.sentimentScore !== null ? clientDetail.sentimentScore : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              {clientDetail.sentimentCategory || 'Not calculated'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientDetail.stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime appointments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{clientDetail.stats.totalSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{clientDetail.stats.averageSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Per booking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Service</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {clientDetail.stats.favoriteServices[0]?.serviceName || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {clientDetail.stats.favoriteServices[0]?.count || 0} times
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Favorite Services */}
      {clientDetail.stats.favoriteServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Favorite Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {clientDetail.stats.favoriteServices.map((service, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">{index + 1}</span>
                    </div>
                    <span className="font-medium">{service.serviceName}</span>
                  </div>
                  <Badge variant="secondary">{service.count} bookings</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* External Service Provider Info */}
      {clientDetail.externalServiceName && clientDetail.externalServiceClientId && (
        <Card>
          <CardHeader>
            <CardTitle>Service Provider Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium capitalize">
                    {clientDetail.externalServiceName.replace('_', ' ')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Client ID: {clientDetail.externalServiceClientId}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Booking History */}
      <Card>
        <CardHeader>
          <CardTitle>Booking History</CardTitle>
        </CardHeader>
        <CardContent>
          {clientDetail.bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No bookings yet</div>
          ) : (
            <div className="space-y-4">
              {clientDetail.bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{booking.serviceName}</h4>
                      <Badge className={getBookingStatusColor(booking.status)}>
                        {formatStatusText(booking.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(booking.bookingDateTime).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(booking.bookingDateTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="capitalize text-xs">
                        via {booking.bookingSource}
                      </Badge>
                      <Badge className={`text-xs ${getPaymentStatusColor(booking.paymentStatus)}`}>
                        {formatStatusText(booking.paymentStatus)}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold">
                      {booking.currency === 'EUR' ? '€' : booking.currency}
                      {booking.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
