# Cinema

A laptop Jellyfin client with an Apple TV-style home screen. Browse your movie library, play titles in the browser, and download the original files to this computer.

## Run it

```bash
npm install
npm run dev -- --port 43123
```

Open [http://localhost:43123](http://localhost:43123).

## Connect your server

1. Enter the Jellyfin address (example: `http://192.168.1.20:8096` or a HTTPS URL).
2. Sign in with a Jellyfin username and password.
3. Open a movie and choose **Download to laptop**.

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
