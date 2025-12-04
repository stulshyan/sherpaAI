import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { ProtectedRoute } from '@/features/auth';
import Backlog from '@/pages/Backlog';
import Dashboard from '@/pages/Dashboard';
import HealthDashboard from '@/pages/HealthDashboard';
import IntakeHub from '@/pages/IntakeHub';
import Login from '@/pages/Login';
import Settings from '@/pages/Settings';
import TestHarness from '@/pages/TestHarness';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="intake" element={<IntakeHub />} />
        <Route path="backlog" element={<Backlog />} />
        <Route path="test-harness" element={<TestHarness />} />
        <Route path="health" element={<HealthDashboard />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
