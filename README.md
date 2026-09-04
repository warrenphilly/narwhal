# Cinema

A laptop Jellyfin client with an Apple TV-style home screen. Browse your movie library, play titles in the browser, and download the original files to this computer.

## Run it

```bash
npm install
npm run dev -- --port 43123
```

Open [http://localhost:43123](http://localhost:43123).

## Connect your server

1. Run Cinema on the **same computer** as Jellyfin (or use a URL this computer can actually reach, such as a LAN IP, Tailscale name, or HTTPS domain). `localhost` inside the cloud preview is not your laptop.
2. Enter the Jellyfin address (example: `http://127.0.0.1:8096`).
3. If you use HTTPS with a homemade certificate, check **Allow self-signed certificate**.
4. Sign in, open a movie, and choose **Download to laptop**.

Chrome and Edge can ask where to save the file and show in-app progress. Other browsers send the file to the usual Downloads folder.

Your Jellyfin user needs the **Download** permission. In the Jellyfin dashboard: Users → your user → enable downloads (and allow the media to be downloaded).

This app talks to Jellyfin from your laptop through a local proxy, so the server does not need extra CORS setup.

## Preview without a server

Use **Preview the home screen** on the sign-in page to see the layout with sample titles. Sample titles cannot be downloaded or played.

## Production

```bash
npm run build
npm start -- --port 43123
```
