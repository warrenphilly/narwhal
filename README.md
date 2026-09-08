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

## Mac app

```bash
npm install
npm run mac
```

That builds `Narwhal.app` with the Narwhal logo and copies it to **Applications**. Open it from Launchpad, Spotlight, or the Applications folder. The first launch may ask macOS to allow an unsigned app: right-click → Open.

Dev window (no install): `npm run desktop`.

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
