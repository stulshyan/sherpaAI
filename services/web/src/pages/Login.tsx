import { Navigate } from 'react-router-dom';
import { LoginForm } from '@/features/auth';
import { useAuthStore } from '@/stores';

export default function LoginPage() {
  const { isAuthenticated } = useAuthStore();

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <LoginForm />
    </div>
  );
}
