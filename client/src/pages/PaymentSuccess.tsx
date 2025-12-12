import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PaymentSuccess() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  useEffect(() => {
    // Optional: Fetch payment details from your backend if needed
    // For now, just show success message
    setLoading(false);
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Thank you for your payment. Your booking is now confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionId && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Transaction ID</p>
              <p className="text-xs font-mono break-all">{sessionId}</p>
            </div>
          )}

          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">✅ Your booking has been confirmed</p>
            <p className="text-sm text-muted-foreground">
              📧 You will receive a confirmation SMS shortly
            </p>
            <p className="text-sm text-muted-foreground">
              💬 Please check your WhatsApp/SMS for booking details
            </p>
          </div>

          <div className="pt-4">
            <p className="text-sm text-center text-muted-foreground">
              You can safely close this page now
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
