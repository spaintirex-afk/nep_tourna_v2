# Nep Tourna — Global synchronization

Nep Tourna uses the Express server database as the single source of truth. Admin mutations are written to the server database and broadcast through `/api/events`; every browser then refetches `/api/state`. A 3-second polling fallback also refetches state while a page is visible.

## Production requirement

The production backend must use **one persistent shared database** for every user worldwide. Do not deploy separate isolated SQLite files per user, country, browser, or server instance.

If the hosting provider runs more than one backend instance, the database must be on a shared persistent volume or the app must be migrated to a shared database service (for example PostgreSQL). SSE is only a live-update transport; it is not the database.

Recommended environment variables:

- `PORT` — server port
- `HOST` — defaults to `0.0.0.0`
- `DATA_DIR` — persistent directory containing the SQLite database
- `DB_FILE` — persistent SQLite database path
- `DIST_DIR` — built frontend directory

## Global data

The following admin changes are global because `/api/state` reads them from the central database:

- tournaments
- tournament registrations
- matches
- results
- published announcements
- settings
- user-facing notifications

Admin-only data remains role-scoped by `server/state.js`.


## Important deployment rule

The ZIP includes a local SQLite database for development. In production, set `DATA_DIR`/`DB_FILE` to a persistent location shared by the single backend service. If the host uses multiple application instances or ephemeral filesystems, configure a shared PostgreSQL database (or a shared persistent SQLite volume) before going live. The browser must never be the source of shared tournament data.

A unique database constraint also prevents the same player from being registered twice for the same tournament.
