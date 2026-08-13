# BroQuest

A fun family todo app for brothers, made to run on an **iPad Air (1st gen, 2013, iOS 12)**.

- One list per boy, each with their own avatar, colour, points, level and daily streak.
- Tick tasks off the fun way: confetti, sounds, a "+points" pop and avatar bounce.
- Optional **voice reminders**: give a task a time and the iPad speaks it aloud so nobody forgets. Tasks that are 30+ minutes overdue get reminded again (about once an hour).
- **Rewards**: parents set up a reward shop (spend points) and per-boy goals (reach a points target, parent awards it). Everything is voice-announced.
- Data **syncs between the iPad and the parent page** automatically. No accounts needed.

## Deploy on Netlify (recommended)

The repo is ready to deploy as-is. The `netlify/functions/state.js` function + `netlify.toml` redirect give you the API, and data persists in **Netlify Blobs** — so the iPad and any phone/laptop stay in sync over the internet.

1. Create the repo on GitHub and push this code (or drag the folder into Netlify Drop).
2. On netlify.com: **Add new site → Import an existing project → GitHub** and pick the repo.
   - Build command: *none* — leave it blank (it's pure static).
   - Publish directory: `.`
   - That's it — deploy. Your site gets an `https://your-site.netlify.app` URL.
3. On the iPad, open your Netlify URL. Optionally tap **Share → Add to Home Screen** so it opens full-screen like an app.
4. Tap anywhere once after loading — iOS needs that first tap to "unlock" the voice and sound.

Parent controls: `https://your-site.netlify.app/parent.html` (PIN **2468**, change it in Settings).

### Netlify Blobs quota

The free plan includes 5 GB of blob storage with the first 1 GB included — plenty for a family to-do list. Your data lives in the `broquest` store.

## Run locally instead (home server)

Works without any internet — handy if you prefer to keep it on your home Wi-Fi:

```sh
node server.js
```

It prints the addresses (uses `data.json` on disk for storage):

- Boys: `http://192.168.x.x:8080` (the iPad)
- Parent controls: `http://192.168.x.x:8080/parent.html`

The iPad must stay on the same Wi-Fi as that computer. If the server is off, the iPad keeps working from its last saved copy and re-syncs when it comes back.

## Fallback mode

If there's no API at all (e.g. you host just the static files somewhere with no Netlify function), the app falls back to storing data in the iPad's browser storage. Everything works — but the iPad and the parent page are then **separate** (each device keeps its own copy). Deploying on Netlify (or the local Node server) gives you shared, synced data.

## Using it

### Boys (iPad)
- **Add a Bro** (＋) → each boy picks an avatar and gets their own tab.
- **Add a quest**: type it, set points, optionally set a reminder time, make sure 🔊 is ticked. Done.
- **Tick off** → confetti, sound, points. Tap a completed task again to un-tick it.
- **Reward Shop**: the boy taps a reward to spend their points (voice announces it).
- **Goals**: the current goal shows on the boy's card; when reached the iPad announces "ask a parent to award it".

### Parents (`/parent.html`)
- **PIN gate** — default PIN is `2468` (change it in Settings).
- Manage **boys**, **quests** (add/complete/delete for any boy), the **reward shop**, per-boy **goals** (Award button when reached), and **settings** (voice/sound, PIN, reset).
- Changes appear on the iPad within a few seconds.

## Things to know (iPad Air 1 / iOS 12 limits)

- The iPad only announces while the page is open and the screen is on. Set **Settings → Display & Brightness → Auto-Lock → Never** so reminders keep coming.
- Voice is a single global switch; reminders only fire for quests that have a time set.

## Files

- `index.html` / `app.js` — boys' app (plain ES2017, iOS 12-safe)
- `parent.html` / `parent.js` / `parent.css` — parent controls
- `style.css` — shared dark-theme styling
- `server.js` — optional local zero-dependency web server + data API
- `netlify/functions/state.js` + `netlify.toml` — Netlify function API + blob storage
- `data.json` — local-server data (auto-created, gitignored)
