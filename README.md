# Airplane Mode

Airplane Mode is an easy-to-use and easy-to-edit HTTP cache that keeps a copy of anything you load through it, so you can keep working when a site is slow, changing or offline.

## Developing

This app runs as an Electron desktop app. Use Node 24 (`nvm use`; SvelteKit 3 needs Node >= 22.17).

```sh
npm run dev       # SvelteKit dev server (with HMR) inside an Electron window
npm run dev:web   # SvelteKit dev server in the browser only
```

- `src/` is the SvelteKit app, including server routes such as `src/routes/api/health/+server.js`
- `electron/main/` is the Electron main process; `electron/preload/` exposes `window.electron` to the app

In dev, Electron serves the app on the configured port (3000 by default) and passes requests through to
the Vite dev server on 5173, so hot reloading works and the port can be changed from the settings page just
like in the built app. Dev settings live in `.dev/config.json`; `PORT=4000 npm run dev` overrides them.

## Building and distributing

```sh
npm run build     # main + preload into out/, SvelteKit SPA into build/
npm run preview   # run the built app in Electron
npm run dist      # build and package installers into dist/ (see electron-builder.yml)
npm run dist:mac  # or dist:win / dist:linux for a specific platform
```

The SvelteKit app is built with `adapter-node`, and the Electron main process runs that server, so server
routes, `$lib/server` and the database all work. The Electron window and any browser use the same HTTP server.

### Website

`www/` is the marketing website: a single static HTML page and stylesheet, with no build step. Run
`npm run serve:www` to serve it at `http://localhost:8080`, or deploy the directory as-is to any static host. It isn't part of the app
build. The download buttons point to `www/downloads/` with electron-builder's file names, so upload the files
from `dist/` there (or change the links) with each release.

The app's About page and the website both show the version from `package.json`. Change it with `npm version`
(e.g. `npm version minor`), which also updates the version and download file names in `www/index.html`
through `scripts/sync-www-version.js`. After editing the version by hand, run `node scripts/sync-www-version.js`.

### Server settings

The app listens on `127.0.0.1:3000` by default. Settings are read in this order:

1. `--port` / `--host` command-line flags, e.g. `"Airplane Mode.app/Contents/MacOS/Airplane Mode" --port=4000`
2. `PORT` / `HOST` environment variables
3. `config.json` in the app's data directory (created on first run; on macOS
   `~/Library/Application Support/airplane-mode/config.json`, next to the cache database `app.db`. Earlier
   versions used `airplane-mode-gui`; the first launch moves that directory to the new name.)

The port can also be changed on the Settings page (`/settings`, or **Settings…** / ⌘, in the app menu); the server moves to the
new port right away. Editing `config.json` by hand does the same while the app is running.

If the saved port is already in use when the app starts (for example by another dev server), the app
moves to the next free port, saves it to `config.json` and shows a notification. A port set with
`--port` or `PORT` is left as is. The Settings page won't save a port that's already in use.

Set `host` to `0.0.0.0` to make the server reachable from other machines on the network.
The SQLite database defaults to `app.db` in the same directory unless `DATABASE_URL` is set.

### Sharing the macOS app

macOS only opens downloaded apps without complaint when they're signed with an Apple Developer ID and
notarized by Apple. Without one, `npm run dist:mac` signs the app "ad-hoc" (see `electron-builder.yml`),
so someone you send it to will be told it's from an unidentified developer. They can open it once by
trying to open it, then going to **System Settings → Privacy & Security** and clicking **Open Anyway**.
If an older build says the app "is damaged", run this once in Terminal and then open it:

```sh
xattr -cr "/Applications/Airplane Mode.app"
```

The build is for Apple Silicon Macs only; for Intel Macs too, set the dmg target's `arch` to
`[arm64, x64]` (or `universal`) in `electron-builder.yml`.

To sign and notarize properly (no warnings for anyone):

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) and create a
   **Developer ID Application** certificate; install it in your login keychain.
2. In `electron-builder.yml`, remove `identity: '-'` under `mac` and add `notarize: true`.
3. Build with your Apple account details in the environment:

   ```sh
   APPLE_ID=you@example.com \
   APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx \
   APPLE_TEAM_ID=ABCDE12345 \
   npm run dist:mac
   ```

   The app-specific password comes from [account.apple.com](https://account.apple.com) → Sign-In
   and Security → App-Specific Passwords.

## Caching proxy

`/c/<url>` fetches `<url>` once and serves the stored response from SQLite afterwards. Paste the URL
as-is, with or without the scheme; without one it's fetched over https:

- `http://127.0.0.1:3000/c/https://www.jeremiak.com`
- `http://127.0.0.1:3000/c/jeremiak.com`

Percent-encoded URLs work too, and old `/api/cache/<url>` links redirect to `/c/<url>`.

Pages opened this way in a browser are fully cached: proxied HTML gets a small script that installs a
service worker (`static/cache-sw.js`), which routes the page's CSS, images, fonts, scripts, `fetch()`
calls and links through `/c/` as well. The first visit reloads once while the service worker
takes over. Redirects are cached and followed through the proxy.

Any HTTP method works, and responses are cached per method and URL. Request headers and bodies are
forwarded. The `x-cache` response header is `MISS` on the first request and `HIT` afterwards. 5xx
responses are passed through but not cached.

The admin page at `/` lists every cached response with its headers and when it was stored. Removing one
makes the next request fetch and cache a fresh copy. The list updates live as responses are cached or
removed, through a server-sent events stream at `/api/cache-events`. The same stream feeds the
**Request log**, a collapsible panel listing each request as it happens (served from the cache, fetched and
cached, fetched live, bypassed or failed) and each edit. The server keeps the last 300 events in
memory.

From the admin page you can also:

- **Edit** a stored response's status, headers and text content. Edited responses are marked **Edited** in the
  list until they're removed.
- **Upload a file** to serve instead of a stored response's content, with the file's own content type. The cached
  content is kept: **Remove file** serves it again. Responses serving a file are marked **File** in the list.
- **Clear cache** to remove every stored response at once
- **Add to cache** from the button at the end of the status strip, on any page: it stores one URL right away,
  or opens it through `/c/` in your browser so everything the page loads is cached too
- Add **bypass prefixes** on the Settings page: requests to URLs starting with one of them are always fetched live
  and never stored (`x-cache: BYPASS`), e.g. `https://www.googleadservices.com/pagead`
- Choose the **Appearance** on the Settings page: Light (a paper flight chart), Dark (the cockpit display) or
  System default, which follows the computer's light or dark setting

In the built app, the admin page and everything else outside `/c/` and `/api/` is only visible in the Electron
window. The app creates a random token at startup that only the Electron window sends, and other
browsers get a 403. `/c/...` and `/api/...` stay open to any browser. In `npm run dev` every page is open, so
the admin page can be used in a browser while developing.

After changing `src/lib/server/db/schema.js`, run `npm run db:generate` to add a migration in `drizzle/`.
Migrations are applied automatically when the server starts.
