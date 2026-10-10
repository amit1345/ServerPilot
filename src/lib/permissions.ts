import type { Role } from './types';

const RANK: Record<Role, number> = { owner: 4, admin: 3, moderator: 2, viewer: 1 };

export const ROLES: Role[] = ['owner', 'admin', 'moderator', 'viewer'];

export function atLeast(role: Role | undefined, min: Role): boolean {
  return !!role && RANK[role] >= RANK[min];
}

/**
 * UI hints only — the database enforces the same rules with RLS and triggers
 * (see supabase/migrations/0001_init.sql). Never rely on these for security.
 */
export const can = {
  editReports: (r?: Role) => atLeast(r, 'moderator'),
  manageStaff: (r?: Role) => atLeast(r, 'admin'),
  editSettings: (r?: Role) => atLeast(r, 'admin'),
  deleteWorkspace: (r?: Role) => r === 'owner',
  /** Roles the current user may grant or manage: strictly below their own (owner: everything but owner). */
  assignableRoles: (r?: Role): Role[] =>
    ROLES.filter((x) => x !== 'owner' && (r === 'owner' || (!!r && RANK[x] < RANK[r]))),
  manageMember: (me?: Role, target?: Role) =>
    !!me && !!target && target !== 'owner' && (me === 'owner' || RANK[target] < RANK[me]) && atLeast(me, 'admin'),
};
