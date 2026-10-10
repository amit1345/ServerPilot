import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from './types';

const en = {
  appName: 'ServerPilot',
  tagline: 'Staff operations for FiveM roleplay servers',

  'nav.dashboard': 'Dashboard',
  'nav.reports': 'Reports',
  'nav.staff': 'Staff',
  'nav.server': 'Server settings',
  'nav.account': 'Account & plan',
  'nav.menu': 'Menu',
  'nav.close': 'Close menu',
  'nav.skip': 'Skip to content',

  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.saved': 'Saved',
  'common.cancel': 'Cancel',
  'common.create': 'Create',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.search': 'Search',
  'common.all': 'All',
  'common.none': 'None',
  'common.unassigned': 'Unassigned',
  'common.errorTitle': 'Something went wrong',
  'common.signOut': 'Sign out',
  'common.language': 'Language',
  'common.readOnly': 'You have view-only access to this page.',
  'common.demo': 'Demo',
  'common.demoBanner': 'Demo mode — all data shown is sample data, is not saved, and resets on reload.',
  'common.exitDemo': 'Exit demo',
  'common.justNow': 'just now',

  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'Display name',
  'auth.noAccount': "Don't have an account?",
  'auth.haveAccount': 'Already have an account?',
  'auth.passwordHint': 'At least 8 characters.',
  'auth.checkEmail': 'Account created. Check your inbox to confirm your email, then sign in.',
  'auth.tryDemo': 'Explore the demo',
  'auth.demoNote': 'Browse the interface with sample data. No account, nothing saved.',
  'auth.notConfigured': 'Supabase is not configured yet, so sign-in is disabled. See README → Setup.',
  'auth.or': 'or',

  'ws.select': 'Workspace',
  'ws.create': 'New workspace',
  'ws.createTitle': 'Create your first server workspace',
  'ws.createHint': 'Each workspace is an isolated space for one FiveM server, with its own staff, reports and settings.',
  'ws.name': 'Workspace name',
  'ws.namePlaceholder': 'e.g. Los Santos RP',

  'dash.title': 'Dashboard',
  'dash.status': 'Server status',
  'dash.players': 'Players',
  'dash.uptime': 'Uptime',
  'dash.openReports': 'Open reports',
  'dash.critical': 'Critical / high',
  'dash.online': 'Online',
  'dash.offline': 'Offline',
  'dash.notConnected': 'Not connected',
  'dash.notConnectedHint': 'Live FiveM status is not implemented yet. Connection details can be saved under Server settings.',
  'dash.unavailable': 'Unavailable',
  'dash.recent': 'Recent activity',
  'dash.noActivity': 'No activity yet. Actions on reports and staff will show up here.',
  'dash.latestReports': 'Latest open reports',
  'dash.viewAll': 'View all',

  'rep.title': 'Reports',
  'rep.new': 'New report',
  'rep.searchPlaceholder': 'Search title, player or reporter…',
  'rep.status': 'Status',
  'rep.priority': 'Priority',
  'rep.category': 'Category',
  'rep.assignee': 'Assigned to',
  'rep.created': 'Created',
  'rep.updated': 'Updated',
  'rep.closedAt': 'Closed',
  'rep.reporter': 'Reporter',
  'rep.target': 'Reported player',
  'rep.fieldTitle': 'Title',
  'rep.description': 'Description',
  'rep.empty': 'No reports yet',
  'rep.emptyHint': 'Create a report to start tracking player issues.',
  'rep.noMatch': 'No reports match these filters',
  'rep.clearFilters': 'Clear filters',
  'rep.close': 'Close report',
  'rep.reopen': 'Reopen',
  'rep.details': 'Report details',
  'rep.createdBy': 'Created by',
  'rep.titleTooShort': 'Title must be at least 3 characters.',
  'rep.count': '{n} reports',

  'status.open': 'Open',
  'status.in_progress': 'In progress',
  'status.resolved': 'Resolved',
  'status.closed': 'Closed',
  'priority.low': 'Low',
  'priority.medium': 'Medium',
  'priority.high': 'High',
  'priority.critical': 'Critical',
  'category.player': 'Player conduct',
  'category.bug': 'Bug',
  'category.cheating': 'Cheating',
  'category.staff': 'Staff complaint',
  'category.other': 'Other',

  'staff.title': 'Staff',
  'staff.add': 'Add staff member',
  'staff.addHint': 'The person must already have a ServerPilot account.',
  'staff.role': 'Role',
  'staff.joined': 'Joined',
  'staff.remove': 'Remove',
  'staff.you': 'You',
  'staff.empty': 'No staff members yet',
  'staff.permissions': 'Roles & permissions',
  'staff.confirmRemove': 'Remove {name} from this workspace?',
  'staff.searchPlaceholder': 'Search name or email…',
  'role.owner': 'Owner',
  'role.admin': 'Admin',
  'role.moderator': 'Moderator',
  'role.viewer': 'Viewer',
  'perm.viewData': 'View reports & dashboard',
  'perm.editReports': 'Create & update reports',
  'perm.manageStaff': 'Manage staff (lower roles)',
  'perm.editSettings': 'Edit server settings',
  'perm.deleteWorkspace': 'Delete workspace',

  'srv.title': 'Server settings',
  'srv.connection': 'Connection details',
  'srv.connectionHint': 'Stored for reference only. ServerPilot does not connect to your server yet, and never asks for RCON passwords, txAdmin credentials or license keys.',
  'srv.serverName': 'Server name',
  'srv.host': 'Host / IP',
  'srv.port': 'Port',
  'srv.cfx': 'cfx.re join code',
  'srv.maxPlayers': 'Max players',
  'srv.description': 'Description',
  'srv.liveStatus': 'Live connection',
  'srv.liveStatusHint': 'Planned for a future version. Until then, server status on the dashboard shows “Not connected”.',
  'srv.workspace': 'Workspace',
  'srv.rename': 'Workspace name',
  'srv.danger': 'Danger zone',
  'srv.delete': 'Delete workspace',
  'srv.deleteHint': 'Permanently deletes this workspace and all its reports, staff and settings.',
  'srv.deleteConfirm': 'Type the workspace name to confirm',
  'srv.invalidHost': 'Enter a hostname or IP address without protocol or path.',
  'srv.invalidPort': 'Port must be between 1 and 65535.',
  'srv.invalidCfx': 'Only lowercase letters and digits (up to 12).',

  'acc.title': 'Account & plan',
  'acc.profile': 'Profile',
  'acc.plan': 'Subscription',
  'acc.planFree': 'Free plan',
  'acc.planDesc': 'Up to 5 workspaces. Paid plans are not available yet — no billing is collected.',
  'acc.password': 'Change password',
  'acc.newPassword': 'New password',
  'acc.passwordUpdated': 'Password updated.',
  'acc.demoDisabled': 'Not available in demo mode.',

  'act.report_created': 'created report',
  'act.report_open': 'reopened report',
  'act.report_in_progress': 'started working on',
  'act.report_resolved': 'resolved report',
  'act.report_closed': 'closed report',
  'act.report_assigned': 'reassigned report',
  'act.report_updated': 'updated report',
  'act.member_added': 'added staff member',
  'act.member_role_changed': 'changed role of',
  'act.member_removed': 'removed staff member',
  'act.someone': 'Someone',
};

