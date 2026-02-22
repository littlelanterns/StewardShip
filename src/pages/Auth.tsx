import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { Button, Input, Card } from '../components/shared';
import { LoadingSpinner } from '../components/shared';
import './Auth.css';

type AuthView = 'welcome' | 'signup' | 'signin' | 'forgot';

export default function Auth() {
  const { user, loading } = useAuthContext();
  const [view, setView] = useState<AuthView>('welcome');

  // Redirect authenticated users to home
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-page">
      <div className="auth-page__container">
        {view === 'welcome' && <WelcomeView onNavigate={setView} />}
        {view === 'signup' && <SignUpView onNavigate={setView} />}
        {view === 'signin' && <SignInView onNavigate={setView} />}
        {view === 'forgot' && <ForgotPasswordView onNavigate={setView} />}
      </div>
    </div>
  );
}

/* ─── Welcome / Landing ─── */

function WelcomeView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  return (
    <div className="auth-welcome">
      <h1 className="auth-welcome__title">StewardShip</h1>
      <p className="auth-welcome__tagline">
        Navigate your growth with purpose.
      </p>
      <div className="auth-welcome__actions">
        <Button fullWidth onClick={() => onNavigate('signup')}>
          Create Account
        </Button>
        <Button fullWidth variant="secondary" onClick={() => onNavigate('signin')}>
          Sign In
        </Button>
      </div>
    </div>
  );
}

/* ─── Sign Up ─── */

function SignUpView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const { signUp } = useAuthContext();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!displayName.trim()) next.displayName = 'Display name is required.';
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Please enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    else if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const { error } = await signUp(email, password, displayName.trim());
    setSubmitting(false);

    if (error) {
      setErrors({ form: error });
    }
  }

  return (
    <Card>
      <h2 className="auth-form__heading">Create Your Account</h2>
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <Input
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={errors.displayName}
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />
        <p className="auth-form__hint">Minimum 8 characters</p>
        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />
        {errors.form && <p className="auth-form__error" role="alert">{errors.form}</p>}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? <LoadingSpinner size="sm" /> : 'Create Account'}
        </Button>
      </form>
      <p className="auth-form__footer">
        Already have an account?{' '}
        <Button variant="text" onClick={() => onNavigate('signin')}>
          Sign In
        </Button>
      </p>
    </Card>
  );
}

/* ─── Sign In ─── */

function SignInView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const { signIn } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!email.trim()) next.email = 'Email is required.';
    if (!password) next.password = 'Password is required.';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);

    if (error) {
      setErrors({ form: error });
    }
  }

  return (
    <Card>
      <h2 className="auth-form__heading">Welcome Back</h2>
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />
        {errors.form && <p className="auth-form__error" role="alert">{errors.form}</p>}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? <LoadingSpinner size="sm" /> : 'Sign In'}
        </Button>
      </form>
      <div className="auth-form__footer">
        <Button variant="text" onClick={() => onNavigate('forgot')}>
          Forgot Password?
        </Button>
        <p>
          Need an account?{' '}
          <Button variant="text" onClick={() => onNavigate('signup')}>
            Create Account
          </Button>
        </p>
      </div>
    </Card>
  );
}

/* ─── Forgot Password ─── */

function ForgotPasswordView({ onNavigate }: { onNavigate: (v: AuthView) => void }) {
  const { resetPassword } = useAuthContext();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setErrors({ email: 'Email is required.' });
      return;
    }

    setSubmitting(true);
    await resetPassword(email);
    setSubmitting(false);
    setSent(true);
  }

  return (
    <Card>
      <h2 className="auth-form__heading">Reset Your Password</h2>
      {sent ? (
        <div className="auth-form">
          <p className="auth-form__success">
            If an account exists with this email, you'll receive a reset link.
          </p>
          <Button fullWidth variant="secondary" onClick={() => onNavigate('signin')}>
            Back to Sign In
          </Button>
        </div>
      ) : (
        <>
          <p className="auth-form__description">
            Enter your email and we'll send you a reset link.
          </p>
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? <LoadingSpinner size="sm" /> : 'Send Reset Link'}
            </Button>
          </form>
          <p className="auth-form__footer">
            <Button variant="text" onClick={() => onNavigate('signin')}>
              Back to Sign In
            </Button>
          </p>
        </>
      )}
    </Card>
  );
}
