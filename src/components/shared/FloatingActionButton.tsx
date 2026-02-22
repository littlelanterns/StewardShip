import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './FloatingActionButton.css';

interface FloatingActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function FloatingActionButton({ children, className = '', ...props }: FloatingActionButtonProps) {
  return (
    <button className={`fab ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
