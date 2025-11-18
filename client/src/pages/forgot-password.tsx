import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm) => {
      const response = await apiRequest('POST', '/api/auth/forgot-password', data);
      return await response.json();
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setErrorMessage(null);
      form.reset();
    },
    onError: (error: any) => {
      setErrorMessage('Failed to process request. Please try again.');
      setSuccessMessage(null);
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    forgotPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">Embellics</CardTitle>
          </div>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email address to reset the password. If our system shows your email address
            with an active account, we will send you a reset password link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage ? (
            <Alert className="bg-green-50 border-green-200" data-testid="alert-success">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@company.com"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={forgotPasswordMutation.isPending}
                  data-testid="button-submit"
                >
                  {forgotPasswordMutation.isPending ? 'Sending...' : 'Send reset link'}
                </Button>

                {errorMessage && (
                  <Alert variant="destructive" data-testid="alert-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}
              </form>
            </Form>
          )}

          <div className="text-center">
            <Link href="/login" data-testid="link-back-to-login">
              <span className="text-sm text-primary hover:underline cursor-pointer">
                Back to login
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
