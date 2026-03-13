import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import './Card.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ children, className = '', ...props }, ref) {
  return (
    <div ref={ref} className={`card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
});
