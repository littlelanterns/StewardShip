import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`spinner spinner--${size} ${className}`.trim()} role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  );
}
