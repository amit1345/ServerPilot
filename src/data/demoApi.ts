import type { DataApi } from './api';
import type { Activity, Member, Report, Role, ServerSettings, ServerStatus, Workspace } from '../lib/types';

/*
 * DEMO DATA — sample content for exploring the UI without an account.
 * Lives only in memory: nothing is persisted and it resets on reload.
 * The UI shows a "Demo" banner whenever this source is active.
 */

const DEMO_USER = 'demo-user';
const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const delay = <T,>(v: T, ms = 350) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));
let seq = 100;
const id = () => `demo-${++seq}`;

interface DemoWorkspace {
  ws: Workspace;
  members: Member[];
  reports: Report[];
  activity: Activity[];
  settings: ServerSettings;
  status: ServerStatus;
}

function seed(): DemoWorkspace[] {
  const lsrpMembers: Member[] = [
    { userId: DEMO_USER, email: 'demo@serverpilot.example', displayName: 'Demo User', role: 'owner', joinedAt: ago(60 * 24 * 90) },
    { userId: 'u-noa', email: 'noa@example.com', displayName: 'Noa “Viper” Levi', role: 'admin', joinedAt: ago(60 * 24 * 80) },
    { userId: 'u-itay', email: 'itay@example.com', displayName: 'Itay Ben-David', role: 'moderator', joinedAt: ago(60 * 24 * 40) },
    { userId: 'u-maya', email: 'maya@example.com', displayName: 'Maya Cohen', role: 'moderator', joinedAt: ago(60 * 24 * 21) },
    { userId: 'u-omer', email: 'omer@example.com', displayName: 'Omer Azulay', role: 'moderator', joinedAt: ago(60 * 24 * 9) },
    { userId: 'u-dan', email: 'dan@example.com', displayName: 'Dan Mizrahi', role: 'viewer', joinedAt: ago(60 * 24 * 3) },
  ];
  const r = (
    i: number, title: string, category: Report['category'], status: Report['status'], priority: Report['priority'],
    reporterName: string, targetPlayer: string, assignedTo: string | null, createdMin: number, description: string,
  ): Report => ({
    id: `demo-r${i}`, title, description, category, status, priority, reporterName, targetPlayer, assignedTo,
    createdBy: assignedTo ?? DEMO_USER, createdAt: ago(createdMin), updatedAt: ago(Math.max(createdMin - 30, 2)),
    closedAt: status === 'closed' ? ago(Math.max(createdMin - 60, 1)) : null,
  });
  const lsrpReports: Report[] = [
    r(1, 'RDM at Legion Square', 'player', 'open', 'high', 'Shira_K', 'xXGhostXx', 'u-itay', 12,
      'Player shot three civilians without any RP initiation near the garage. Clip attached in ticket #4412.'),
    r(2, 'Suspected teleport hack', 'cheating', 'in_progress', 'critical', 'AutoReport', 'NoScope_99', 'u-noa', 38,
      'Anti-cheat flagged position jumps of 2km in under a second, three times during a police chase.'),
    r(3, 'Car stuck under map at Paleto Bay', 'bug', 'open', 'low', 'Yossi_M', '', null, 95,
      'Vehicle falls through the road near the gas station after the latest map update.'),
    r(4, 'VDM during bank heist', 'player', 'resolved', 'medium', 'Officer_Tal', 'RoadKing', 'u-maya', 260,
      'Ran over two officers repeatedly. Player warned and acknowledged the rules.'),
    r(5, 'Fail RP — ignoring injuries', 'player', 'open', 'medium', 'EMS_Lior', 'BigBoss_44', 'u-omer', 410,
      'Kept running after being downed in a shootout instead of waiting for EMS.'),
    r(6, 'Moderator abused /tp', 'staff', 'in_progress', 'high', 'Anonymous', 'Mod_Ron', 'u-noa', 720,
      'A moderator teleported to a private scene without being called. Requires owner review.'),
    r(7, 'Money duplication via inventory', 'cheating', 'open', 'critical', 'Eco_Watch', 'Lucky7', null, 25,
      'Bank balance jumped from $12k to $2.4M within ten minutes. Suspected inventory desync exploit.'),
    r(8, 'Combat logging after arrest', 'player', 'closed', 'medium', 'Officer_Gal', 'SpeedDemon', 'u-itay', 1900,
      'Disconnected while cuffed. Banned 3 days per rule 7.2.'),
    r(9, 'Phone app crashes on open', 'bug', 'resolved', 'low', 'Neta_R', '', 'u-maya', 2600,
      'Fixed in resource update 1.4.2.'),
    r(10, 'Mic spam in city hall', 'player', 'closed', 'low', 'Mayor_Avi', 'LoudGuy', 'u-omer', 4300,
      'Verbal warning given.'),
    r(11, 'Weapon spawned in green zone', 'cheating', 'open', 'high', 'Shira_K', 'Unknown_221', null, 6,
      'Player pulled an RPG at the hospital without any inventory record.'),
  ];
  const lsrpActivity: Activity[] = [
    { id: 'a1', action: 'report_created', summary: 'Weapon spawned in green zone', actorName: 'Maya Cohen', createdAt: ago(6) },
    { id: 'a2', action: 'report_created', summary: 'RDM at Legion Square', actorName: 'Itay Ben-David', createdAt: ago(12) },
    { id: 'a3', action: 'report_created', summary: 'Money duplication via inventory', actorName: 'Omer Azulay', createdAt: ago(25) },
    { id: 'a4', action: 'report_in_progress', summary: 'Suspected teleport hack', actorName: 'Noa “Viper” Levi', createdAt: ago(30) },
    { id: 'a5', action: 'report_resolved', summary: 'VDM during bank heist', actorName: 'Maya Cohen', createdAt: ago(230) },
    { id: 'a6', action: 'member_added', summary: 'Dan Mizrahi · viewer', actorName: 'Demo User', createdAt: ago(60 * 24 * 3) },
    { id: 'a7', action: 'report_closed', summary: 'Combat logging after arrest', actorName: 'Itay Ben-David', createdAt: ago(1840) },
  ];

  const ncMembers: Member[] = [
    { userId: 'u-ari', email: 'ari@example.com', displayName: 'Ari Shalom', role: 'owner', joinedAt: ago(60 * 24 * 200) },
    { userId: DEMO_USER, email: 'demo@serverpilot.example', displayName: 'Demo User', role: 'moderator', joinedAt: ago(60 * 24 * 30) },
    { userId: 'u-yael', email: 'yael@example.com', displayName: 'Yael Peretz', role: 'admin', joinedAt: ago(60 * 24 * 150) },
  ];

  return [
    {
      ws: { id: 'demo-ws-lsrp', name: 'Los Santos Roleplay', plan: 'free', role: 'owner' },
      members: lsrpMembers, reports: lsrpReports, activity: lsrpActivity,
      settings: {
        serverName: 'Los Santos Roleplay | Serious RP | Hebrew', host: 'play.lsrp.example', port: 30120,
        cfxCode: 'k3x9ab', maxPlayers: 128, description: 'Serious Hebrew-speaking roleplay community.', updatedAt: ago(60 * 24),
      },
      status: { online: true, players: 87, maxPlayers: 128, uptimeSeconds: 3 * 86400 + 4 * 3600 + 12 * 60 },
    },
    {
      ws: { id: 'demo-ws-nc', name: 'Night City RP', plan: 'free', role: 'moderator' },
      members: ncMembers,
      reports: [r(20, 'Server lag spikes at night', 'bug', 'open', 'medium', 'Kobi_T', '', 'u-yael', 300,
        'Tick time spikes above 60ms between 23:00 and 01:00.')],
      activity: [],
      settings: {
        serverName: 'Night City RP', host: '203.0.113.42', port: 30120, cfxCode: '', maxPlayers: 64,
        description: '', updatedAt: ago(60 * 24 * 10),
      },
      status: { online: false, players: 0, maxPlayers: 64, uptimeSeconds: null },
    },
  ];
}

