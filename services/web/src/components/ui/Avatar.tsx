import clsx from 'clsx';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name: string): string {
  // Generate a consistent color based on the name
  const colors = [
    'bg-primary-500',
    'bg-success-500',
    'bg-warning-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-teal-500',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, alt, name, size = 'md', className }: AvatarProps) {
  const sizeStyles = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  const displayName = name || alt || 'User';

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        className={clsx(
          'rounded-full object-cover ring-2 ring-white dark:ring-gray-800',
          sizeStyles[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-full font-medium text-white',
        sizeStyles[size],
        getColorFromName(displayName),
        className
      )}
      title={displayName}
    >
      {getInitials(displayName)}
    </div>
  );
}