type Key = keyof typeof en;

const he: Record<Key, string> = {
  appName: 'ServerPilot',
  tagline: 'ניהול צוות לשרתי רולפליי FiveM',

  'nav.dashboard': 'לוח בקרה',
  'nav.reports': 'דיווחים',
  'nav.staff': 'צוות',
  'nav.server': 'הגדרות שרת',
  'nav.account': 'חשבון ומנוי',
  'nav.menu': 'תפריט',
  'nav.close': 'סגירת תפריט',
  'nav.skip': 'דילוג לתוכן',

  'common.save': 'שמירה',
  'common.saving': 'שומר…',
  'common.saved': 'נשמר',
  'common.cancel': 'ביטול',
  'common.create': 'יצירה',
  'common.loading': 'טוען…',
  'common.retry': 'נסו שוב',
  'common.search': 'חיפוש',
  'common.all': 'הכול',
  'common.none': 'ללא',
  'common.unassigned': 'לא משויך',
  'common.errorTitle': 'משהו השתבש',
  'common.signOut': 'התנתקות',
  'common.language': 'שפה',
  'common.readOnly': 'יש לך הרשאת צפייה בלבד בעמוד זה.',
  'common.demo': 'דמו',
  'common.demoBanner': 'מצב דמו — כל הנתונים המוצגים הם נתוני דוגמה, אינם נשמרים ומתאפסים בטעינה מחדש.',
  'common.exitDemo': 'יציאה מהדמו',
  'common.justNow': 'הרגע',

  'auth.signIn': 'התחברות',
  'auth.signUp': 'יצירת חשבון',
  'auth.email': 'אימייל',
  'auth.password': 'סיסמה',
  'auth.displayName': 'שם תצוגה',
  'auth.noAccount': 'אין לך חשבון?',
  'auth.haveAccount': 'כבר יש לך חשבון?',
  'auth.passwordHint': 'לפחות 8 תווים.',
  'auth.checkEmail': 'החשבון נוצר. בדקו את תיבת הדואר כדי לאמת את האימייל ואז התחברו.',
  'auth.tryDemo': 'כניסה לדמו',
  'auth.demoNote': 'סיור בממשק עם נתוני דוגמה. ללא חשבון, דבר לא נשמר.',
  'auth.notConfigured': 'Supabase עדיין לא הוגדר, לכן ההתחברות מושבתת. ראו README ← Setup.',
  'auth.or': 'או',

  'ws.select': 'סביבת עבודה',
  'ws.create': 'סביבה חדשה',
  'ws.createTitle': 'צרו את סביבת העבודה הראשונה לשרת שלכם',
  'ws.createHint': 'כל סביבת עבודה מבודדת ומיועדת לשרת FiveM אחד, עם צוות, דיווחים והגדרות משלה.',
  'ws.name': 'שם הסביבה',
  'ws.namePlaceholder': 'לדוגמה: Los Santos RP',

  'dash.title': 'לוח בקרה',
  'dash.status': 'סטטוס שרת',
  'dash.players': 'שחקנים',
  'dash.uptime': 'זמן פעילות',
  'dash.openReports': 'דיווחים פתוחים',
  'dash.critical': 'קריטי / גבוה',
  'dash.online': 'מחובר',
  'dash.offline': 'לא מחובר',
  'dash.notConnected': 'לא מחובר',
  'dash.notConnectedHint': 'סטטוס חי מ-FiveM עדיין לא מומש. ניתן לשמור את פרטי החיבור בהגדרות השרת.',
  'dash.unavailable': 'לא זמין',
  'dash.recent': 'פעילות אחרונה',
  'dash.noActivity': 'אין עדיין פעילות. פעולות על דיווחים וצוות יופיעו כאן.',
  'dash.latestReports': 'דיווחים פתוחים אחרונים',
  'dash.viewAll': 'הצג הכול',

  'rep.title': 'דיווחים',
  'rep.new': 'דיווח חדש',
  'rep.searchPlaceholder': 'חיפוש לפי כותרת, שחקן או מדווח…',
  'rep.status': 'סטטוס',
  'rep.priority': 'עדיפות',
  'rep.category': 'קטגוריה',
  'rep.assignee': 'משויך ל',
  'rep.created': 'נוצר',
  'rep.updated': 'עודכן',
  'rep.closedAt': 'נסגר',
  'rep.reporter': 'מדווח',
  'rep.target': 'שחקן מדווח',
  'rep.fieldTitle': 'כותרת',
  'rep.description': 'תיאור',
  'rep.empty': 'אין עדיין דיווחים',
  'rep.emptyHint': 'צרו דיווח כדי להתחיל לעקוב אחר בעיות שחקנים.',
  'rep.noMatch': 'אין דיווחים התואמים לסינון',
  'rep.clearFilters': 'ניקוי סינון',
  'rep.close': 'סגירת דיווח',
  'rep.reopen': 'פתיחה מחדש',
  'rep.details': 'פרטי דיווח',
  'rep.createdBy': 'נוצר על ידי',
  'rep.titleTooShort': 'הכותרת חייבת להכיל לפחות 3 תווים.',
  'rep.count': '{n} דיווחים',

  'status.open': 'פתוח',
  'status.in_progress': 'בטיפול',
  'status.resolved': 'טופל',
  'status.closed': 'סגור',
  'priority.low': 'נמוכה',
  'priority.medium': 'בינונית',
  'priority.high': 'גבוהה',
  'priority.critical': 'קריטית',
  'category.player': 'התנהגות שחקן',
  'category.bug': 'באג',
  'category.cheating': 'רמאות',
  'category.staff': 'תלונה על צוות',
  'category.other': 'אחר',

  'staff.title': 'צוות',
  'staff.add': 'הוספת איש צוות',
  'staff.addHint': 'לאדם חייב להיות כבר חשבון ServerPilot.',
  'staff.role': 'תפקיד',
  'staff.joined': 'הצטרף',
  'staff.remove': 'הסרה',
  'staff.you': 'את/ה',
  'staff.empty': 'אין עדיין אנשי צוות',
  'staff.permissions': 'תפקידים והרשאות',
  'staff.confirmRemove': 'להסיר את {name} מסביבת העבודה?',
  'staff.searchPlaceholder': 'חיפוש לפי שם או אימייל…',
  'role.owner': 'בעלים',
  'role.admin': 'מנהל',
  'role.moderator': 'מודרטור',
  'role.viewer': 'צופה',
  'perm.viewData': 'צפייה בדיווחים ובלוח הבקרה',
  'perm.editReports': 'יצירה ועדכון של דיווחים',
  'perm.manageStaff': 'ניהול צוות (תפקידים נמוכים יותר)',
  'perm.editSettings': 'עריכת הגדרות שרת',
  'perm.deleteWorkspace': 'מחיקת סביבת עבודה',

  'srv.title': 'הגדרות שרת',
  'srv.connection': 'פרטי חיבור',
  'srv.connectionHint': 'נשמרים לעיון בלבד. ServerPilot עדיין לא מתחבר לשרת שלכם, ולעולם אינו מבקש סיסמאות RCON, פרטי txAdmin או מפתחות רישיון.',
  'srv.serverName': 'שם השרת',
  'srv.host': 'כתובת / IP',
  'srv.port': 'פורט',
  'srv.cfx': 'קוד הצטרפות cfx.re',
  'srv.maxPlayers': 'מקסימום שחקנים',
  'srv.description': 'תיאור',
  'srv.liveStatus': 'חיבור חי',
  'srv.liveStatusHint': 'מתוכנן לגרסה עתידית. עד אז, סטטוס השרת בלוח הבקרה יוצג כ"לא מחובר".',
  'srv.workspace': 'סביבת עבודה',
  'srv.rename': 'שם הסביבה',
  'srv.danger': 'אזור מסוכן',
  'srv.delete': 'מחיקת סביבת עבודה',
  'srv.deleteHint': 'מוחק לצמיתות את הסביבה ואת כל הדיווחים, הצוות וההגדרות שלה.',
  'srv.deleteConfirm': 'הקלידו את שם הסביבה לאישור',
  'srv.invalidHost': 'הזינו שם מארח או כתובת IP ללא פרוטוקול או נתיב.',
  'srv.invalidPort': 'הפורט חייב להיות בין 1 ל-65535.',
  'srv.invalidCfx': 'אותיות לטיניות קטנות וספרות בלבד (עד 12).',

  'acc.title': 'חשבון ומנוי',
  'acc.profile': 'פרופיל',
  'acc.plan': 'מנוי',
  'acc.planFree': 'תוכנית חינמית',
  'acc.planDesc': 'עד 5 סביבות עבודה. תוכניות בתשלום עדיין אינן זמינות — לא נגבה תשלום.',
  'acc.password': 'שינוי סיסמה',
  'acc.newPassword': 'סיסמה חדשה',
  'acc.passwordUpdated': 'הסיסמה עודכנה.',
  'acc.demoDisabled': 'לא זמין במצב דמו.',

  'act.report_created': 'יצר/ה דיווח',
  'act.report_open': 'פתח/ה מחדש דיווח',
  'act.report_in_progress': 'התחיל/ה לטפל ב',
  'act.report_resolved': 'סימן/ה כמטופל',
  'act.report_closed': 'סגר/ה דיווח',
  'act.report_assigned': 'שייך/ה מחדש דיווח',
  'act.report_updated': 'עדכן/ה דיווח',
  'act.member_added': 'הוסיף/ה איש צוות',
  'act.member_role_changed': 'שינה/תה תפקיד של',
  'act.member_removed': 'הסיר/ה איש צוות',
  'act.someone': 'מישהו',
};

const dictionaries: Record<Locale, Record<Key, string>> = { en, he };
const STORAGE_KEY = 'serverpilot.locale';

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  formatDate: (iso: string) => string;
  formatRelative: (iso: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

function readStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'he') return v;
  } catch { /* storage unavailable */ }
  return 'he';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = dictionaries[locale];
    const tag = locale === 'he' ? 'he-IL' : 'en-US';
    const dateFmt = new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' });
    const rel = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
    return {
      locale,
      setLocale,
      t: (key, vars) => {
        let s = dict[key] ?? en[key] ?? key;
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
        return s;
      },
      formatDate: (iso) => dateFmt.format(new Date(iso)),
      formatRelative: (iso) => {
        const diff = (new Date(iso).getTime() - Date.now()) / 1000;
        const abs = Math.abs(diff);
        if (abs < 45) return dict['common.justNow'];
        if (abs < 3600) return rel.format(Math.round(diff / 60), 'minute');
        if (abs < 86400) return rel.format(Math.round(diff / 3600), 'hour');
        if (abs < 86400 * 30) return rel.format(Math.round(diff / 86400), 'day');
        return dateFmt.format(new Date(iso));
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export type TranslationKey = Key;
