// npm run test:db — runs the ServerPilot migration on PGlite with a minimal Supabase auth mock,
// then exercises the RLS policies / triggers as different users.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase grants table privileges to these roles by default.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(migration);

const U = {};
for (const [n, i] of [['A', 1], ['B', 2], ['C', 3], ['D', 4], ['E', 5], ['F', 6]]) {
  U[n] = `00000000-0000-0000-0000-00000000000${i}`;
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
    [U[n], `${n.toLowerCase()}@test.dev`, { display_name: `User ${n}` }]);
}

async function as(user, sql, params = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ? U[user] : '']);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}

let pass = 0, fail = 0;
async function expectOk(name, fn, check) {
  try {
    const r = await fn();
    if (check && !check(r)) throw new Error('check failed: ' + JSON.stringify(r.rows ?? r));
    pass++; console.log('  ok  ', name);
    return r;
  } catch (e) { fail++; console.log('  FAIL', name, '→', e.message); }
}
async function expectErr(name, fn, re) {
  try {
    const r = await fn();
    fail++; console.log('  FAIL', name, '→ expected error, got', JSON.stringify(r.rows ?? r).slice(0, 200));
  } catch (e) {
    if (re && !re.test(e.message)) { fail++; console.log('  FAIL', name, '→ wrong error:', e.message); return; }
    pass++; console.log('  ok  ', name, `(${e.message.slice(0, 70)})`);
  }
}
const rows = (n) => (r) => r.rows.length === n;
const affected = (n) => (r) => r.affectedRows === n;

console.log('setup');
const ws1 = (await expectOk('A creates workspace', () => as('A', `select public.create_workspace('LSRP') id`))).rows[0].id;
const ws2 = (await expectOk('F creates workspace', () => as('F', `select public.create_workspace('Other RP') id`))).rows[0].id;
await expectOk('settings row created', () => as('A', `select * from server_settings where workspace_id=$1`, [ws1]), rows(1));
await expectOk('A is owner', () => as('A', `select role from workspace_members where workspace_id=$1`, [ws1]), (r) => r.rows[0].role === 'owner');
await expectOk('profile created w/ display name', () => as('A', `select display_name from profiles where id=$1`, [U.A]), (r) => r.rows[0]?.display_name === 'User A');

console.log('membership');
await expectOk('A adds B as admin', () => as('A', `select public.add_workspace_member($1,'b@test.dev','admin')`, [ws1]));
await expectOk('A adds C as moderator', () => as('A', `select public.add_workspace_member($1,'C@TEST.dev','moderator')`, [ws1]));
await expectOk('A adds D as viewer', () => as('A', `select public.add_workspace_member($1,'d@test.dev','viewer')`, [ws1]));
await expectErr('A cannot add a second owner', () => as('A', `select public.add_workspace_member($1,'e@test.dev','owner')`, [ws1]), /owner/);
await expectErr('B (admin) cannot grant admin', () => as('B', `select public.add_workspace_member($1,'e@test.dev','admin')`, [ws1]), /role/);
await expectErr('C (moderator) cannot add members', () => as('C', `select public.add_workspace_member($1,'e@test.dev','viewer')`, [ws1]), /Not allowed/);
await expectErr('E (outsider) cannot add self', () => as('E', `select public.add_workspace_member($1,'e@test.dev','viewer')`, [ws1]), /Not allowed/);
await expectErr('unknown email rejected', () => as('A', `select public.add_workspace_member($1,'nobody@x.dev','viewer')`, [ws1]), /No ServerPilot account/);
await expectErr('E cannot insert membership directly', () => as('E', `insert into workspace_members values ($1,$2,'admin')`, [ws1, U.E]), /row-level security|role/);
await expectErr('E cannot insert workspace directly', () => as('E', `insert into workspaces (name, created_by) values ('x',$1)`, [U.E]), /row-level security/);
await expectOk('B demotes C to viewer', () => as('B', `update workspace_members set role='viewer' where workspace_id=$1 and user_id=$2`, [ws1, U.C]), affected(1));
await expectOk('B restores C to moderator', () => as('B', `update workspace_members set role='moderator' where workspace_id=$1 and user_id=$2`, [ws1, U.C]), affected(1));
await expectErr('B cannot promote C to admin', () => as('B', `update workspace_members set role='admin' where workspace_id=$1 and user_id=$2`, [ws1, U.C]), /role/);
await expectErr('B cannot change owner', () => as('B', `update workspace_members set role='viewer' where workspace_id=$1 and user_id=$2`, [ws1, U.A]), /owner/);
await expectErr('A cannot make B owner', () => as('A', `update workspace_members set role='owner' where workspace_id=$1 and user_id=$2`, [ws1, U.B]), /owner/);
await expectOk('C cannot update roles (0 rows)', () => as('C', `update workspace_members set role='viewer' where workspace_id=$1 and user_id=$2`, [ws1, U.D]), affected(0));
await expectErr('B cannot move member to another ws', () => as('B', `update workspace_members set workspace_id=$2 where workspace_id=$1 and user_id=$3`, [ws1, ws2, U.D]), /permission denied/);
await expectErr('A cannot leave as owner', () => as('A', `delete from workspace_members where workspace_id=$1 and user_id=$2`, [ws1, U.A]), /owner/);

