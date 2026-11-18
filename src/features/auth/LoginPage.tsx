// Sign-in screen, shown in place of every page until the user is signed in.
import { useState, type FormEvent } from 'react';
import { LoginSchema } from '../../../shared/auth';
import { Field } from '../../components/Field';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../store/contexts';

type LoginField = 'username' | 'password';
type LoginErrors = Partial<Record<LoginField, string>>;

function validate(username: string, password: string): LoginErrors {
  const result = LoginSchema.safeParse({ username, password });
  if (result.success) return {};
  const errors: LoginErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if ((field === 'username' || field === 'password') && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(username, password);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setIsSubmitting(true);
    try {
      await login({ username, password });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setIsSubmitting(false);
    }
  };

  const describedBy = (field: LoginField) => (errors[field] ? `login-${field}-error` : undefined);

  return (
    <div className="login-screen">
      <form className="login-card form" onSubmit={submit} noValidate aria-labelledby="login-title">
        <div className="brand login-brand" aria-hidden="true">
          <span className="brand-mark">blox</span>
          <span className="brand-divider" />
          <span className="brand-product">MARKETPLACE</span>
        </div>
        <h1 id="login-title">Sign in</h1>
        <p className="muted">
          Sign in to browse the marketplace. Administrators can also edit components and releases.
        </p>
        {formError && (
          <div className="form-alert" role="alert">
            {formError}
          </div>
        )}
        <Field id="login-username" label="Username" error={errors.username}>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            aria-invalid={Boolean(errors.username)}
            aria-describedby={describedBy('username')}
          />
        </Field>
        <Field id="login-password" label="Password" error={errors.password}>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={describedBy('password')}
          />
        </Field>
        <button className="btn btn-primary block" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
