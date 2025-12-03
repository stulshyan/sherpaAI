import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { X } from 'lucide-react';
import { Fragment } from 'react';
import { useUIStore } from '@/stores';
import { Sidebar } from './Sidebar';

export function MobileNav() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <Transition show={sidebarOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50 md:hidden" onClose={setSidebarOpen}>
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/80" />
        </TransitionChild>

        <div className="fixed inset-0 flex">
          {/* Sidebar panel */}
          <TransitionChild
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1">
              {/* Close button */}
              <TransitionChild
                as={Fragment}
                enter="ease-in-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                  <button
                    type="button"
                    className="-m-2.5 p-2.5"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="sr-only">Close sidebar</span>
                    <X className="h-6 w-6 text-white" aria-hidden="true" />
                  </button>
                </div>
              </TransitionChild>

              {/* Sidebar content */}
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
