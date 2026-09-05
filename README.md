# Cinema

A laptop Jellyfin client with an Apple TV-style home screen. Browse your movie library, play titles in the browser, and download the original files to this computer.

## Run it on your laptop

From the project folder:

```bash
npm install
npm run dev
```

When the terminal says it is ready, open **http://127.0.0.1:43123** — not `0.0.0.0`, and not port 3000.

`npm run dev` now always uses port **43123** and listens on your laptop’s network interfaces, so you can also open `http://YOUR-LAPTOP-IP:43123` from another device on the same Wi‑Fi.

## Connect Jellyfin on your LAN

Cinema and Jellyfin should both be reachable from the computer running Cinema.

1. In the Jellyfin dashboard, copy the server URL. On your home network that is usually `http://192.168.x.x:8096` (the PC or NAS that hosts Jellyfin).
2. Paste that into Cinema. Use `http://127.0.0.1:8096` only if Jellyfin is on **this same laptop**.
3. If Jellyfin uses a homemade HTTPS certificate, check **Allow self-signed certificate**.
4. Sign in, open a movie, and choose **Download to laptop**.

Your Jellyfin user needs the **Download** permission: Users → your user → enable downloads.

## Preview without a server

Use **Preview the home screen** to see the layout with sample titles. Those cannot play or download.

## Production

```bash
npm run build
npm start
```

Then open http://127.0.0.1:43123.
