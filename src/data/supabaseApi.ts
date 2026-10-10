import type { SupabaseClient } from '@supabase/supabase-js';
import type { DataApi } from './api';
import type { Activity, Member, Report, ReportPatch, Role, ServerSettings } from '../lib/types';

/* Row shapes as stored in Postgres (snake_case). */
interface ReportRow {
  id: string; title: string; description: string; category: Report['category'];
  status: Report['status']; priority: Report['priority']; reporter_name: string;
  target_player: string; assigned_to: string | null; created_by: string | null;
  created_at: string; updated_at: string; closed_at: string | null;
}

const REPORT_COLS =
  'id,title,description,category,status,priority,reporter_name,target_player,assigned_to,created_by,created_at,updated_at,closed_at';

function toReport(r: ReportRow): Report {
  return {
    id: r.id, title: r.title, description: r.description, category: r.category,
    status: r.status, priority: r.priority, reporterName: r.reporter_name,
    targetPlayer: r.target_player, assignedTo: r.assigned_to, createdBy: r.created_by,
    createdAt: r.created_at, updatedAt: r.updated_at, closedAt: r.closed_at,
  };
}

function toReportRow(p: ReportPatch): Partial<ReportRow> {
  const row: Partial<ReportRow> = {};
  if (p.title !== undefined) row.title = p.title.trim();
  if (p.description !== undefined) row.description = p.description;
  if (p.category !== undefined) row.category = p.category;
  if (p.priority !== undefined) row.priority = p.priority;
  if (p.status !== undefined) row.status = p.status;
  if (p.reporterName !== undefined) row.reporter_name = p.reporterName.trim();
  if (p.targetPlayer !== undefined) row.target_player = p.targetPlayer.trim();
  if (p.assignedTo !== undefined) row.assigned_to = p.assignedTo;
  return row;
}

/** Throws Supabase errors so callers can show them. */
function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  if (res.data == null) throw new Error('No data returned');
  return res.data as NonNullable<T>;
}

/** For writes where we don't read the response body. */
function checkWrite(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

export function createSupabaseApi(sb: SupabaseClient, userId: string): DataApi {
  return {
    mode: 'supabase',

    async getProfile() {
      const row = check(await sb.from('profiles').select('id,email,display_name,locale').eq('id', userId).single());
      return { id: row.id, email: row.email, displayName: row.display_name, locale: row.locale };
    },

    async updateProfile(patch) {
      const row: Record<string, string> = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
      if (patch.locale !== undefined) row.locale = patch.locale;
      checkWrite(await sb.from('profiles').update(row).eq('id', userId));
    },

    async listWorkspaces() {
      const rows = check(
        await sb.from('workspace_members')
          .select('role, workspaces!inner(id,name,plan)')
          .eq('user_id', userId)
          .returns<{ role: Role; workspaces: { id: string; name: string; plan: 'free' } }[]>(),
      );
      return rows
        .map((r) => ({ ...r.workspaces, role: r.role }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async createWorkspace(name) {
      return check(await sb.rpc('create_workspace', { ws_name: name.trim() })) as string;
    },

    async renameWorkspace(wsId, name) {
      checkWrite(await sb.from('workspaces').update({ name: name.trim() }).eq('id', wsId));
    },

    async deleteWorkspace(wsId) {
      const { count, error } = await sb.from('workspaces').delete({ count: 'exact' }).eq('id', wsId);
      if (error) throw new Error(error.message);
      if (!count) throw new Error('Not allowed');
    },

    // No live FiveM integration exists yet — never fabricate a status.
    async getServerStatus() {
      return null;
    },

    async getServerSettings(wsId) {
      const r = check(await sb.from('server_settings').select('*').eq('workspace_id', wsId).single());
      return {
        serverName: r.server_name, host: r.host, port: r.port, cfxCode: r.cfx_code,
        maxPlayers: r.max_players, description: r.description, updatedAt: r.updated_at,
      } satisfies ServerSettings;
    },

    async saveServerSettings(wsId, s) {
      const { count, error } = await sb.from('server_settings').update({
        server_name: s.serverName.trim(), host: s.host.trim(), port: s.port, cfx_code: s.cfxCode.trim(),
        max_players: s.maxPlayers, description: s.description, updated_at: new Date().toISOString(),
      }, { count: 'exact' }).eq('workspace_id', wsId);
      if (error) throw new Error(error.message);
      if (!count) throw new Error('Not allowed');
    },

    async listReports(wsId) {
      const rows = check(
        await sb.from('reports').select(REPORT_COLS).eq('workspace_id', wsId)
          .order('created_at', { ascending: false }).limit(500).returns<ReportRow[]>(),
      );
      return rows.map(toReport);
    },

    async createReport(wsId, input) {
      const row = check(
        await sb.from('reports').insert({ ...toReportRow(input), workspace_id: wsId })
          .select(REPORT_COLS).single<ReportRow>(),
      );
      return toReport(row);
    },

    async updateReport(wsId, id, patch) {
      const row = check(
        await sb.from('reports').update(toReportRow(patch)).eq('workspace_id', wsId).eq('id', id)
          .select(REPORT_COLS).single<ReportRow>(),
      );
      return toReport(row);
    },

    async listMembers(wsId) {
      const rows = check(
        await sb.from('workspace_members')
          .select('user_id, role, created_at, profiles!inner(email, display_name)')
          .eq('workspace_id', wsId)
          .returns<{ user_id: string; role: Role; created_at: string; profiles: { email: string; display_name: string } }[]>(),
      );
      return rows.map<Member>((r) => ({
        userId: r.user_id, role: r.role, joinedAt: r.created_at,
        email: r.profiles.email, displayName: r.profiles.display_name,
      }));
    },

    async addMember(wsId, email, role) {
      checkWrite(await sb.rpc('add_workspace_member', { ws: wsId, member_email: email, member_role: role }));
    },

    async updateMemberRole(wsId, uid, role) {
      const { count, error } = await sb.from('workspace_members').update({ role }, { count: 'exact' })
        .eq('workspace_id', wsId).eq('user_id', uid);
      if (error) throw new Error(error.message);
      if (!count) throw new Error('Not allowed');
    },

    async removeMember(wsId, uid) {
      const { count, error } = await sb.from('workspace_members').delete({ count: 'exact' })
        .eq('workspace_id', wsId).eq('user_id', uid);
      if (error) throw new Error(error.message);
      if (!count) throw new Error('Not allowed');
    },

    async listActivity(wsId, limit) {
      const rows = check(
        await sb.from('activity_log').select('id,action,summary,actor_id,created_at')
          .eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(limit),
      );
      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (actorIds.length) {
        const profiles = check(await sb.from('profiles').select('id,email,display_name').in('id', actorIds));
        for (const p of profiles) names.set(p.id, p.display_name || p.email);
      }
      return rows.map<Activity>((r) => ({
        id: String(r.id), action: r.action, summary: r.summary, createdAt: r.created_at,
        actorName: (r.actor_id && names.get(r.actor_id)) || '',
      }));
    },
  };
}
