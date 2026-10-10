import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { useI18n } from '../lib/i18n';
import type { ReportPriority, ReportStatus, Role } from '../lib/types';

export function Panel({ title, actions, children, className = '' }: {
  title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'; icon?: IconName; loading?: boolean;
};
export function Button({ variant = 'primary', icon, loading, children, disabled, className = '', ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner sm" aria-hidden="true" /> : icon && <Icon name={icon} size={16} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className="skeleton-list" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" />)}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="state state-error" role="alert">
      <Icon name="alert" size={28} />
      <strong>{t('common.errorTitle')}</strong>
      <p className="muted" dir="auto">{message}</p>
      {onRetry && <Button variant="ghost" onClick={onRetry}>{t('common.retry')}</Button>}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, hint, action }: {
  icon?: IconName; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div className="state">
      <Icon name={icon} size={30} />
      <strong>{title}</strong>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="inline-error" role="alert" dir="auto"><Icon name="alert" size={16} />{message}</p>;
}

export function DemoTag() {
  const { t } = useI18n();
  return <span className="demo-tag">{t('common.demo')}</span>;
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { t } = useI18n();
  return <span className={`badge status-${status}`}>{t(`status.${status}`)}</span>;
}

export function PriorityBadge({ priority }: { priority: ReportPriority }) {
  const { t } = useI18n();
  return <span className={`badge prio prio-${priority}`}><i aria-hidden="true" />{t(`priority.${priority}`)}</span>;
}

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n();
  return <span className={`badge role-${role}`}>{t(`role.${role}`)}</span>;
}

export function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string | null; children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <small className="field-error">{error}</small> : hint && <small className="muted">{hint}</small>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('.modal-body input, .modal-body select, .modal-body textarea')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal panel" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="panel-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.cancel')}><Icon name="close" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function PageHeader({ title, actions, children }: { title: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
