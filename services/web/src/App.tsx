import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Backlog from './pages/Backlog';
import Dashboard from './pages/Dashboard';
import IntakeHub from './pages/IntakeHub';
import Settings from './pages/Settings';
import TestHarness from './pages/TestHarness';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="intake" element={<IntakeHub />} />
        <Route path="backlog" element={<Backlog />} />
        <Route path="test-harness" element={<TestHarness />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