console.log('isolation');
for (const t of ['workspaces', 'workspace_members', 'server_settings', 'reports', 'activity_log']) {
  const col = t === 'workspaces' ? 'id' : 'workspace_id';
  await expectOk(`E sees nothing in ${t}`, () => as('E', `select * from ${t} where ${col}=$1`, [ws1]), rows(0));
  await expectErr(`anon cannot read ${t}`, () => as(null, `select * from ${t}`), /permission denied/);
}
await expectOk('A does not see ws2', () => as('A', `select * from workspaces where id=$1`, [ws2]), rows(0));
await expectOk('D sees A profile (shared ws)', () => as('D', `select * from profiles where id=$1`, [U.A]), rows(1));
await expectOk('E cannot see A profile', () => as('E', `select * from profiles where id=$1`, [U.A]), rows(0));
await expectErr('A cannot change own email', () => as('A', `update profiles set email='x@y.z' where id=$1`, [U.A]), /permission denied/);
await expectOk('A can change own display name', () => as('A', `update profiles set display_name='Alpha' where id=$1`, [U.A]), affected(1));
await expectOk('A cannot change B display name (0 rows)', () => as('A', `update profiles set display_name='x' where id=$1`, [U.B]), affected(0));

console.log('reports');
const rep = (await expectOk('C (moderator) creates report', () => as('C',
  `insert into reports (workspace_id, title, priority, created_by) values ($1,'RDM at legion','high',$2) returning *`, [ws1, U.A]),
  (r) => r.rows[0].created_by === U.C))?.rows[0];
await expectErr('D (viewer) cannot create report', () => as('D', `insert into reports (workspace_id, title) values ($1,'nope')`, [ws1]), /row-level security/);
await expectErr('E cannot create report in ws1', () => as('E', `insert into reports (workspace_id, title) values ($1,'nope')`, [ws1]), /row-level security/);
await expectOk('D can read report', () => as('D', `select * from reports where id=$1`, [rep.id]), rows(1));
await expectOk('D cannot update report (0 rows)', () => as('D', `update reports set status='closed' where id=$1`, [rep.id]), affected(0));
await expectOk('C assigns B', () => as('C', `update reports set assigned_to=$2 where id=$1`, [rep.id, U.B]), affected(1));
await expectErr('cannot assign viewer D', () => as('C', `update reports set assigned_to=$2 where id=$1`, [rep.id, U.D]), /Assignee/);
await expectErr('cannot assign outsider E', () => as('C', `update reports set assigned_to=$2 where id=$1`, [rep.id, U.E]), /Assignee/);
await expectOk('C closes report → closed_at set', () => as('C', `update reports set status='closed' where id=$1 returning closed_at`, [rep.id]), (r) => r.rows[0].closed_at !== null);
await expectOk('reopen clears closed_at', () => as('C', `update reports set status='open' where id=$1 returning closed_at`, [rep.id]), (r) => r.rows[0].closed_at === null);
await expectOk('workspace_id/created_by immutable', () => as('B', `update reports set workspace_id=$2, created_by=$3 where id=$1 returning workspace_id, created_by`, [rep.id, ws2, U.B]),
  (r) => r.rows[0].workspace_id === ws1 && r.rows[0].created_by === U.C);
