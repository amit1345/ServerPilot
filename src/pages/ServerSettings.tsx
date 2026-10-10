import { useEffect, useState, type FormEvent } from 'react';
import { Button, ErrorState, Field, InlineError, PageHeader, Panel, Skeleton } from '../components/ui';
import { Icon } from '../components/icons';
import { useI18n } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { can } from '../lib/permissions';
import { useApi } from '../context/SessionContext';
import { useCurrentWorkspace, useWorkspace } from '../context/WorkspaceContext';
import { errorMessage } from '../data/api';
import type { ServerSettings as Settings } from '../lib/types';

type Form = Omit<Settings, 'updatedAt'>;
const HOST_RE = /^(?=.{0,255}$)([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$|^$/;
const CFX_RE = /^[a-z0-9]{0,12}$/;

export function ServerSettings() {
  const { t, formatDate } = useI18n();
  const api = useApi();
  const ws = useCurrentWorkspace();
  const editable = can.editSettings(ws.role);
  const { data, loading, error, reload } = useAsync(() => api.getServerSettings(ws.id), [api, ws.id]);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) { const { updatedAt: _u, ...rest } = data; setForm(rest); }
  }, [data]);

  const errors = form && {
    host: HOST_RE.test(form.host.trim()) ? null : t('srv.invalidHost'),
    port: form.port >= 1 && form.port <= 65535 ? null : t('srv.invalidPort'),
    cfx: CFX_RE.test(form.cfxCode.trim()) ? null : t('srv.invalidCfx'),
  };
  const invalid = !!errors && Object.values(errors).some(Boolean);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form || invalid) return;
    setBusy(true); setSaveError(null); setSaved(false);
    try { await api.saveServerSettings(ws.id, form); setSaved(true); await reload(); }
    catch (err) { setSaveError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm((f) => f && { ...f, [k]: v }); setSaved(false); };

  return (
    <>
      <PageHeader title={t('srv.title')} />
      {!editable && <p className="notice"><Icon name="shield" size={16} />{t('common.readOnly')}</p>}

      <div className="settings-grid">
        <Panel title={t('srv.connection')}>
          <p className="muted small">{t('srv.connectionHint')}</p>
          {error ? <ErrorState message={error} onRetry={reload} /> : !form ? <Skeleton rows={5} /> : (
            <form className="form" onSubmit={save}>
              <fieldset disabled={!editable || busy}>
                <Field label={t('srv.serverName')}>
                  {(id) => <input id={id} dir="auto" value={form.serverName} maxLength={80} onChange={(e) => set('serverName', e.target.value)} />}
                </Field>
                <div className="form-grid">
                  <Field label={t('srv.host')} error={errors?.host}>
                    {(id) => <input id={id} dir="ltr" value={form.host} placeholder="play.example.com" onChange={(e) => set('host', e.target.value)} />}
                  </Field>
                  <Field label={t('srv.port')} error={errors?.port}>
                    {(id) => <input id={id} dir="ltr" type="number" min={1} max={65535} value={form.port} onChange={(e) => set('port', Number(e.target.value))} />}
                  </Field>
                  <Field label={t('srv.cfx')} error={errors?.cfx}>
                    {(id) => <input id={id} dir="ltr" value={form.cfxCode} placeholder="abc123" onChange={(e) => set('cfxCode', e.target.value.toLowerCase())} />}
                  </Field>
                  <Field label={t('srv.maxPlayers')}>
                    {(id) => <input id={id} dir="ltr" type="number" min={1} max={2048} value={form.maxPlayers} onChange={(e) => set('maxPlayers', Number(e.target.value))} />}
                  </Field>
                </div>
                <Field label={t('srv.description')}>
                  {(id) => <textarea id={id} dir="auto" rows={3} maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} />}
                </Field>
                <InlineError message={saveError} />
                {editable && (
                  <div className="form-actions">
                    {saved && <span className="success" role="status"><Icon name="check" size={16} />{t('common.saved')}</span>}
                    {data && !saved && <span className="muted small">{t('rep.updated')}: {formatDate(data.updatedAt)}</span>}
                    <Button type="submit" loading={busy} disabled={invalid}>{t('common.save')}</Button>
                  </div>
                )}
              </fieldset>
            </form>
          )}
          {loading && form && <span className="sr-only" role="status">{t('common.loading')}</span>}
        </Panel>

        <div className="stack">
          <Panel title={t('srv.liveStatus')}>
            <div className="status-dot-row"><i className="dot idle" /><strong>{t('dash.notConnected')}</strong></div>
            <p className="muted small">{t('srv.liveStatusHint')}</p>
          </Panel>
          {editable && <RenameWorkspace />}
          {can.deleteWorkspace(ws.role) && <DeleteWorkspace />}
        </div>
      </div>
    </>
  );
}

function RenameWorkspace() {
  const { t } = useI18n();
  const api = useApi();
  const ws = useCurrentWorkspace();
  const { refresh } = useWorkspace();
  const [name, setName] = useState(ws.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setName(ws.name), [ws.name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.renameWorkspace(ws.id, name); await refresh(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return (
    <Panel title={t('srv.workspace')}>
      <form className="form" onSubmit={submit}>
        <Field label={t('srv.rename')}>
          {(id) => <input id={id} dir="auto" value={name} minLength={2} maxLength={60} required onChange={(e) => setName(e.target.value)} />}
        </Field>
        <InlineError message={error} />
        <div className="form-actions">
          <Button type="submit" variant="ghost" loading={busy} disabled={name.trim() === ws.name || name.trim().length < 2}>{t('common.save')}</Button>
        </div>
      </form>
    </Panel>
  );
}

function DeleteWorkspace() {
  const { t } = useI18n();
  const api = useApi();
  const ws = useCurrentWorkspace();
  const { refresh } = useWorkspace();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true); setError(null);
    try { await api.deleteWorkspace(ws.id); await refresh(); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  return (
    <Panel title={t('srv.danger')} className="danger-zone">
      <p className="muted small">{t('srv.deleteHint')}</p>
      <Field label={t('srv.deleteConfirm')}>
        {(id) => <input id={id} dir="auto" value={confirm} placeholder={ws.name} onChange={(e) => setConfirm(e.target.value)} />}
      </Field>
      <InlineError message={error} />
      <Button variant="danger" icon="trash" loading={busy} disabled={confirm !== ws.name} onClick={del}>{t('srv.delete')}</Button>
    </Panel>
  );
}
