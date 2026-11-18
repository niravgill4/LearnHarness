# Cloud test readiness — 2026-11-17

Status: NOT APPROVED for multi-account public testing. Latest fixes remain local; no production cutover was performed during this audit.

## Checks completed

- Public production GET /api/graph returns 200 without an authenticated session. It currently returned an empty graph; this demonstrates missing access gating, not proof of a data disclosure.
- TypeScript check passes after the latest changes.
- Ten targeted authentication/document proxy tests passed before the latest job authorization changes.
- Full test suite was started and reported failures; it is not a passing release gate.
- git diff --check passes.

## Implemented locally

- Supabase session authentication now applies to API routes through proxy; streamed document route authenticates separately.
- Session subresources verify database ownership before local cache access.
- Chat requests verify ownership and hydrate missing records from Supabase.
- Full saved chat records restore images, side conversations and additional state.
- Graph reads and positions use account-scoped Supabase records instead of merging global filesystem records.
- New sessions await persistence of initialized records.
- Next after() drains a running teaching turn and saves its final record, subject to Vercel's five-minute route limit. This is not a durable queue or crash recovery guarantee.
- Job status and cancellation verify session ownership. Plugin-worker cancellation fails closed in cloud mode because it has no verifiable account owner yet.

## Remaining blocking findings

1. app/api/activity/route.ts exposes process-wide activity; /api/events exposes a process-wide event bus. Authentication alone does not isolate accounts.
2. app/api/settings/[section]/route.ts writes global filesystem settings before cloud updates. Most sections are not stored in the profile. Other accounts and fresh instances can observe inconsistent settings.
3. Extraction and agent tools still read/write a global filesystem graph. Fixing the canvas endpoint does not isolate these internal reads.
4. app/api/chats/[id]/stream uses an in-memory registry. A stream request routed to another Vercel instance cannot attach to the active turn.
5. Background jobs and extraction are process-local. after() cannot guarantee work beyond the function limit or recover a crashed job. Need persisted jobs, ownership/leases, retries and a worker execution path.
6. Supabase sync is largely fire-and-forget and errors are swallowed. Final-record persistence is not yet a verified durable commit.
7. Existing graph cloud rows omit provenance and aliases. Complete graph restoration and source/session labels need schema and sync changes.
8. Authenticated end-to-end tests with two independent users (including restart/reconnect, deletion, notebook assets, provider setup and actual model generation) have not passed.

Do not describe the existing Vercel link as fully functional or safely isolated for private multi-account testing until these blockers are resolved and the deployed build is verified.
