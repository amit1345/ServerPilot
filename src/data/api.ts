import type {
  Activity, Member, Profile, Report, ReportInput, ReportPatch, Role, ServerSettings, ServerStatus, Workspace,
} from '../lib/types';

/**
 * Everything the UI needs from a backend. Two implementations:
 *   - supabaseApi: real data, authorization enforced by Postgres RLS.
 *   - createDemoApi: in-memory sample data, clearly labeled in the UI.
 */
export interface DataApi {
  mode: 'demo' | 'supabase';

  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'locale'>>): Promise<void>;

  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(name: string): Promise<string>;
  renameWorkspace(wsId: string, name: string): Promise<void>;
  deleteWorkspace(wsId: string): Promise<void>;

  /** null means "no live connection" — the only answer outside demo mode for now. */
  getServerStatus(wsId: string): Promise<ServerStatus | null>;
  getServerSettings(wsId: string): Promise<ServerSettings>;
  saveServerSettings(wsId: string, s: Omit<ServerSettings, 'updatedAt'>): Promise<void>;

  listReports(wsId: string): Promise<Report[]>;
  createReport(wsId: string, input: ReportInput): Promise<Report>;
  updateReport(wsId: string, id: string, patch: ReportPatch): Promise<Report>;

  listMembers(wsId: string): Promise<Member[]>;
  addMember(wsId: string, email: string, role: Role): Promise<void>;
  updateMemberRole(wsId: string, userId: string, role: Role): Promise<void>;
  removeMember(wsId: string, userId: string): Promise<void>;

  listActivity(wsId: string, limit: number): Promise<Activity[]>;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
