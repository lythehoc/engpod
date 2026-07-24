# engpod 🎧

Listen. Read. Repeat.

`engpod` is a friendly, phone-ready English listening library with 365 short
podcast lessons, transcripts, vocabulary notes, and a player that remembers
where you stopped.

![engpod preview](public/og.png)

## Highlights

- Pick an episode and it starts playing immediately
- Search, sort, shuffle, filter, and group lessons by level
- Resume the last episode from the saved position
- Remember loop, autoplay-next, transcript, speed, volume, and display settings
- Read local transcripts and vocabulary notes
- Use comfortably on desktop and mobile browsers
- Keep everything private in browser storage; no account or analytics

## Run locally

Install Node.js 22 or newer:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Audio

Audio streams from the public Internet Archive `englishpod_all` collection.
The player uses two direct HTTPS media nodes and automatically falls back to the
collection download URL if one is unavailable.

For offline development, download all 365 MP3 files:

```bash
npm run download:audio
```

The complete library is approximately 2.26 GiB. Local audio is intentionally
excluded from Git.

## Credits

Episode metadata and transcripts were adapted from
[huynhthientung/english-pod](https://github.com/huynhthientung/english-pod).
Audio is served by
[Internet Archive](https://archive.org/details/englishpod_all).

This is an independent educational project. It is not affiliated with or
endorsed by EnglishPod.
