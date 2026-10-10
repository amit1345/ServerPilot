import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './icons';
import { Button, RoleBadge } from './ui';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useSession } from '../context/SessionContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { Logo } from './Logo';

const NAV: { to: string; icon: IconName; label: TranslationKey }[] = [
  { to: '/', icon: 'dashboard', label: 'nav.dashboard' },
  { to: '/reports', icon: 'reports', label: 'nav.reports' },
  { to: '/staff', icon: 'staff', label: 'nav.staff' },
  { to: '/server', icon: 'server', label: 'nav.server' },
  { to: '/account', icon: 'account', label: 'nav.account' },
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <button className="lang-toggle" onClick={() => setLocale(locale === 'he' ? 'en' : 'he')}
      aria-label={t('common.language')} title={t('common.language')}>
      <Icon name="globe" size={16} />
      <span>{locale === 'he' ? 'English' : 'עברית'}</span>
    </button>
  );
}

function WorkspaceSwitcher({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n();
  const { workspaces, current, select } = useWorkspace();
  return (
    <div className="ws-switcher">
      <label htmlFor="ws-select" className="eyebrow">{t('ws.select')}</label>
      <div className="ws-row">
        <select id="ws-select" value={current?.id ?? ''} onChange={(e) => select(e.target.value)}>
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button className="icon-btn" onClick={onCreate} aria-label={t('ws.create')} title={t('ws.create')}>
          <Icon name="plus" />
        </button>
      </div>
      {current && <RoleBadge role={current.role} />}
    </div>
  );
}

export function Shell({ onCreateWorkspace }: { onCreateWorkspace: () => void }) {
  const { t } = useI18n();
  const { session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isDemo = session.kind === 'demo';

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const sidebar = (
    <>
      <div className="brand"><Logo /><span>{t('appName')}</span></div>
      <WorkspaceSwitcher onCreate={onCreateWorkspace} />
      <nav aria-label={t('nav.menu')}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon name={n.icon} />
            <span>{t(n.label)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="user-chip" dir="auto">{isDemo ? 'Demo User' : session.kind === 'user' ? session.email : ''}</div>
        <div className="sidebar-foot-row">
          <LanguageToggle />
          <Button variant="subtle" icon="logout" onClick={() => void signOut()}>
            {isDemo ? t('common.exitDemo') : t('common.signOut')}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="shell">
      <a className="skip-link" href="#main">{t('nav.skip')}</a>
      <aside className="sidebar glass">{sidebar}</aside>

      <header className="topbar glass">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label={t('nav.menu')} aria-expanded={open}>
          <Icon name="menu" />
        </button>
        <div className="brand"><Logo /><span>{t('appName')}</span></div>
        <LanguageToggle />
      </header>

      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <aside className="drawer glass" onClick={(e) => e.stopPropagation()} aria-label={t('nav.menu')}>
            <button className="icon-btn drawer-close" onClick={() => setOpen(false)} aria-label={t('nav.close')}>
              <Icon name="close" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main id="main" className="main">
        {isDemo && (
          <div className="demo-banner" role="note">
            <Icon name="alert" size={16} />
            <span>{t('common.demoBanner')}</span>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
