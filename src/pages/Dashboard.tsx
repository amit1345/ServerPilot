import { Link } from 'react-router-dom';
import { DemoTag, EmptyState, ErrorState, PageHeader, Panel, PriorityBadge, StatusBadge } from '../components/ui';
import { Icon, type IconName } from '../components/icons';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { useApi } from '../context/SessionContext';
import { useCurrentWorkspace } from '../context/WorkspaceContext';
import type { ReactNode } from 'react';

function formatUptime(sec: number, locale: string) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return locale === 'he' ? `${d} ימ׳ ${h} שע׳ ${m} דק׳` : `${d}d ${h}h ${m}m`;
}

function Stat({ icon, label, value, sub, tone, tag }: {
  icon: IconName; label: string; value: ReactNode; sub?: ReactNode; tone?: string; tag?: ReactNode;
}) {
  return (
    <div className={`stat panel ${tone ?? ''}`}>
      <div className="stat-top">
        <span className="stat-icon"><Icon name={icon} /></span>
        <span className="stat-label">{label}</span>
        {tag}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub muted">{sub}</div>}
    </div>
  );
}

export function Dashboard() {
  const { t, locale, formatRelative } = useI18n();
  const api = useApi();
  const ws = useCurrentWorkspace();
  const isDemo = api.mode === 'demo';

  const { data, loading, error, reload } = useAsync(async () => {
    const [status, reports, activity] = await Promise.all([
      api.getServerStatus(ws.id), api.listReports(ws.id), api.listActivity(ws.id, 8),
    ]);
    return { status, reports, activity };
  }, [api, ws.id]);

  return (
    <>
      <PageHeader title={t('dash.title')}><p className="muted">{ws.name}</p></PageHeader>

      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? (
        <div className="stats-grid">{Array.from({ length: 4 }, (_, i) => <div key={i} className="stat panel skeleton tall" />)}</div>
      ) : (
        <>
          <div className="stats-grid">
            {data.status ? (
              <>
                <Stat icon="server" label={t('dash.status')} tag={isDemo && <DemoTag />}
                  tone={data.status.online ? 'tone-ok' : 'tone-bad'}
                  value={<span className="status-dot-row"><i className={`dot ${data.status.online ? 'ok' : 'bad'}`} />{t(data.status.online ? 'dash.online' : 'dash.offline')}</span>} />
                <Stat icon="users" label={t('dash.players')} tag={isDemo && <DemoTag />}
                  value={data.status.online ? <bdi>{data.status.players} / {data.status.maxPlayers}</bdi> : '—'}
                  sub={data.status.online && (
                    <span className="meter" aria-hidden="true"><i style={{ inlineSize: `${(data.status.players / data.status.maxPlayers) * 100}%` }} /></span>
                  )} />
                <Stat icon="clock" label={t('dash.uptime')} tag={isDemo && <DemoTag />}
                  value={data.status.uptimeSeconds != null ? formatUptime(data.status.uptimeSeconds, locale) : t('dash.unavailable')} />
              </>
            ) : (
              <div className="stat panel span-3 not-connected">
                <div className="stat-top">
                  <span className="stat-icon"><Icon name="plug" /></span>
                  <span className="stat-label">{t('dash.status')}</span>
                </div>
                <div className="stat-value"><span className="status-dot-row"><i className="dot idle" />{t('dash.notConnected')}</span></div>
                <p className="muted small">{t('dash.notConnectedHint')}</p>
              </div>
            )}
            <OpenReportsStat reports={data.reports} />
          </div>

          <div className="dash-grid">
            <Panel title={t('dash.latestReports')} actions={<Link to="/reports" className="link">{t('dash.viewAll')}</Link>}>
              {(() => {
                const open = data.reports.filter((r) => r.status === 'open' || r.status === 'in_progress')
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
                if (!open.length) return <EmptyState title={t('rep.empty')} hint={t('rep.emptyHint')} />;
                return (
                  <ul className="mini-list">
                    {open.map((r) => (
                      <li key={r.id}>
                        <Link to={`/reports?open=${r.id}`} className="mini-row">
                          <div className="mini-main">
                            <strong dir="auto">{r.title}</strong>
                            <span className="muted small">{formatRelative(r.createdAt)}{r.targetPlayer && <> · <bdi>{r.targetPlayer}</bdi></>}</span>
                          </div>
                          <div className="mini-badges"><PriorityBadge priority={r.priority} /><StatusBadge status={r.status} /></div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Panel>

            <Panel title={<>{t('dash.recent')} {isDemo && <DemoTag />}</>}>
              {data.activity.length === 0 ? (
                <EmptyState icon="activity" title={t('dash.noActivity')} />
              ) : (
                <ol className="timeline">
                  {data.activity.map((a) => (
                    <li key={a.id}>
                      <span className="tl-dot" aria-hidden="true" />
                      <div>
                        <p>
                          <strong dir="auto">{a.actorName || t('act.someone')}</strong>{' '}
                          {t(`act.${a.action}` as TranslationKey)}{' '}
                          <bdi className="tl-subject">{a.summary}</bdi>
                        </p>
                        <time className="muted small" dateTime={a.createdAt}>{formatRelative(a.createdAt)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function OpenReportsStat({ reports }: { reports: { status: string; priority: string }[] }) {
  const { t } = useI18n();
  const open = reports.filter((r) => r.status === 'open' || r.status === 'in_progress');
  const urgent = open.filter((r) => r.priority === 'critical' || r.priority === 'high').length;
  return (
    <Stat icon="reports" label={t('dash.openReports')} value={open.length} tone={urgent ? 'tone-warn' : ''}
      sub={<>{t('dash.critical')}: <strong>{urgent}</strong></>} />
  );
}
