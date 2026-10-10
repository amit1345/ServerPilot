import { useEffect, useState, type FormEvent } from 'react';
import { Button, ErrorState, Field, InlineError, PageHeader, Panel, Skeleton } from '../components/ui';
import { Icon } from '../components/icons';
import { useI18n } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { supabase } from '../lib/supabase';
import { useApi, useSession } from '../context/SessionContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { errorMessage } from '../data/api';
import type { Locale } from '../lib/types';

export function Account() {
  const { t, setLocale } = useI18n();
  const api = useApi();
  const { signOut } = useSession();
  const { workspaces } = useWorkspace();
  const isDemo = api.mode === 'demo';
  const { data, loading, error, reload } = useAsync(() => api.getProfile(), [api]);

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (data) setName(data.displayName); }, [data]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try { await api.updateProfile({ displayName: name }); setMsg({ ok: true, text: t('common.saved') }); }
    catch (err) { setMsg({ ok: false, text: errorMessage(err) }); }
    finally { setBusy(false); }
  }

  async function changeLocale(l: Locale) {
    setLocale(l);
    if (!isDemo) await api.updateProfile({ locale: l }).catch(() => { /* preference still applied locally */ });
  }

  const owned = workspaces.filter((w) => w.role === 'owner').length;

  return (
    <>
      <PageHeader title={t('acc.title')} />
      <div className="settings-grid">
        <div className="stack">
          <Panel title={t('acc.profile')}>
            {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Skeleton rows={3} /> : (
              <form className="form" onSubmit={saveProfile}>
                <fieldset disabled={isDemo || busy}>
                  <Field label={t('auth.email')}>
                    {(id) => <input id={id} dir="ltr" value={data.email} readOnly />}
                  </Field>
                  <Field label={t('auth.displayName')}>
                    {(id) => <input id={id} dir="auto" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
                  </Field>
                  {msg && (msg.ok
                    ? <p className="success" role="status"><Icon name="check" size={16} />{msg.text}</p>
                    : <InlineError message={msg.text} />)}
                  {isDemo ? <p className="muted small">{t('acc.demoDisabled')}</p> : (
                    <div className="form-actions"><Button type="submit" loading={busy}>{t('common.save')}</Button></div>
                  )}
                </fieldset>
              </form>
            )}
          </Panel>

          <Panel title={t('common.language')}>
            <LocaleSwitch onChange={changeLocale} />
          </Panel>

          {!isDemo && <ChangePassword />}
        </div>

        <div className="stack">
          <Panel title={t('acc.plan')}>
            <div className="plan">
              <span className="plan-name">{t('acc.planFree')}</span>
              <span className="plan-usage"><bdi>{owned} / 5</bdi></span>
            </div>
            <span className="meter" aria-hidden="true"><i style={{ inlineSize: `${Math.min(owned / 5, 1) * 100}%` }} /></span>
            <p className="muted small">{t('acc.planDesc')}</p>
          </Panel>
          <Panel>
            <Button variant="ghost" icon="logout" onClick={() => void signOut()} className="block">
              {isDemo ? t('common.exitDemo') : t('common.signOut')}
            </Button>
          </Panel>
        </div>
      </div>
    </>
  );
}

function LocaleSwitch({ onChange }: { onChange: (l: Locale) => void }) {
  const { locale } = useI18n();
  return (
    <div className="segmented" role="radiogroup">
      {(['he', 'en'] as Locale[]).map((l) => (
        <button key={l} role="radio" aria-checked={locale === l} className={locale === l ? 'on' : ''} onClick={() => onChange(l)}>
          {l === 'he' ? 'עברית' : 'English'}
        </button>
      ))}
    </div>
  );
}

function ChangePassword() {
  const { t } = useI18n();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    setPw('');
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: t('acc.passwordUpdated') });
  }

  return (
    <Panel title={t('acc.password')}>
      <form className="form" onSubmit={submit}>
        <Field label={t('acc.newPassword')} hint={t('auth.passwordHint')}>
          {(id) => <input id={id} type="password" dir="ltr" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />}
        </Field>
        {msg && (msg.ok ? <p className="success" role="status"><Icon name="check" size={16} />{msg.text}</p> : <InlineError message={msg.text} />)}
        <div className="form-actions"><Button type="submit" variant="ghost" loading={busy}>{t('common.save')}</Button></div>
      </form>
    </Panel>
  );
}
