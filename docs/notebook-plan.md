# Cognera Notebook — implementation plan for approval

## Goal

Add **Notebook** below Knowledge in the existing sidebar. Build a native Cognera
workspace inspired by OneNote's organization and writing tools. Existing learning,
practice, knowledge, account, and model workflows remain available.

## OneNote reference

Microsoft's [OneNote help](https://support.microsoft.com/en-us/onenote) groups its
core workflows into organization, notes, drawing, and sharing/sync. Its foundational
information hierarchy is notebook → section → page. Ink is editable content, not
just an image pasted into a text editor. The proposed first version implements
that hierarchy and both writing modes, with durable storage.

## Proposed first version

| Area | Behavior |
| --- | --- |
| Organization | Multiple notebooks, colored section tabs, page list; create, rename, move, reorder, and delete with confirmation. |
| Notes | Page title, formatted text, headings, lists, checklists, links, tables, and pasted/uploaded images. |
| Page layout | Place typed note blocks and handwriting on a shared page; zoom and pan without changing document coordinates. |
| Apple Pencil | Pressure-sensitive pen, colors, thickness, highlighter, eraser, undo/redo, and optional finger drawing. Default touch behavior supports navigation and palm rejection. |
| Paper | Plain, ruled, and grid backgrounds, useful for equations and diagrams. |
| Navigation | Search page titles and typed text; recently edited pages; restore the last open notebook/page. |
| Saving | Automatic saving, visible saving/saved/offline/error states, local recovery drafts, and retry after reconnect. |
| Account | Private Supabase records scoped to the authenticated user; notes follow the account across devices. |
| Conflicts | Version checks prevent a stale device from silently replacing newer work; keep a recoverable local draft on conflicts. |
| Export | Browser print/PDF and a downloadable page backup containing text and editable ink. |

## Interface

Desktop: compact notebook switcher, section tabs, page rail, and a generous paper
surface with a contextual Write/Draw toolbar. Use the existing Cognera theme and
typography; keep the paper readable without animated scenery behind handwriting.

iPad: collapsible navigation, larger touch targets, a compact floating drawing
toolbar, and separate pen-writing and touch-navigation behavior. Keep pen strokes
in document coordinates so rotating, zooming, and resizing preserve the work.
Small screens show one navigation level at a time rather than squeezing all rails.

## Storage and integration

- Add `/notebook` within the existing app shell and sidebar.
- Add explicit notebook, section, and page records with ownership, ordering,
  timestamps, version, structured text blocks, and vector ink strokes.
- Add a Supabase migration with foreign keys, indexes, and row-level ownership
  policies. Use private storage and ownership policies for page images.
- Reuse authenticated server access. Validate ownership on every read/write,
  including parent-child relationships, moves, deletes, and uploaded assets.
- Store local recovery drafts in IndexedDB; never show a successful cloud save
  when the write failed. Bound asset sizes and validate imported content.
- Reuse pressure/coalesced-pointer handling from practice drawing, with notebook
  stroke persistence and undo/redo. Keep practice submission behavior unchanged.

## Acceptance checks

Exercise create/edit/reload, hierarchy moves and ordering, search, exports,
cross-account access denial, upload permissions, offline/reconnect recovery, stale
save conflicts, and deletion. Browser tests cover pen/touch separation, pressure,
eraser, undo/redo, zoom/rotation, and tablet/phone layouts. Physical iPad testing
remains necessary to verify real Apple Pencil palm rejection and Safari behavior.

## Beyond the first version

Full OneNote parity also includes live collaboration, sharing permissions, OCR and
handwriting search/conversion, ink-to-math, audio recording/transcription, PDF
annotation, advanced attachments, revision history, and Microsoft import/sync.
These are additional systems, not controls to display before they work. They
require separate implementation and validation; this plan does not claim them as
part of the first version above.

## Deployment condition

Cloud persistence is only ready after the database migration and private storage
policies are applied to the connected Supabase project and tested. A local-only
prototype is not a completed account-synced notebook.
