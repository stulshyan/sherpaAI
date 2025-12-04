import clsx from 'clsx';

interface AIThinkingAnimationProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AIThinkingAnimation({ size = 'md', className }: AIThinkingAnimationProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  const gapClasses = {
    sm: 'gap-1',
    md: 'gap-1.5',
    lg: 'gap-2',
  };

  return (
    <div className={clsx('flex items-center justify-center', gapClasses[size], className)}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={clsx(
            'rounded-full bg-primary-500 dark:bg-primary-400',
            sizeClasses[size],
            'animate-bounce'
          )}
          style={{
            animationDelay: `${index * 150}ms`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );
}
