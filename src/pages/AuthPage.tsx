import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Field, InlineError } from '../components/ui';
import { Logo } from '../components/Logo';
import { LanguageToggle } from '../components/Shell';
import { Icon } from '../components/icons';
import { useI18n } from '../lib/i18n';
import { isSupabaseConfigured } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import { errorMessage } from '../data/api';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useI18n();
  const { signIn, signUp, enterDemo } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isRegister = mode === 'register';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (isRegister) {
        const needsConfirm = await signUp(email, password, name);
        if (needsConfirm) setNotice(t('auth.checkEmail'));
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-lang"><LanguageToggle /></div>
      <div className="auth-card panel">
        <div className="auth-brand">
          <Logo size={44} />
          <div>
            <h1>{t('appName')}</h1>
            <p className="muted">{t('tagline')}</p>
          </div>
        </div>

        <h2>{isRegister ? t('auth.signUp') : t('auth.signIn')}</h2>

        {!isSupabaseConfigured && (
          <p className="notice"><Icon name="plug" size={16} />{t('auth.notConfigured')}</p>
        )}

        <form onSubmit={submit} className="form" noValidate={false}>
          <fieldset disabled={!isSupabaseConfigured || busy}>
            {isRegister && (
              <Field label={t('auth.displayName')}>
                {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoComplete="nickname" />}
              </Field>
            )}
            <Field label={t('auth.email')}>
              {(id) => <input id={id} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />}
            </Field>
            <Field label={t('auth.password')} hint={isRegister ? t('auth.passwordHint') : undefined}>
              {(id) => (
                <input id={id} type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={isRegister ? 8 : undefined} autoComplete={isRegister ? 'new-password' : 'current-password'} />
              )}
            </Field>
            <InlineError message={error} />
            {notice && <p className="success" role="status"><Icon name="check" size={16} />{notice}</p>}
            <Button type="submit" loading={busy} className="block">
              {isRegister ? t('auth.signUp') : t('auth.signIn')}
            </Button>
          </fieldset>
        </form>

        <p className="auth-switch muted">
          {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? t('auth.signIn') : t('auth.signUp')}</Link>
        </p>

        <div className="divider"><span>{t('auth.or')}</span></div>

        <Button variant="ghost" className="block" onClick={enterDemo}>{t('auth.tryDemo')}</Button>
        <p className="muted small center">{t('auth.demoNote')}</p>
      </div>
    </div>
  );
}
