import { useMemo, useState, type FormEvent } from 'react';
import { Button, EmptyState, ErrorState, Field, InlineError, Modal, PageHeader, Panel, RoleBadge, Skeleton } from '../components/ui';
import { Icon } from '../components/icons';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { can, ROLES } from '../lib/permissions';
import { useApi, useSession } from '../context/SessionContext';
import { useCurrentWorkspace } from '../context/WorkspaceContext';
import { DEMO_USER_ID } from '../data/demoApi';
import { errorMessage } from '../data/api';
import type { Member, Role } from '../lib/types';

const PERMISSIONS: { key: TranslationKey; min: Role }[] = [
  { key: 'perm.viewData', min: 'viewer' },
  { key: 'perm.editReports', min: 'moderator' },
  { key: 'perm.manageStaff', min: 'admin' },
  { key: 'perm.editSettings', min: 'admin' },
  { key: 'perm.deleteWorkspace', min: 'owner' },
];
const RANK: Record<Role, number> = { owner: 4, admin: 3, moderator: 2, viewer: 1 };

export function Staff() {
  const { t, formatDate } = useI18n();
  const api = useApi();
  const { session } = useSession();
  const ws = useCurrentWorkspace();
  const myId = session.kind === 'user' ? session.userId : DEMO_USER_ID;
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(() => api.listMembers(ws.id), [api, ws.id]);

  const members = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? [])
      .filter((m) => !s || m.displayName.toLowerCase().includes(s) || m.email.toLowerCase().includes(s))
      .sort((a, b) => RANK[b.role] - RANK[a.role] || a.displayName.localeCompare(b.displayName));
  }, [data, q]);

  async function changeRole(m: Member, role: Role) {
    setRowBusy(m.userId);
    setRowError(null);
    try { await api.updateMemberRole(ws.id, m.userId, role); await reload(); }
    catch (e) { setRowError(errorMessage(e)); }
    finally { setRowBusy(null); }
  }

  return (
    <>
      <PageHeader title={t('staff.title')}
        actions={can.manageStaff(ws.role) && <Button icon="plus" onClick={() => setAdding(true)}>{t('staff.add')}</Button>} />

      <Panel>
        <div className="filters">
          <div className="search">
            <Icon name="search" size={16} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('staff.searchPlaceholder')} aria-label={t('common.search')} />
          </div>
        </div>
        <InlineError message={rowError} />
        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton rows={4} /> : !members.length ? (
          <EmptyState icon="users" title={t('staff.empty')} />
        ) : (
          <ul className="member-list">
            {members.map((m) => {
              const manageable = can.manageMember(ws.role, m.role) && m.userId !== myId;
              return (
                <li key={m.userId} className="member">
                  <span className="avatar" aria-hidden="true">{(m.displayName || m.email).slice(0, 1).toUpperCase()}</span>
                  <div className="member-main">
                    <strong dir="auto">{m.displayName || m.email}{m.userId === myId && <span className="muted"> · {t('staff.you')}</span>}</strong>
                    <span className="muted small" dir="ltr">{m.email}</span>
                  </div>
                  <span className="muted small member-joined">{t('staff.joined')} {formatDate(m.joinedAt)}</span>
                  <div className="member-actions">
                    {manageable ? (
                      <>
                        <select aria-label={t('staff.role')} value={m.role} disabled={rowBusy === m.userId}
                          onChange={(e) => changeRole(m, e.target.value as Role)}>
                          {can.assignableRoles(ws.role).map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
                        </select>
                        <button className="icon-btn danger" onClick={() => setRemoving(m)} aria-label={`${t('staff.remove')} ${m.displayName}`}>
                          <Icon name="trash" size={16} />
                        </button>
                      </>
                    ) : <RoleBadge role={m.role} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={t('staff.permissions')}>
        <div className="table-wrap">
          <table className="table perm-table">
            <thead>
              <tr><th />{ROLES.map((r) => <th key={r}><RoleBadge role={r} /></th>)}</tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{t(p.key)}</th>
                  {ROLES.map((r) => (
                    <td key={r} className="center">
                      {RANK[r] >= RANK[p.min]
                        ? <Icon name="check" className="yes" aria-label="✓" />
                        : <span className="no" aria-label="✗">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {adding && <AddMember onClose={() => setAdding(false)} onAdded={() => { setAdding(false); void reload(); }} />}
      {removing && (
        <ConfirmRemove member={removing} onClose={() => setRemoving(null)}
          onConfirm={async () => { await api.removeMember(ws.id, removing.userId); setRemoving(null); await reload(); }} />
      )}
    </>
  );
}

function AddMember({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { t } = useI18n();
  const api = useApi();
  const ws = useCurrentWorkspace();
  const roles = can.assignableRoles(ws.role);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(roles.includes('moderator') ? 'moderator' : roles[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await api.addMember(ws.id, email, role); onAdded(); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  }

  return (
    <Modal title={t('staff.add')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">{t('staff.addHint')}</p>
        <Field label={t('auth.email')}>
          {(id) => <input id={id} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label={t('staff.role')}>
          {(id) => (
            <select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roles.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
            </select>
          )}
        </Field>
        <InlineError message={error} />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" icon="plus" loading={busy}>{t('staff.add')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmRemove({ member, onClose, onConfirm }: { member: Member; onClose: () => void; onConfirm: () => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title={t('staff.remove')} onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="danger" icon="trash" loading={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { await onConfirm(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
        }}>{t('staff.remove')}</Button>
      </>}>
      <p>{t('staff.confirmRemove', { name: member.displayName || member.email })}</p>
      <InlineError message={error} />
    </Modal>
  );
}
