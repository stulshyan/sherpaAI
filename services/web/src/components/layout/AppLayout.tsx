import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile navigation */}
      <MobileNav />

      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
