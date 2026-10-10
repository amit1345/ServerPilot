export type Role = 'owner' | 'admin' | 'moderator' | 'viewer';
export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReportCategory = 'player' | 'bug' | 'cheating' | 'staff' | 'other';
export type Locale = 'he' | 'en';

export interface Workspace {
  id: string;
  name: string;
  plan: 'free';
  role: Role; // the current user's role in this workspace
}

export interface Member {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  joinedAt: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  status: ReportStatus;
  priority: ReportPriority;
  reporterName: string;
  targetPlayer: string;
  assignedTo: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export type ReportInput = Pick<
  Report,
  'title' | 'description' | 'category' | 'priority' | 'reporterName' | 'targetPlayer' | 'assignedTo'
>;
export type ReportPatch = Partial<ReportInput & { status: ReportStatus }>;

export interface ServerSettings {
  serverName: string;
  host: string;
  port: number;
  cfxCode: string;
  maxPlayers: number;
  description: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  action: string;
  summary: string;
  actorName: string;
  createdAt: string;
}

/** Live server metrics. Only the demo source returns these; no live FiveM connection exists yet. */
export interface ServerStatus {
  online: boolean;
  players: number;
  maxPlayers: number;
  uptimeSeconds: number | null;
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
}
