import { type InputHTMLAttributes, forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, id, className = '', type, showPasswordToggle, ...props }, ref) {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const [passwordVisible, setPasswordVisible] = useState(false);

    const isPassword = type === 'password';
    const effectiveType = isPassword && passwordVisible ? 'text' : type;

    return (
      <div className={`input-group ${error ? 'input-group--error' : ''} ${className}`.trim()}>
        {label && (
          <label htmlFor={inputId} className="input-group__label">
            {label}
          </label>
        )}
        <div className={`input-group__wrapper ${isPassword && showPasswordToggle !== false ? 'input-group__wrapper--has-toggle' : ''}`}>
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            className="input-group__input"
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          {isPassword && showPasswordToggle !== false && (
            <button
              type="button"
              className="input-group__password-toggle"
              onClick={() => setPasswordVisible((v) => !v)}
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {error && (
          <p id={inputId ? `${inputId}-error` : undefined} className="input-group__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
