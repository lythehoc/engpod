# engpod 🎧

small step every day

`engpod` is a friendly, phone-ready English listening library with 365 short
podcast lessons, transcripts, vocabulary notes, and a player that remembers
where you stopped.

![engpod preview](public/og.png)

## Highlights

- Tap any episode to play, then resume later from the saved position
- Search, sort, shuffle, filter, and group 365 lessons by level
- Read transcripts and vocabulary while saving your playback preferences
- Private, account-free, and comfortable on desktop or mobile

## Run locally

Install Node.js 24 or newer:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality checks

The `tests` folder contains automated regression checks for the episode
catalog, transcripts, player behavior, mobile layout, and GitHub Pages output.
GitHub Actions runs these checks before publishing, and the folder itself is
not part of the deployed website.

```bash
npm run lint
npm test
```

## Credits

Episode metadata and transcripts were adapted from
[huynhthientung/english-pod](https://github.com/huynhthientung/english-pod).
Audio is served by
[Internet Archive](https://archive.org/details/englishpod_all).
The motivational tagline uses
[Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand), distributed
under the included [SIL Open Font License](public/fonts/PatrickHand-OFL.txt).
