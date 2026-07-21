# LabMaster AI

An interactive, gamified AI tutor for **Medical Laboratory Science (MLS)** students.
It teaches Clinical Chemistry, Hematology & Urinalysis, Microbiology, Immunology, and
Immunohematology (Blood Banking) through a conversational "professor" chat, auto-generated
clinical case exercises with AI grading, and a RAG study library where students upload
their own notes (PDF / DOCX / TXT / images) to ground the tutoring.

Built with **React 19 + Vite + Tailwind v4** on the frontend and an **Express API** powered
by **Google Gemini (`gemini-3.5-flash`)**, deployable to **Vercel** as serverless functions.

---

## Architecture

```
Browser (SPA)                     Vercel
┌───────────────────────┐        ┌──────────────────────────────────────┐
│ React app (dist/)     │──GET──▶│ Static hosting  → dist/index.html      │
│  App.tsx + components │        │                                        │
│  localStorage state   │─/api/─▶│ Serverless fn   → api/index.ts (Express)│
└───────────────────────┘        │   ├─ /api/status                        │
                                  │   ├─ /api/parse-file  (pdf-parse/mammoth)│
                                  │   ├─ /api/chat        ┐                  │
                                  │   ├─ /api/generate-exercise ├─ Gemini    │
                                  │   └─ /api/grade-exercise    ┘  (or offline│
                                  │                                fallback)  │
                                  └──────────────────────────────────────┘
```

- **Single Express app, one serverless function.** `api/index.ts` exports the Express
  app; `vercel.json` rewrites all `/api/*` traffic to it. The same app is reused by
  `server.ts` for local dev and standalone hosting, so route logic never diverges.
- **Graceful degradation.** Every AI endpoint has a built-in offline fallback (preset
  clinical cases, rule-based grading, canned professor responses). With no API key the
  app runs fully in **simulation mode**.

## Project layout

```
api/index.ts        Express app (all /api routes) — deployed as a Vercel function
server.ts           Local dev + standalone entry (reuses api/index.ts)
vercel.json         Vercel build + routing config
src/                React SPA (App.tsx, components/, types.ts)
vite.config.ts      Vite + Tailwind config
.env.example        Environment variable template
```

## Run locally

**Prerequisites:** Node.js 18+.

```bash
npm install
cp .env.example .env          # then edit .env and set a real GEMINI_API_KEY (optional)
npm run dev                   # http://localhost:3000
```

Without a real key the app still runs — in simulation mode.

Useful scripts:

| Command             | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Local dev server (Express + Vite middleware, HMR)    |
| `npm run build`     | Build the frontend to `dist/` (Vercel uses this)     |
| `npm start`         | Standalone production server (serves `dist/` + API)  |
| `npm run typecheck` | `tsc --noEmit` type check                            |

## Deploy to Vercel (CLI)

1. **Install the CLI and log in**
   ```bash
   npm i -g vercel
   vercel login
   ```

2. **From the project root, link & deploy a preview**
   ```bash
   vercel
   ```
   Accept the prompts (scope, link to new project, keep defaults). Vercel auto-detects
   the Vite framework and uses the build/routing settings in `vercel.json`.

3. **Add your Gemini key** (skip only if you're fine staying in simulation mode)
   ```bash
   vercel env add GEMINI_API_KEY production
   # paste your key when prompted; repeat for `preview` / `development` if wanted
   ```
   (You can also set it under **Project → Settings → Environment Variables** in the dashboard.)

4. **Ship to production**
   ```bash
   vercel --prod
   ```
   After it finishes, open the printed URL and check `/<url>/api/status` — it should
   report `"engine": "Gemini 3.5 Flash"` once the key is set (or `"Local Lab Engine"`
   in simulation mode).

> Alternatively, push this repo to GitHub and click **Import Project** in the Vercel
> dashboard — same result, with automatic deploys on every push.

## Environment variables

| Variable         | Required | Notes                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------- |
| `GEMINI_API_KEY` | For live AI | Get one at https://aistudio.google.com/app/apikey. Absent ⇒ simulation mode. |

## Known limitations & next steps

These are deliberate for this demo build — flagged honestly rather than hidden:

- **Authentication is not real (demo mode).** The login screen accepts any
  email/password after a simulated delay and stores the "user" in `localStorage`.
  There is no backend session, no password check, and no per-user data isolation. A
  visible banner tells users not to enter a real password. *Next step:* wire up a real
  provider (Supabase Auth, Clerk, or Auth.js) and move progress/state server-side.
- **All user data lives in `localStorage`.** Progress, chat history, and uploaded study
  materials are per-browser and per-device — clearing site data wipes everything, and
  nothing syncs across devices. *Next step:* add a database (e.g. Postgres/Supabase).
- **Upload size is capped by the platform.** Vercel limits a serverless request body to
  ~4.5 MB. Since files are sent as base64 (which inflates size by ~33%), large PDFs may
  be rejected before parsing. *Next step:* upload to object storage and parse from a URL,
  or chunk large files.
- **AI latency vs. function timeout.** Long RAG-grounded generations can be slow; the
  function `maxDuration` is set to 60s in `vercel.json` (the Hobby-plan ceiling). Very
  large study contexts may still time out. *Next step:* stream responses and/or trim RAG
  context more aggressively.
- **Cost is unbounded.** There are no per-user rate limits or spend caps on the Gemini
  calls. *Next step:* add rate limiting and usage quotas before any public launch.

## What changed to make this Vercel-ready

- Converted the persistent `app.listen()` Express server into a **serverless function**
  (`api/index.ts` exports the app; `vercel.json` routes `/api/*` to it).
- Fixed **PDF parsing**, which was broken against the pinned `pdf-parse@2.x` (the code
  used the old 1.x default-export API; migrated to the `PDFParse` class).
- Raised the Express JSON body limit from the 100 KB default so base64 file/image
  uploads aren't rejected.
- Added a **demo-mode disclosure** on the login screen.
