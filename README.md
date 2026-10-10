# ServerPilot

Staff operations for FiveM GTA roleplay servers: reports, staff roles and server details, one isolated workspace per server.

- **Stack:** React 19 + TypeScript + Vite, Supabase (Auth + Postgres + Row Level Security). Everything fits in Supabase's free tier.
- **UI:** dark glass theme, Hebrew RTL by default with an English toggle, sidebar on desktop and a drawer on mobile.
- **Demo mode:** "Explore the demo" on the login screen opens the UI with in-memory sample data. It's labeled as demo on every page, saves nothing and isn't a login.

## What's in v1 and what isn't

| Included | Not included yet |
| --- | --- |
| Email/password auth (Supabase Auth) | Live FiveM status. The dashboard shows **"Not connected"** for real workspaces |
| Multiple workspaces with full data isolation | Remote server administration (RCON, txAdmin, kicks or bans) |
| Reports: create, view, update, assign, close or reopen, search and filter | Billing. Every workspace is on the Free plan (max 5 owned workspaces) |
| Staff roles: owner, admin, moderator, viewer | Email invitations. Staff must already have an account |
| Server connection details (non-secret only) | |
| Activity feed (written by database triggers) | |

## Setup

### 1. Run locally in demo mode (no backend)

```bash
npm install
npm run dev
```

Open http://localhost:5173. Sign-in stays disabled until Supabase is configured, but the demo works.

### 2. Create a Supabase project (free)

1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor**, paste all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and run it once. (If you use the Supabase CLI, run `supabase db push` instead.)
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Copy `.env.example` to `.env.local` and fill in both values:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

5. Restart `npm run dev`.

> **Never** put the `service_role` key in `.env.local` or anywhere in this app. Anything prefixed with `VITE_` ends up in the browser bundle. The anon key is meant to be public, and RLS is what protects the data.

### 3. Configure Auth

Under **Authentication → URL Configuration**, set **Site URL** to your app's URL (for example `http://localhost:5173` during development). Add your production URL under **Redirect URLs** when you deploy.

Email confirmation is on by default. New users must click the link in their inbox before they can sign in. Supabase's built-in email sender has a low hourly limit. For production, set up custom SMTP under **Authentication → Emails**.

### 4. Deploy (optional)

This is a static SPA. Any free static host works, for example Vercel, Netlify or Cloudflare Pages:

- Build command: `npm run build`. Output directory: `dist`.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables on the host.
- Add an SPA fallback so every path serves `index.html`. On Netlify, add `public/_redirects` containing `/* /index.html 200`. Vercel and Cloudflare Pages handle this automatically for Vite projects.

## Security model

All authorization lives in Postgres, in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). The permission checks in the frontend ([`src/lib/permissions.ts`](src/lib/permissions.ts)) only decide which buttons to show.

- RLS is enabled on every table. The `anon` role has no table access at all.
- You can only see a workspace, and its reports, members, settings and activity, if you have a row in `workspace_members` for it.
- Role checks go through the `SECURITY DEFINER` helpers `my_role()` and `has_role()`. A non-member ranks 0 and never passes a check.

| Permission | Viewer | Moderator | Admin | Owner |
| --- | :-: | :-: | :-: | :-: |
| View dashboard, reports, staff, settings | ✓ | ✓ | ✓ | ✓ |
| Create and update reports | | ✓ | ✓ | ✓ |
| Manage staff (only roles below your own) | | | ✓ | ✓ |
| Edit server settings and rename the workspace | | | ✓ | ✓ |
| Delete the workspace | | | | ✓ |

**Triggers enforce:**

- Exactly one owner per workspace. The owner can't be demoted or removed.
- Nobody can grant or manage a role equal to or above their own.
- Report `workspace_id`, `created_by` and `created_at` can't be changed. `closed_at` is set by the server.
- Assignees must be non-viewer staff of the same workspace.
- The activity log is written only by triggers. Clients can't insert into it.

**Column privileges:** users can change only `display_name` and `locale` on their profile, only `name` on a workspace, and only `role` on a membership.

**Secrets:** server settings hold only public connection info (host, port, cfx.re code). The app never asks for RCON passwords, txAdmin credentials or license keys.

**Passwords:** Supabase Auth handles passwords. The app never stores them. The Supabase SDK keeps only its own session token in `localStorage`. The app itself stores only UI preferences there: language and the last selected workspace.

### Testing the policies

```bash
npm run test:db
```

This runs the migration on [PGlite](https://pglite.dev), an in-process Postgres with no Docker or account needed, using a minimal mock of Supabase's `auth` schema. It then checks 70 scenarios across six users: cross-workspace isolation, anonymous access, role escalation, owner protection, report rules, column privileges, cascading deletes, account deletion and plan limits. Run it after any change to the schema.

## Project structure

```
src/
  lib/          types, i18n (he/en dictionaries), permissions (UI hints), supabase client, useAsync
  data/         DataApi interface + supabaseApi (real) + demoApi (in-memory sample data)
  context/      SessionContext (auth / demo), WorkspaceContext (current workspace)
  components/   Shell (sidebar, drawer, top bar), ui primitives, icons
  pages/        AuthPage, CreateWorkspace, Dashboard, Reports, Staff, ServerSettings, Account
  styles.css    theme tokens + layout (CSS logical properties, so RTL and LTR share one stylesheet)
supabase/
  migrations/   schema, RLS, triggers, RPCs
  tests/        PGlite-based policy tests
```

**Adding a string:** add the key to `en` in `src/lib/i18n.tsx`. TypeScript then requires the same key in `he`.

**Adding a table:** enable RLS and write policies that use `has_role(workspace_id, '<min role>')`. Then add cases to `supabase/tests/rls.test.mjs`.

## Known limitations

- Workspace deletion is permanent. There's no soft delete or undo.
- When a user is deleted from Supabase, the workspaces they own are deleted with them. Reports they created stay, with the author shown as "—".
- `profiles.email` is copied when the user signs up. It isn't updated if the user later changes their email.