export function createDemoApi(): DataApi {
  const data = seed();
  const get = (wsId: string) => {
    const w = data.find((d) => d.ws.id === wsId);
    if (!w) throw new Error('Workspace not found');
    return w;
  };
  const log = (w: DemoWorkspace, action: string, summary: string) =>
    w.activity.unshift({ id: id(), action, summary, actorName: 'Demo User', createdAt: new Date().toISOString() });
  const guard = (w: DemoWorkspace, min: Role) => {
    const rank = { owner: 4, admin: 3, moderator: 2, viewer: 1 };
    if (rank[w.ws.role] < rank[min]) throw new Error('Not allowed');
  };

  return {
    mode: 'demo',

    getProfile: () => delay({ id: DEMO_USER, email: 'demo@serverpilot.example', displayName: 'Demo User', locale: 'he' }),
    updateProfile: async () => { throw new Error('Not available in demo mode'); },

    listWorkspaces: () => delay(data.map((d) => d.ws)),
    createWorkspace: async (name) => {
      const ws: DemoWorkspace = {
        ws: { id: id(), name: name.trim(), plan: 'free', role: 'owner' },
        members: [{ ...seed()[0].members[0], joinedAt: new Date().toISOString() }],
        reports: [], activity: [],
        settings: { serverName: name.trim(), host: '', port: 30120, cfxCode: '', maxPlayers: 64, description: '', updatedAt: new Date().toISOString() },
        status: { online: false, players: 0, maxPlayers: 64, uptimeSeconds: null },
      };
      data.push(ws);
      return delay(ws.ws.id);
    },
    renameWorkspace: async (wsId, name) => {
      const w = get(wsId); guard(w, 'admin');
      w.ws.name = name.trim();
      return delay(undefined);
    },
    deleteWorkspace: async (wsId) => {
      const w = get(wsId); guard(w, 'owner');
      data.splice(data.indexOf(w), 1);
      return delay(undefined);
    },

    getServerStatus: async (wsId) => delay(get(wsId).status),
    getServerSettings: async (wsId) => delay(get(wsId).settings),
    saveServerSettings: async (wsId, s) => {
      const w = get(wsId); guard(w, 'admin');
      w.settings = { ...s, updatedAt: new Date().toISOString() };
      return delay(undefined);
    },

    listReports: async (wsId) => delay(get(wsId).reports),
    createReport: async (wsId, input) => {
      const w = get(wsId); guard(w, 'moderator');
      const ts = new Date().toISOString();
      const rep: Report = { ...input, id: id(), status: 'open', createdBy: DEMO_USER, createdAt: ts, updatedAt: ts, closedAt: null };
      w.reports.unshift(rep);
      log(w, 'report_created', rep.title);
      return delay(rep);
    },
    updateReport: async (wsId, rid, patch) => {
      const w = get(wsId); guard(w, 'moderator');
      const rep = w.reports.find((x) => x.id === rid);
      if (!rep) throw new Error('Report not found');
      const prevStatus = rep.status;
      Object.assign(rep, patch, { updatedAt: new Date().toISOString() });
      if (patch.status === 'closed' && prevStatus !== 'closed') rep.closedAt = rep.updatedAt;
      if (patch.status && patch.status !== 'closed') rep.closedAt = null;
      log(w, patch.status && patch.status !== prevStatus ? `report_${patch.status}` : 'report_updated', rep.title);
      return delay(rep);
    },

    listMembers: async (wsId) => delay(get(wsId).members),
    addMember: async (wsId, email, role) => {
      const w = get(wsId); guard(w, 'admin');
      if (w.members.some((m) => m.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('Already a member');
      const name = email.split('@')[0];
      w.members.push({ userId: id(), email: email.trim(), displayName: name, role, joinedAt: new Date().toISOString() });
      log(w, 'member_added', `${name} · ${role}`);
      return delay(undefined);
    },
    updateMemberRole: async (wsId, uid, role) => {
      const w = get(wsId); guard(w, 'admin');
      const m = w.members.find((x) => x.userId === uid);
      if (!m || m.role === 'owner') throw new Error('Not allowed');
      m.role = role;
      log(w, 'member_role_changed', `${m.displayName} · ${role}`);
      return delay(undefined);
    },
    removeMember: async (wsId, uid) => {
      const w = get(wsId); guard(w, 'admin');
      const m = w.members.find((x) => x.userId === uid);
      if (!m || m.role === 'owner') throw new Error('Not allowed');
      w.members.splice(w.members.indexOf(m), 1);
      log(w, 'member_removed', m.displayName);
      return delay(undefined);
    },

    listActivity: async (wsId, limit) => delay(get(wsId).activity.slice(0, limit)),
  };
}

export const DEMO_USER_ID = DEMO_USER;
