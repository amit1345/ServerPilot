import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button, EmptyState, ErrorState, Field, InlineError, Modal, PageHeader, Panel, PriorityBadge, Skeleton, StatusBadge,
} from '../components/ui';
import { Icon } from '../components/icons';
import { useI18n } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { can } from '../lib/permissions';
import { useApi } from '../context/SessionContext';
import { useCurrentWorkspace } from '../context/WorkspaceContext';
import { errorMessage } from '../data/api';
import type { Member, Report, ReportCategory, ReportInput, ReportPatch, ReportPriority, ReportStatus } from '../lib/types';

const STATUSES: ReportStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES: ReportPriority[] = ['critical', 'high', 'medium', 'low'];
const CATEGORIES: ReportCategory[] = ['player', 'cheating', 'bug', 'staff', 'other'];
const PRIO_ORDER: Record<ReportPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface Filters { q: string; status: '' | ReportStatus; priority: '' | ReportPriority; category: '' | ReportCategory; assignee: string }
const EMPTY_FILTERS: Filters = { q: '', status: '', priority: '', category: '', assignee: '' };

export function Reports() {
  const { t, formatRelative } = useI18n();
  const api = useApi();
  const ws = useCurrentWorkspace();
  const editable = can.editReports(ws.role);
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [creating, setCreating] = useState(false);

  const { data, setData, loading, error, reload } = useAsync(async () => {
    const [reports, members] = await Promise.all([api.listReports(ws.id), api.listMembers(ws.id)]);
    return { reports, members };
  }, [api, ws.id]);

  const memberName = useMemo(() => {
    const m = new Map(data?.members.map((x) => [x.userId, x.displayName || x.email]));
    return (id: string | null) => (id ? m.get(id) ?? '—' : t('common.unassigned'));
  }, [data?.members, t]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filters.q.trim().toLowerCase();
    return data.reports
      .filter((r) =>
        (!filters.status || r.status === filters.status) &&
        (!filters.priority || r.priority === filters.priority) &&
        (!filters.category || r.category === filters.category) &&
        (!filters.assignee || (filters.assignee === 'none' ? !r.assignedTo : r.assignedTo === filters.assignee)) &&
        (!q || [r.title, r.targetPlayer, r.reporterName, r.description].some((s) => s.toLowerCase().includes(q))))
      .sort((a, b) => {
        const closedA = a.status === 'closed' || a.status === 'resolved';
        const closedB = b.status === 'closed' || b.status === 'resolved';
        if (closedA !== closedB) return closedA ? 1 : -1;
        return PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] || b.createdAt.localeCompare(a.createdAt);
      });
  }, [data, filters]);

  const openId = params.get('open');
  const selected = data?.reports.find((r) => r.id === openId) ?? null;
  const setOpen = (id: string | null) => setParams(id ? { open: id } : {}, { replace: true });

  const upsert = (rep: Report) =>
    setData((d) => d && { ...d, reports: d.reports.some((r) => r.id === rep.id) ? d.reports.map((r) => (r.id === rep.id ? rep : r)) : [rep, ...d.reports] });

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const staff = data?.members.filter((m) => m.role !== 'viewer') ?? [];

  return (
    <>
      <PageHeader title={t('rep.title')}
        actions={editable && <Button icon="plus" onClick={() => setCreating(true)}>{t('rep.new')}</Button>}>
        {data && <p className="muted">{t('rep.count', { n: data.reports.length })}</p>}
      </PageHeader>
      {!editable && <p className="notice"><Icon name="shield" size={16} />{t('common.readOnly')}</p>}

      <Panel>
        <div className="filters">
          <div className="search">
            <Icon name="search" size={16} />
            <input type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder={t('rep.searchPlaceholder')} aria-label={t('common.search')} />
          </div>
          <Select label={t('rep.status')} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v as Filters['status'] })}
            options={STATUSES.map((s) => [s, t(`status.${s}`)])} />
          <Select label={t('rep.priority')} value={filters.priority} onChange={(v) => setFilters({ ...filters, priority: v as Filters['priority'] })}
            options={PRIORITIES.map((p) => [p, t(`priority.${p}`)])} />
          <Select label={t('rep.category')} value={filters.category} onChange={(v) => setFilters({ ...filters, category: v as Filters['category'] })}
            options={CATEGORIES.map((c) => [c, t(`category.${c}`)])} />
          <Select label={t('rep.assignee')} value={filters.assignee} onChange={(v) => setFilters({ ...filters, assignee: v })}
            options={[['none', t('common.unassigned')], ...staff.map((m) => [m.userId, m.displayName || m.email] as [string, string])]} />
        </div>

        {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Skeleton rows={6} /> : !data?.reports.length ? (
          <EmptyState title={t('rep.empty')} hint={t('rep.emptyHint')}
            action={editable && <Button icon="plus" onClick={() => setCreating(true)}>{t('rep.new')}</Button>} />
        ) : !filtered.length ? (
          <EmptyState icon="search" title={t('rep.noMatch')}
            action={<Button variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>{t('rep.clearFilters')}</Button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('rep.fieldTitle')}</th>
                  <th>{t('rep.priority')}</th>
                  <th>{t('rep.status')}</th>
                  <th>{t('rep.assignee')}</th>
                  <th>{t('rep.created')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => setOpen(r.id)} className={r.status === 'closed' ? 'dim' : ''}>
                    <td data-label={t('rep.fieldTitle')}>
                      <button className="row-link" onClick={(e) => { e.stopPropagation(); setOpen(r.id); }}>
                        <strong dir="auto">{r.title}</strong>
                      </button>
                      <span className="muted small">{t(`category.${r.category}`)}{r.targetPlayer && <> · <bdi>{r.targetPlayer}</bdi></>}</span>
                    </td>
                    <td data-label={t('rep.priority')}><PriorityBadge priority={r.priority} /></td>
                    <td data-label={t('rep.status')}><StatusBadge status={r.status} /></td>
                    <td data-label={t('rep.assignee')}><bdi>{memberName(r.assignedTo)}</bdi></td>
                    <td data-label={t('rep.created')} className="muted"><time dateTime={r.createdAt}>{formatRelative(r.createdAt)}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasFilters && <p className="muted small table-foot">{filtered.length} / {data.reports.length}</p>}
          </div>
        )}
      </Panel>

      {creating && data && (
        <ReportForm staff={staff} onClose={() => setCreating(false)}
          onSubmit={async (input) => { const rep = await api.createReport(ws.id, input); upsert(rep); setCreating(false); }} />
      )}
      {selected && data && (
        <ReportDetail report={selected} staff={staff} editable={editable} memberName={memberName}
          onClose={() => setOpen(null)}
          onPatch={async (patch) => upsert(await api.updateReport(ws.id, selected.id, patch))} />
      )}
    </>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  const { t } = useI18n();
  return (
    <label className="select-filter">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{label}: {t('common.all')}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function ReportForm({ staff, onClose, onSubmit }: {
  staff: Member[]; onClose: () => void; onSubmit: (input: ReportInput) => Promise<void>;
}) {
  const { t } = useI18n();
  const [f, setF] = useState<ReportInput>({
    title: '', description: '', category: 'player', priority: 'medium', reporterName: '', targetPlayer: '', assignedTo: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const titleError = touched && f.title.trim().length < 3 ? t('rep.titleTooShort') : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (f.title.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try { await onSubmit(f); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }

  return (
    <Modal title={t('rep.new')} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Field label={t('rep.fieldTitle')} error={titleError}>
          {(id) => <input id={id} value={f.title} maxLength={120} onBlur={() => setTouched(true)}
            onChange={(e) => setF({ ...f, title: e.target.value })} required aria-invalid={!!titleError} />}
        </Field>
        <div className="form-grid">
          <Field label={t('rep.category')}>
            {(id) => <select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ReportCategory })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
            </select>}
          </Field>
          <Field label={t('rep.priority')}>
            {(id) => <select id={id} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as ReportPriority })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
            </select>}
          </Field>
          <Field label={t('rep.reporter')}>
            {(id) => <input id={id} value={f.reporterName} maxLength={60} onChange={(e) => setF({ ...f, reporterName: e.target.value })} />}
          </Field>
          <Field label={t('rep.target')}>
            {(id) => <input id={id} value={f.targetPlayer} maxLength={60} onChange={(e) => setF({ ...f, targetPlayer: e.target.value })} />}
          </Field>
        </div>
        <AssigneeField staff={staff} value={f.assignedTo} onChange={(v) => setF({ ...f, assignedTo: v })} />
        <Field label={t('rep.description')}>
          {(id) => <textarea id={id} rows={4} maxLength={4000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}
        </Field>
        <InlineError message={error} />
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" icon="plus" loading={busy}>{t('common.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AssigneeField({ staff, value, onChange, disabled }: {
  staff: Member[]; value: string | null; onChange: (v: string | null) => void; disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Field label={t('rep.assignee')}>
      {(id) => (
        <select id={id} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">{t('common.unassigned')}</option>
          {staff.map((m) => <option key={m.userId} value={m.userId}>{m.displayName || m.email}</option>)}
        </select>
      )}
    </Field>
  );
}

function ReportDetail({ report, staff, editable, memberName, onClose, onPatch }: {
  report: Report; staff: Member[]; editable: boolean; memberName: (id: string | null) => string;
  onClose: () => void; onPatch: (p: ReportPatch) => Promise<void>;
}) {
  const { t, formatDate } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(key: string, p: ReportPatch) {
    setBusy(key);
    setError(null);
    try { await onPatch(p); } catch (err) { setError(errorMessage(err)); } finally { setBusy(null); }
  }

  const isClosed = report.status === 'closed';
  return (
    <Modal title={t('rep.details')} onClose={onClose}
      footer={editable && (
        isClosed
          ? <Button variant="ghost" loading={busy === 'close'} onClick={() => patch('close', { status: 'open' })}>{t('rep.reopen')}</Button>
          : <Button variant="danger" icon="check" loading={busy === 'close'} onClick={() => patch('close', { status: 'closed' })}>{t('rep.close')}</Button>
      )}>
      <div className="detail">
        <h3 dir="auto">{report.title}</h3>
        <div className="detail-badges">
          <StatusBadge status={report.status} />
          <PriorityBadge priority={report.priority} />
          <span className="badge">{t(`category.${report.category}`)}</span>
        </div>
        {report.description && <p className="detail-desc" dir="auto">{report.description}</p>}

        <dl className="meta">
          <div><dt>{t('rep.reporter')}</dt><dd dir="auto">{report.reporterName || '—'}</dd></div>
          <div><dt>{t('rep.target')}</dt><dd dir="auto">{report.targetPlayer || '—'}</dd></div>
          <div><dt>{t('rep.createdBy')}</dt><dd dir="auto">{report.createdBy ? memberName(report.createdBy) : '—'}</dd></div>
          <div><dt>{t('rep.created')}</dt><dd>{formatDate(report.createdAt)}</dd></div>
          <div><dt>{t('rep.updated')}</dt><dd>{formatDate(report.updatedAt)}</dd></div>
          {report.closedAt && <div><dt>{t('rep.closedAt')}</dt><dd>{formatDate(report.closedAt)}</dd></div>}
        </dl>

        <div className="form-grid">
          <Field label={t('rep.status')}>
            {(id) => (
              <select id={id} value={report.status} disabled={!editable || !!busy}
                onChange={(e) => patch('status', { status: e.target.value as ReportStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </select>
            )}
          </Field>
          <Field label={t('rep.priority')}>
            {(id) => (
              <select id={id} value={report.priority} disabled={!editable || !!busy}
                onChange={(e) => patch('priority', { priority: e.target.value as ReportPriority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
              </select>
            )}
          </Field>
        </div>
        <AssigneeField staff={staff} value={report.assignedTo} disabled={!editable || !!busy}
          onChange={(v) => patch('assignee', { assignedTo: v })} />
        {busy && busy !== 'close' && <p className="muted small">{t('common.saving')}</p>}
        <InlineError message={error} />
      </div>
    </Modal>
  );
}
