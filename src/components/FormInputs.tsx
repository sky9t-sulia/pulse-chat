import { forwardRef } from 'react';

const base = 'w-full theme-input border theme-border-light focus:outline-none px-3 py-2';

export const ThemedInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'rounded'> & { rounded?: 'sm' | 'md' | 'lg' | 'xl' }
>(({ className = '', rounded = 'md', ...props }, ref) => {
  const radius = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-lg', xl: 'rounded-xl' }[rounded];
  return (
    <input
      ref={ref}
      className={`${base} ${radius} text-sm theme-text-primary ${className}`}
      {...props}
    />
  );
});

export const ThemedTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { rounded?: 'sm' | 'md' }
>(({ className = '', rounded = 'md', ...props }, ref) => {
  const radius = { sm: 'rounded', md: 'rounded-lg' }[rounded];
  return (
    <textarea
      ref={ref}
      className={`${base} ${radius} text-sm theme-text-primary ${className}`}
      {...props}
    />
  );
});

export const ThemedSelect = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { rounded?: 'sm' | 'md' }
>(({ className = '', rounded = 'md', ...props }, ref) => {
  const radius = { sm: 'rounded', md: 'rounded-lg' }[rounded];
  return (
    <select
      ref={ref}
      className={`${base} ${radius} text-sm theme-text-primary ${className}`}
      {...props}
    />
  );
});

ThemedInput.displayName = 'ThemedInput';
ThemedTextarea.displayName = 'ThemedTextarea';
ThemedSelect.displayName = 'ThemedSelect';
