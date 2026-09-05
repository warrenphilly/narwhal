# Cinema

A laptop Jellyfin client with an Apple TV-style home screen. Browse your movie library, play titles in the browser, and download the original files to this computer.

## Run it on your laptop

From the project folder:

```bash
npm install
npm run dev
```

Wait until the terminal says **Ready**. Then open this **exact** address:

**http://127.0.0.1:3000**

That `ERR_CONNECTION_REFUSED` / “localhost refused to connect” page means the browser opened `http://localhost` with no port (port 80). Cinema is on **3000**, so include the port.

Do not open `http://0.0.0.0`. From another phone/laptop on the same Wi‑Fi, use `http://YOUR-LAPTOP-IP:3000`.

## Connect Jellyfin on your LAN

1. In the Jellyfin dashboard, copy the server URL. On your home network that is usually `http://192.168.x.x:8096`.
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

Then open http://127.0.0.1:3000.
