# Notebook storage and verification

The Notebook route is `/notebook`, available below Knowledge in the app sidebar.
No model account is required for writing notes.

## Enable private cloud notebooks

1. Apply `supabase/migrations/20261116000000_notebook.sql` in the project's
   Supabase SQL editor (or with your normal migration deployment). The migration
   creates private notebook tables, a transactional save function, and the private
   `notebook-assets` bucket with ownership policies. Apply it once.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` using
   the existing account setup. The normal Supabase user session owns the notes;
   notebook endpoints do not use an administrator key or bypass row policies.
3. Sign in, create a notebook, type and draw, then reload. Confirm the status reads
   **Saved to your account**. Sign in on another device and verify the same pages.
4. Verify a second account cannot see the first account's notebooks or images.

If Supabase is configured but the migration is missing, the UI reports storage
unavailability. It does not fall back to shared local records. The migration has
been tested in an isolated PostgreSQL runtime with authenticated roles, row
policies, cross-user foreign keys, asset policies, and stale-write rollback.
That test does not apply the migration to the live Supabase project.

## Local desktop/development mode

With no Supabase configuration, notebooks save in `PATHS.data/notebook` (normally
`data/notebook`, or below `LH_DATA_DIR` when set). The UI explicitly reads **Saved
on this computer**. These records do not sync between devices. Do not use this
single-user mode as a shared public deployment.

The browser keeps recovery drafts in IndexedDB, scoped to the signed-in account
or the local workspace. Last-selected pages are remembered on that browser.
Recovery can fail in restricted/private browsing or when storage is full; the UI
reports that condition. Keep the tab open or export a backup before leaving if a
save has failed. Sign out on shared devices; recovery is browser-local storage.

## Conflicts and backups

Saves carry an expected version. A stale device is refused, preserving its local
draft. Export that draft with **Backup**, then choose **Reload saved copy** to
continue from the newer version. Backups include structured text, editable vector
ink, and embedded image bytes. **Restore** replaces the current notebook library
after confirmation. It uploads images into the current account's private storage.

**Print / PDF** prints the current page with text, ink, images, and paper pattern.
Use the browser's Save as PDF destination. The canvas has no fixed paper edges;
print fits the content bounds onto A4 with light paper and print-safe ink colors.
Zoom changes the view, not saved stroke
positions. Existing notes retain their original coordinates and light paper;
new notes start on dark paper. Paper appearance is adjustable in the palette.

Use two fingers to pan and pinch to zoom, or select Hand to drag with a mouse.
Trackpad/Ctrl-wheel zoom, zoom buttons, and Fit content are also available. The
view is remembered per page and device. Camera changes do not rewrite your notes.

## Checks

```sh
npm run typecheck
NODE_ENV=test npx tsx --test tests/notebook.test.ts tests/notebook-database.test.ts
```

Browser coverage should run against a disposable local workspace:

```sh
LH_DATA_DIR=/tmp/cognera-notebook-test npx next dev -p 3012
NOTEBOOK_TEST_URL=http://localhost:3012 node tests/browser/notebook.mjs
NOTEBOOK_TEST_URL=http://localhost:3012 node tests/browser/notebook-canvas.mjs
```

Leave Supabase variables unset for that local browser test. It creates test notes,
uploads an image, exercises offline recovery and conflicts, downloads a backup,
and checks PDF generation and responsive layouts. Set `CHROMIUM_PATH` if Chromium
is not at `/usr/bin/chromium`.

Browser pointer tests do not replace physical iPad/Safari checks. Confirm Apple
Pencil pressure, palm rejection, finger scrolling, and toolbar reachability on a
real tablet before claiming hardware certification. Finger drawing is opt-in.
