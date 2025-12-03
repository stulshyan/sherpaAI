import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Menu, Moon, Sun, LogOut, User, ChevronDown, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, type DropdownItem } from '@/components/ui';
import { api } from '@/lib/api/client';
import { useAuthStore, useUIStore } from '@/stores';
import type { Project } from '@/types';

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    darkMode,
    toggleDarkMode,
    toggleSidebar,
    currentProject,
    setCurrentProject,
    setProjects,
  } = useUIStore();

  // Fetch projects
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data;
    },
  });

  // Set projects in store when fetched
  useEffect(() => {
    if (projects) {
      setProjects(projects);
      // Set first active project as current if none selected
      if (!currentProject) {
        const activeProject = projects.find((p) => p.status === 'active');
        if (activeProject) {
          setCurrentProject(activeProject);
        }
      }
    }
  }, [projects, currentProject, setProjects, setCurrentProject]);

  const userMenuItems: DropdownItem[] = [
    {
      label: 'Profile',
      icon: <User className="h-4 w-4" />,
      onClick: () => navigate('/settings'),
    },
    {
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => navigate('/settings'),
    },
    {
      label: 'Logout',
      icon: <LogOut className="h-4 w-4" />,
      onClick: () => {
        logout();
        navigate('/login');
      },
      danger: true,
    },
  ];

  const projectItems: DropdownItem[] =
    projects
      ?.filter((p) => p.status === 'active')
      .map((project) => ({
        label: project.name,
        onClick: () => setCurrentProject(project),
      })) || [];

  return (
    <header
      className={clsx(
        'flex h-16 items-center justify-between border-b px-4',
        'border-gray-200 bg-white',
        'dark:border-gray-700 dark:bg-gray-900'
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className={clsx(
            'rounded-lg p-2 md:hidden',
            'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
            'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
          )}
          aria-label="Toggle menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Logo - visible on mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="text-primary-600 dark:text-primary-400 text-xl font-bold">Entropy</span>
        </div>

        {/* Project selector */}
        <div className="hidden md:block">
          {projectItems.length > 0 && (
            <Dropdown
              align="left"
              trigger={
                <button
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                    'text-gray-700 hover:bg-gray-100',
                    'dark:text-gray-300 dark:hover:bg-gray-800'
                  )}
                >
                  <span>{currentProject?.name || 'Select Project'}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              }
              items={projectItems}
            />
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className={clsx(
            'rounded-lg p-2',
            'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
            'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
          )}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* User menu */}
        <Dropdown
          trigger={
            <button
              className={clsx(
                'flex items-center gap-2 rounded-lg p-1.5',
                'hover:bg-gray-100',
                'dark:hover:bg-gray-800'
              )}
            >
              <Avatar name={user?.username || user?.email} size="sm" />
              <ChevronDown className="hidden h-4 w-4 text-gray-500 sm:block dark:text-gray-400" />
            </button>
          }
          items={userMenuItems}
        />
      </div>
    </header>
  );
}
