import clsx from 'clsx';
import { LayoutDashboard, Upload, List, Settings } from 'lucide-react';
import { Outlet, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/intake', icon: Upload, label: 'Intake Hub' },
  { to: '/backlog', icon: List, label: 'Backlog' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-xl font-bold text-entropy-600">Entropy</h1>
          <p className="text-sm text-gray-500">Platform</p>
        </div>

        <nav className="px-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors',
                  isActive
                    ? 'bg-entropy-50 text-entropy-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
