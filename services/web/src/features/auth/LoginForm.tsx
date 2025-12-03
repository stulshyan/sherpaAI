import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores';
import type { AxiosError } from 'axios';

interface LoginFormData {
  username: string;
  password: string;
}

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data.username, data.password);
      // Redirect to the page they tried to visit or dashboard
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo and title */}
      <div className="mb-8 text-center">
        <h1 className="text-primary-600 dark:text-primary-400 text-3xl font-bold">Entropy</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Sign in to your account to continue</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-400 mb-6 flex items-center gap-2 rounded-lg border p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Login form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Email"
          type="email"
          placeholder="demo@entropy.app"
          leftIcon={<Mail className="h-5 w-5" />}
          error={errors.username?.message}
          {...register('username', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          leftIcon={<Lock className="h-5 w-5" />}
          error={errors.password?.message}
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 4,
              message: 'Password must be at least 4 characters',
            },
          })}
        />

        <Button type="submit" className="w-full" loading={isLoading}>
          Sign In
        </Button>
      </form>

      {/* Demo credentials hint */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Demo Credentials</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
          Email: <code className="text-gray-700 dark:text-gray-300">demo@entropy.app</code>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Password: <code className="text-gray-700 dark:text-gray-300">demo123</code>
        </p>
      </div>
    </div>
  );
}
