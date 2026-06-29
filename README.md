# Interview Studio — AI English Interview Coach

A free, browser-based mock-interview app: pick a role + interviewer, the digital
human asks questions out loud, you answer by voice, and you get a summary.

## Files (main code and question data are kept separate)

```
index.html                     ← structure + styles (cosmic theme, light-up tiles)
app.js                         ← app logic (flow, voice, recording, report)
avatar.js                      ← the "digital human" layer (photo + optional 3D)
interview_question_bank.json   ← ALL questions/interviewers/rounds — edit this only
assets/                        ← interviewer photos
```

You update the **question bank** by editing one JSON file. No code changes.

---

## 1. Run / deploy (GitHub Pages — free, no backend)

1. Put all files (keep the folder structure) in your repo root.
2. Repo → **Settings → Pages** → Source = your branch (`main`) / root.
3. Open the Pages URL. Done. Works on phone + desktop.
   *Tip:* the microphone needs **https** (GitHub Pages is https, so you're fine).

To test locally, you must use a server (not file://), because the app fetches JSON:
```
python3 -m http.server 8000     # then open http://localhost:8000
```

## 2. Update the question bank (anytime)

Open `interview_question_bank.json`:

```json
"questions": {
  "marketing": {
    "round1": [
      { "id": "m1_1", "text": "Your new question here?", "scenario": "short label" }
    ]
  }
}
```

- Add/remove items in any `roundN` array — the app picks randomly each session.
- Add international questions under `"international"` (used when the toggle is on).
- Change interviewers under `"interviewers"` (name, title, accent, photo).
- Commit + push. The live app updates on next load.

---

## 3. The digital human: three tiers (pick what fits your budget)

Real mouth **lip-sync + expressions** does not come free *and* photoreal *and*
without a server — you choose two. Here is the honest map:

| Tier | Look | Lip-sync | Cost | Hosting |
|---|---|---|---|---|
| **A. Photo (default, shipped)** | photoreal still | head-bob + glow + synced word caption (no fake mouth) | free | GitHub Pages |
| **B. 3D avatar (built-in, opt-in)** | Ready Player Me 3D head | real jaw/viseme morphs per spoken word | free | GitHub Pages |
| **C. Photoreal talking video** | real video of the photo talking | frame-accurate | paid API **or** self-hosted GPU | needs a server |

### Tier B — turn on the 3D avatar (free, real lip movement)
1. Build a head at https://readyplayer.me → copy its `.glb` URL.
2. In `interview_question_bank.json`, set that interviewer's `"model"`:
   ```json
   { "id":"david", ... , "model":"https://models.readyplayer.me/XXXX.glb" }
   ```
   `avatar.js` auto-appends `?morphTargets=ARKit,Oculus+Visemes` so the mouth works.
3. Reload. If WebGL/model fails for any reason it silently falls back to the photo.
4. **Test locally first** — 3D depends on the device GPU.

> Browser TTS only reports *word* boundaries, so the 3D jaw is a believable
> approximation. For frame-perfect visemes, drive the avatar from a TTS that
> returns viseme timings (Google Cloud TTS / Azure / ElevenLabs) — that needs a
> small backend (see §4) to hold the API key.

### Tier C — photoreal talking face (paid or GPU)
- **Hosted APIs:** D-ID, HeyGen, Simli, or **Mascot Bot** stream a talking video
  from a photo + text. You call them from a backend (to hide the key) and show
  the returned video/stream in `#avatarHost`.
- **Self-hosted (the PunithVT/ai-avatar-system style):** MuseTalk / SadTalker
  give photoreal lip-sync from a photo but need a **GPU server** (not free, not
  GitHub Pages). Good for a portfolio demo, overkill for a public free app.

---

## 4. Optional AI feedback (the full "closed loop")

GitHub Pages is static, so it can't safely hold your `GEMINI_API_KEY`. To add the
Gemini-powered evaluation your AI Studio export already implements, add a tiny
**serverless function** and point the app at it:

**Loop:** client (this app) → POST answers → serverless `/api/evaluate` (holds the
key, calls Gemini) → returns JSON feedback → client renders it.

1. Deploy a free serverless endpoint that holds `GEMINI_API_KEY` and runs the
   `/api/evaluate` logic from your AI Studio `server.ts`. Free options:
   - **Cloudflare Workers** (free tier) — recommended, fast, simple
   - **Vercel / Netlify Functions** (free tier)
   - or keep the AI Studio **Cloud Run** deployment you already have
2. Enable CORS on it for your Pages domain.
3. In `app.js`, set:
   ```js
   const EVAL_ENDPOINT = "https://your-worker.workers.dev/api/evaluate";
   ```
4. Leave it `""` to stay 100% free — the app shows a solid local summary instead.

### Recommended architecture for your goals
- **Frontend:** this app on GitHub Pages (free).
- **Avatar:** Tier B (free 3D) for "flexible digital interviewer" — no per-question
  baking, so it works with any question-bank update automatically.
- **Backend (optional):** one free Cloudflare Worker for Gemini feedback.
- Upgrade to Tier C only if you specifically want a photoreal talking face.
