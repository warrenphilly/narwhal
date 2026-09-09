# Narwhal

A laptop Jellyfin client with an Apple TV-style home screen. Browse your library, play titles, and download the original files to this computer.

**Cinema** is the web app. **Narwhal** is the same app in an Electron desktop window (native save dialogs for downloads). They share this repo — that is why a separate local Narwhal clone was missing later features. Use this folder for both.

## Run it on your laptop

From the project folder:

```bash
npm install
npm run dev
```

Desktop window (Narwhal):

```bash
npm run desktop
```

If you see `EADDRINUSE` / port 43147 already in use, an old Next process is still running. `npm run desktop` now picks a free port automatically. To clear the old one:

```bash
lsof -ti :43147 | xargs kill
```

Do **not** run `npm run dev` and `npm run desktop` at the same time unless you want two copies. Desktop starts its own web server.

Wait until the terminal says **Ready**. The desktop window opens on its own.

Browser-only: **http://127.0.0.1:3000** after `npm run dev`. That `ERR_CONNECTION_REFUSED` page means the browser opened `http://localhost` with no port.

Do not open `http://0.0.0.0`. From another phone/laptop on the same Wi‑Fi, use `http://YOUR-LAPTOP-IP:3000`.

To get this app on another computer: clone the GitHub repo, run `npm install`, then `npm run desktop`.

## Jellyseerr

Open **Jellyseerr** in the top bar. Paste your Jellyseerr URL and an API key from Jellyseerr → Settings → General. Discover rows match the Jellyseerr home page. Search to request more. Active Radarr/Sonarr transfers show in the left accordion.

## Mac app (DMG)

On a Mac with this repo:

```bash
# 1. Quit Narwhal completely (Cmd+Q)
# 2. Build a fresh disk image
npm install
npm run mac
```

That writes something like `dist/Narwhal-0.2.0-arm64.dmg`.

**Install / update your local copy:**

1. Quit Narwhal (Dock → Quit, or Cmd+Q).
2. Open the new `.dmg`.
3. Drag **Narwhal** onto **Applications** (replace the old one).
4. Eject the disk image.
5. Open **Applications → Narwhal** (first time: right-click → Open).

## Windows app

On a **Windows** PC with Node.js installed:

```bash
git clone https://github.com/warrenphilly/narwhal.git
cd narwhal
npm install
npm run win
```

Installer: `dist/Narwhal Setup 0.2.0.exe` (or similar). Run it to install.

> Building the Windows installer from a Mac usually fails. Use a Windows machine, or GitHub Actions once the release workflow is pushed.

## Browser / web version

Local:

```bash
npm install
npm run dist:web   # production build
npm start          # http://127.0.0.1:3000
```

Dev (hot reload): `npm run dev` → **http://127.0.0.1:3000**

### Host on Dockge (home server)

Run Narwhal on the **same LAN as Jellyfin** so phones and browsers can play.

1. Open Dockge → **Compose** → create a stack named `narwhal`.
2. Paste the contents of [`compose.yaml`](./compose.yaml) from this repo (or clone the repo into the stack folder and use `build: .`).
3. Click **Deploy** / **Update**. First build takes a few minutes (downloads Node + compiles the app).
4. On your phone (home Wi‑Fi), open `http://YOUR-SERVER-IP:3000`.
5. Sign in with Jellyfin, e.g. `http://10.88.111.25:8096`.

If Jellyfin runs on the **same Docker host**, you can also try `http://host.docker.internal:8096`.  
If Jellyfin is another Dockge stack, put both on one Docker network and use `http://jellyfin:8096` (match the real service name).

**Do not use the Vercel URL for home-LAN playback** — the cloud cannot reach `10.x` / `192.168.x` addresses.

### Deploy on Vercel

1. Push this repo to GitHub (already at `warrenphilly/narwhal`).
2. Go to [vercel.com/new](https://vercel.com/new) and import the **narwhal** repo.
3. Framework preset: **Next.js** (auto). Leave build settings default.
4. Click **Deploy**.
5. Open the `.vercel.app` URL Vercel gives you.

Or from this folder (after `npm i -g vercel`):

```bash
npx vercel
```

Use production: `npx vercel --prod`

**Notes for the hosted web app**

- Sign in with a Jellyfin URL your phone/browser can reach (Tailscale, public HTTPS, or LAN if you’re home).
- “Download to laptop” is best in the desktop app; the browser build still streams and browses fine.
- Cookies/sessions need HTTPS (Vercel provides that).

## GitHub releases

Pushing a tag like `v0.2.0` runs `.github/workflows/release.yml`, which builds:

- Mac `.dmg`
- Windows `.exe`
- Web `narwhal-web.tar.gz`

You can also run the workflow manually from the Actions tab.

## Connect Jellyfin on your LAN

1. In the Jellyfin dashboard, copy the server URL. On your home network that is usually `http://192.168.x.x:8096`.
2. Paste that into Cinema. Use `http://127.0.0.1:8096` only if Jellyfin is on **this same laptop**.
3. If Jellyfin uses a homemade HTTPS certificate, check **Allow self-signed certificate**.
4. Sign in, open a movie, and choose **Download to laptop**.

Your Jellyfin user needs the **Download** permission: Users → your user → enable downloads.

## Away from home

You have two doors to the same server:

1. **Public:** `https://jelly.watchwithwarren.uk` — Cloudflare Access (email code), then Jellyfin. A browser can do that. Cinema cannot type the email code.
2. **Private:** Tailscale — your laptop joins the same tailnet as the Jellyfin machine. No Cloudflare page.

**Use Tailscale for Cinema while you are out.**

1. Turn Tailscale on on this laptop (same account as the home machine).
2. In the Tailscale admin site, copy the Jellyfin machine’s address: `100.x.x.x` or `something.ts.net`.
3. In Cinema, use `http://THAT-ADDRESS:8096` (use `https` and the right port if you changed Jellyfin’s).
4. Click **Test tunnel**, then sign in with your Jellyfin username and password.

Do not paste a home `192.168…` address while you are away. Do not paste `jelly.watchwithwarren.uk` unless you also set up a Cloudflare Service Token (below).

## Cloudflare public URL (optional)

The email verification code is **Cloudflare Access**, sitting in front of Jellyfin. Cinema cannot open that webpage or type the code.

You can still test from a cafe if you can open the Cloudflare Zero Trust dashboard (that is on Cloudflare’s site, not your house):

1. Zero Trust → Access → Service Auth → **Create Service Token**. Copy the Client ID and Client Secret.
2. Open the Access application that protects your Jellyfin hostname. Add a policy that includes **Service Auth / Service Token** and select that token.
3. In Cinema, paste the public tunnel URL (`https://…`), then the Client ID and Client Secret. Click **Test tunnel**. You should see your Jellyfin server name.
4. Sign in with your normal Jellyfin username and password.

Other options:

- If you can receive the email once, finish it in a browser, then DevTools → Application → Cookies → copy `CF_Authorization` into Cinema. That cookie expires.
- You can add your current public IP as a temporary Access allow rule, then test without a token. Remove it when you get home.

## Preview without a server

Use **Preview the home screen** to see the layout with sample titles. Those cannot play or download.

## Production

```bash
npm run build
npm start
```

Then open http://127.0.0.1:3000.
