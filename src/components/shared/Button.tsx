import { type ButtonHTMLAttributes } from 'react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text';
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  size,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const sizeClass = size ? `btn--${size}` : '';
  return (
    <button
      className={`btn btn--${variant} ${fullWidth ? 'btn--full' : ''} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
