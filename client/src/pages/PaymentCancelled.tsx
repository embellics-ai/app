import { XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PaymentCancelled() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          <CardDescription>Your payment was cancelled and no charges were made.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
            <p className="text-sm text-yellow-800 font-medium mb-2">
              ⚠️ Your booking is still reserved
            </p>
            <p className="text-sm text-yellow-700">
              You can complete the payment later using the link sent to your email/SMS/WhatsApp.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">What happens next?</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Your booking remains reserved</li>
              <li>��� Payment link is valid for 24 hours</li>
              <li>✓ You can try again using the same link</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Need help?</h3>
            <p className="text-sm text-muted-foreground">
              If you're experiencing issues with payment, please contact us directly.
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
