import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({ trigger, items, align = 'right', className }: DropdownProps) {
  return (
    <Menu as="div" className={clsx('relative inline-block text-left', className)}>
      <MenuButton as={Fragment}>{trigger}</MenuButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems
          className={clsx(
            'absolute z-50 mt-2 w-56 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
            'dark:bg-gray-800 dark:ring-gray-700',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, index) => (
            <MenuItem key={index} disabled={item.disabled}>
              {({ focus }) => (
                <button
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={clsx(
                    'flex w-full items-center gap-2 px-4 py-2 text-sm',
                    focus && 'bg-gray-100 dark:bg-gray-700',
                    item.danger
                      ? 'text-danger-600 dark:text-danger-400'
                      : 'text-gray-700 dark:text-gray-300',
                    item.disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  {item.icon && <span className="h-4 w-4">{item.icon}</span>}
                  {item.label}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  );
}

// Simple select dropdown
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectDropdownProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  className,
}: SelectDropdownProps) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Menu as="div" className={clsx('relative inline-block text-left', className)}>
      <MenuButton
        className={clsx(
          'inline-flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
          'focus:ring-primary-500 hover:bg-gray-50 focus:outline-none focus:ring-2',
          'dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
        )}
      >
        <span className={clsx(!selectedOption && 'text-gray-400')}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </MenuButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems
          className={clsx(
            'absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
            'dark:bg-gray-800 dark:ring-gray-700'
          )}
        >
          {options.map((option) => (
            <MenuItem key={option.value}>
              {({ focus }) => (
                <button
                  onClick={() => onChange(option.value)}
                  className={clsx(
                    'flex w-full items-center px-4 py-2 text-sm',
                    focus && 'bg-gray-100 dark:bg-gray-700',
                    option.value === value
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300'
                  )}
                >
                  {option.label}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  );
}
