# FieldLoop v0.1 — Auth & Tenant Isolation

## 1. Identity provider

Supabase Auth is the identity provider. Field technicians get email/password +
magic-link sign-in; a 4-digit device PIN can gate local access on top (local
only, not the session secret). Office users use email/password + MFA.

- Session = Supabase JWT (`access_token`) + refresh token.
- The mobile app persists the refresh token in SecureStore / expo-secure-store.
- Offline, the client keeps the last-valid JWT locally; sync re-authenticates
  with the refresh token before pushing.

## 2. Roles

| Role | Permissions |
|------|-------------|
| `admin` | Parent-level: all entities, user provisioning, accounting credentials |
| `scheduler` | Office web: create/schedule jobs across assigned entities, dispatch |
| `technician` | Mobile: their assigned jobs, field capture, signoff |

Roles are stored in `entity_members.role` per (user, entity) pair. A user may
belong to multiple entities with different roles.

## 3. RLS model (authoritative)

Isolation key chain:

```
auth.uid()  ->  entity_members (user_id)  ->  entities (parent_abn)
```

- `my_entity_ids()` returns the entities the caller belongs to.
- `my_parent_abns()` returns the parent ABNs the caller may touch.
- `set_tenant_scope(abn)` sets `app.current_parent_abn` **only after** verifying
  membership — the fix for the original `current_setting`-trusting draft.
- Every business table's policy is `entity_id IN my_entity_ids()` (or joins to
  `jobs` for dependent rows).

## 4. Tenancy semantics

- A **tenant** is the parent enterprise, identified by `parent_abn`
  (`90056106855` for Chatsworth).
- A **division/entity** is a child of the tenant. FieldLoop is multi-tenant by
  design: a second enterprise later gets its own `parent_abn` rows and its users
  can never see Chatsworth rows, because membership chains through their own
  entities only.

## 5. JWT claims & helpers

- The client never sends `parent_abn` as a trust boundary. The server derives
  scope from the authenticated JWT (`sub` = `auth.uid()`) + membership tables.
- Custom claims (optional, for PostgREST filtering) can be set on the user's
  `raw_app_meta_data` via a `handle_new_user` trigger, but membership tables are
  authoritative regardless of claims.

## 6. Service role & secrets

- `oauth_tokens` (MYOB/Xero refresh tokens) is service-role-only; the web/mobile
  clients never see accounting tokens.
- Accounting pushes run as an API/service context that reads `oauth_tokens` by
  entity, so a token belongs to the tenant's accounting tenant, never a user.

## 7. Provisioning flow

1. Admin creates/links a Supabase user and adds an `entity_members` row
   (`entity_id`, `role`).
2. On sign-in the client fetches the user's entities (RLS-filtered) and caches
   them for offline.
3. All subsequent data reads/writes are already scoped by RLS; the client never
   receives another tenant's data even with a malformed request.
