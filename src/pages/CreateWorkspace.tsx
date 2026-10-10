import { useState, type FormEvent } from 'react';
import { Button, Field, InlineError, Modal } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useApi } from '../context/SessionContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { errorMessage } from '../data/api';

function useCreateWorkspace(onDone?: () => void) {
  const api = useApi();
  const { refresh } = useWorkspace();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const id = await api.createWorkspace(name);
      await refresh(id);
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return { name, setName, busy, error, submit };
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  return (
    <Field label={t('ws.name')}>
      {(id) => (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('ws.namePlaceholder')}
          minLength={2} maxLength={60} required autoFocus />
      )}
    </Field>
  );
}

/** Full-page onboarding when the user has no workspaces yet. */
export function CreateWorkspacePage() {
  const { t } = useI18n();
  const f = useCreateWorkspace();
  return (
    <div className="auth-page">
      <form className="auth-card panel form" onSubmit={f.submit}>
        <h1>{t('ws.createTitle')}</h1>
        <p className="muted">{t('ws.createHint')}</p>
        <NameField value={f.name} onChange={f.setName} />
        <InlineError message={f.error} />
        <Button type="submit" icon="plus" loading={f.busy} className="block">{t('common.create')}</Button>
      </form>
    </div>
  );
}

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const f = useCreateWorkspace(onClose);
  return (
    <Modal title={t('ws.create')} onClose={onClose}>
      <form className="form" onSubmit={f.submit}>
        <p className="muted">{t('ws.createHint')}</p>
        <NameField value={f.name} onChange={f.setName} />
        <InlineError message={f.error} />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" icon="plus" loading={f.busy}>{t('common.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}
