import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@/types';

interface UIState {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Dark mode
  darkMode: boolean;

  // Project context
  currentProject: Project | null;
  projects: Project[];

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,
      darkMode: false,
      currentProject: null,
      projects: [],

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleDarkMode: () =>
        set((state) => {
          const newDarkMode = !state.darkMode;
          // Update document class for Tailwind dark mode
          if (newDarkMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          return { darkMode: newDarkMode };
        }),
      setDarkMode: (dark) => {
        if (dark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        set({ darkMode: dark });
      },
      setCurrentProject: (project) => set({ currentProject: project }),
      setProjects: (projects) => set({ projects }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        darkMode: state.darkMode,
        sidebarCollapsed: state.sidebarCollapsed,
        currentProject: state.currentProject,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply dark mode on rehydration
        if (state?.darkMode) {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);
