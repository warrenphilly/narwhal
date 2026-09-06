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

## Away from home (Cloudflare tunnel)

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