await expectErr('C cannot delete reports', () => as('C', `delete from reports where id=$1`, [rep.id]).then((r) => { if (r.affectedRows === 0) throw new Error('0 rows'); return r; }), /0 rows/);

console.log('activity');
await expectOk('D sees activity', () => as('D', `select action from activity_log where workspace_id=$1 order by id`, [ws1]),
  (r) => r.rows.some((x) => x.action === 'report_created') && r.rows.some((x) => x.action === 'report_closed') && r.rows.some((x) => x.action === 'member_added'));
await expectErr('A cannot write activity', () => as('A', `insert into activity_log (workspace_id, action) values ($1,'fake')`, [ws1]), /row-level security/);

console.log('settings + workspace');
await expectOk('C cannot edit settings (0 rows)', () => as('C', `update server_settings set host='evil' where workspace_id=$1`, [ws1]), affected(0));
await expectOk('B edits settings', () => as('B', `update server_settings set host='play.lsrp.gg', cfx_code='abc123' where workspace_id=$1`, [ws1]), affected(1));
await expectErr('invalid cfx code rejected', () => as('B', `update server_settings set cfx_code='BAD CODE' where workspace_id=$1`, [ws1]), /check/);
await expectOk('B renames workspace', () => as('B', `update workspaces set name='LSRP 2' where id=$1`, [ws1]), affected(1));
await expectErr('B cannot change plan', () => as('B', `update workspaces set plan='free' where id=$1`, [ws1]), /permission denied/);
await expectOk('B cannot delete workspace (0 rows)', () => as('B', `delete from workspaces where id=$1`, [ws1]), affected(0));
await expectOk('D leaves workspace', () => as('D', `delete from workspace_members where workspace_id=$1 and user_id=$2`, [ws1, U.D]), affected(1));
await expectOk('A deletes workspace (cascade)', () => as('A', `delete from workspaces where id=$1`, [ws1]), affected(1));
await expectOk('nothing left for ws1', () => as(null, `select (select count(*) from workspace_members where workspace_id=$1) + (select count(*) from reports where workspace_id=$1) + (select count(*) from activity_log where workspace_id=$1) n`, [ws1]).catch(async () => {
  await db.exec('reset role'); return db.query(`select (select count(*) from workspace_members where workspace_id=$1) + (select count(*) from reports where workspace_id=$1) + (select count(*) from activity_log where workspace_id=$1) n`, [ws1]);
}), (r) => Number(r.rows[0].n) === 0);
await expectOk('ws2 untouched', () => as('F', `select * from workspace_members where workspace_id=$1`, [ws2]), rows(1));

console.log('limits');
for (let i = 0; i < 4; i++) await as('F', `select public.create_workspace('extra ${i}')`);
await expectErr('6th workspace blocked', () => as('F', `select public.create_workspace('one too many')`), /limit/);

console.log('account deletion');
const ws3 = (await as('F', `select public.create_workspace('Third') id`).catch(() => null))?.rows?.[0]?.id;
await as('F', `select public.add_workspace_member($1,'c@test.dev','moderator')`, [ws2]);
const r3 = (await as('C', `insert into reports (workspace_id, title) values ($1,'by C') returning id`, [ws2])).rows[0].id;
await expectOk('deleting user C succeeds', async () => { await db.exec('reset role'); return db.query(`delete from auth.users where id=$1`, [U.C]); }, affected(1));
await expectOk('C report kept, author nulled', () => as('F', `select created_by from reports where id=$1`, [r3]), (r) => r.rows.length === 1 && r.rows[0].created_by === null);
await expectOk('C membership removed', () => as('F', `select * from workspace_members where workspace_id=$1 and user_id=$2`, [ws2, U.C]), rows(0));
await expectOk('deleting owner F removes their workspaces', async () => {
  await db.exec('reset role'); await db.query(`delete from auth.users where id=$1`, [U.F]);
  return db.query(`select count(*) n from workspaces where created_by=$1`, [U.F]);
}, (r) => Number(r.rows[0].n) === 0 && ws3 === undefined);

await expectErr('anon cannot call create_workspace', () => as(null, `select public.create_workspace('anon ws')`), /permission denied/);
await expectErr('anon cannot call add_workspace_member', () => as(null, `select public.add_workspace_member($1,'a@test.dev','viewer')`, [ws1]), /permission denied/);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
