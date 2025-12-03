import clsx from 'clsx';
import {
  LayoutDashboard,
  Upload,
  List,
  Settings,
  FlaskConical,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/intake', icon: Upload, label: 'Intake Hub' },
  { to: '/backlog', icon: List, label: 'Backlog' },
  { to: '/test-harness', icon: FlaskConical, label: 'Test Harness' },
  { to: '/health', icon: Activity, label: 'System Health' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'flex h-full w-64 flex-col border-r',
        'border-gray-200 bg-white',
        'dark:border-gray-700 dark:bg-gray-900',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6 dark:border-gray-700">
        <div>
          <h1 className="text-primary-600 dark:text-primary-400 text-xl font-bold">Entropy</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  )
                }
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          v{import.meta.env.VITE_APP_VERSION || '0.1.0'}
        </p>
      </div>
    </aside>
  );
}
