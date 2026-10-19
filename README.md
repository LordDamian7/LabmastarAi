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
Browser (SPA)                       Vercel                                   Supabase
┌──────────────────────────┐       ┌───────────────────────────────────┐    ┌────────────────────────┐
│ React app (dist/)        │─GET──▶│ Static hosting → dist/index.html  │    │ Auth (email/password)  │
│  supabase-js ────────────┼───────┼───────────────────────────────────┼───▶│ Postgres + RLS         │
│   sign-in, progress,     │       │                                   │    │  user_progress         │
│   chat history, uploads  │       │ Serverless fn → api/index.ts      │    │  chat_messages         │
│                          │─/api/▶│  (Express, Bearer token required) │───▶│  study_materials       │
└──────────────────────────┘       │  ├─ /api/status                   │    │  ai_usage (quotas)     │
                                   │  ├─ /api/materials (parse upload) │    │ Storage: study-materials│
                                   │  ├─ /api/chat  (streamed)   ┐     │    └────────────────────────┘
                                   │  ├─ /api/generate-exercise  ├ Gemini (or offline fallback)
                                   │  └─ /api/grade-exercise     ┘     │
                                   └───────────────────────────────────┘
```

- **Real accounts.** Supabase Auth handles sign-up (with email confirmation), sign-in and
  password reset. The API verifies the user's access token on every route except `/api/status`.
- **Per-user data in Postgres.** Progress, chat history and study materials are stored in
  Supabase, protected by row-level security so a user can only ever read or write their own
  rows. The API uses the same public key as the browser and acts *as the user*, so RLS
  applies there too — there is no service-role key anywhere.
- **Uploads bypass the function size limit.** The browser uploads files directly to a
  private Supabase Storage bucket (`<userId>/…`, up to 20 MB); `/api/materials` then
  downloads, parses and stores the extracted text.
- **Bounded, streamed AI calls.** Chat replies stream to the browser as they're generated.
  Instead of sending whole documents, the server picks the most relevant ~40k characters of
  excerpts (keyword-scored chunks) plus at most 3 images and the last 20 chat turns.
- **Per-user rate limits.** Each AI call is recorded in `ai_usage`; users get
  `AI_HOURLY_LIMIT` (default 40) calls per hour and `AI_DAILY_LIMIT` (default 150) per day,
  enforced atomically in Postgres (`consume_ai_quota`).
- **Graceful degradation.** Every AI endpoint has a built-in offline fallback (preset
  clinical cases, rule-based grading, canned professor responses). With no Gemini key the
  app runs fully in **simulation mode** (sign-in is still required).

## Project layout

```
api/index.ts        Express app (all /api routes) — deployed as a Vercel function
server.ts           Local dev + standalone entry (reuses api/index.ts)
supabase/migrations Database schema, RLS policies, quota function, storage bucket
vercel.json         Vercel build + routing config
src/                React SPA (App.tsx, components/, lib/, types.ts)
vite.config.ts      Vite + Tailwind config
.env.example        Environment variable template
```

## Run locally

**Prerequisites:** Node.js 18+.

```bash
npm install
cp .env.example .env          # Supabase values are pre-filled; add a GEMINI_API_KEY (optional)
npm run dev                   # http://localhost:3000
```

Without a Gemini key the app still runs — in simulation mode. To use a different Supabase
project, apply `supabase/migrations/*.sql` to it and update the two `VITE_SUPABASE_*` values.

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

3. **Add environment variables**
   ```bash
   vercel env add VITE_SUPABASE_URL production
   vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
   vercel env add GEMINI_API_KEY production   # skip to stay in simulation mode
   # paste your key when prompted; repeat for `preview` / `development` if wanted
   ```
   (You can also set it under **Project → Settings → Environment Variables** in the dashboard.)

4. **Ship to production**
   ```bash
   vercel --prod
   ```

5. **Point Supabase Auth at your site.** In Supabase → Authentication → URL Configuration,
   set **Site URL** to your production URL (and add preview URLs to **Redirect URLs**), so
   confirmation and password-reset emails link back to the app instead of `localhost`.
   After it finishes, open the printed URL and check `/<url>/api/status` — it should
   report `"engine": "Gemini 3.5 Flash"` once the key is set (or `"Local Lab Engine"`
   in simulation mode).

> Alternatively, push this repo to GitHub and click **Import Project** in the Vercel
> dashboard — same result, with automatic deploys on every push.

## Environment variables

| Variable                        | Required    | Notes                                                                 |
| ------------------------------- | ----------- | --------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Yes         | Supabase project URL. Public; used by the browser and the API.        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes         | Supabase publishable key. Public; data is protected by RLS.           |
|                                 |             | *Alternatively*, the names set by Vercel's Supabase integration (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `_PUBLISHABLE_KEY`) are picked up automatically. The integration's service-role key is not used. |
| `GEMINI_API_KEY`                | For live AI | Get one at https://aistudio.google.com/app/apikey. Absent ⇒ simulation mode. |
| `AI_HOURLY_LIMIT`               | No          | Per-user AI calls per rolling hour (default 40).                      |
| `AI_DAILY_LIMIT`                | No          | Per-user AI calls per rolling day (default 150).                      |

## Known limitations & next steps

- **No global spend cap.** Quotas are per user, and anyone can sign up (email confirmation
  slows down throwaway accounts but doesn't stop them). Set a budget alert on the Gemini
  API key in Google Cloud, and consider CAPTCHA on sign-up (Supabase Auth → Attack
  Protection) before a public launch.
- **Retrieval is keyword-based.** Excerpts are picked by term overlap, not semantic
  embeddings. Good enough for focused notes; *next step:* pgvector embeddings in Supabase.
- **Supabase's free plan email sender is rate-limited** (a few emails per hour). Configure
  custom SMTP in Supabase before inviting a class.
- **Streaming on Vercel** relies on Node.js function response streaming. Very long answers
  are still bounded by `maxDuration` (60s on Hobby).

## What changed to make this Vercel-ready

- Converted the persistent `app.listen()` Express server into a **serverless function**
  (`api/index.ts` exports the app; `vercel.json` routes `/api/*` to it).
- Fixed **PDF parsing**, which was broken against the pinned `pdf-parse@2.x` (the code
  used the old 1.x default-export API; migrated to the `PDFParse` class).
- Replaced demo login and `localStorage` state with **Supabase Auth + Postgres**; existing
  browser progress is imported on a user's first sign-in.
- Moved uploads to **Supabase Storage** (no more base64 request bodies), **streamed** chat
  replies, bounded RAG context, and added **per-user AI quotas**.
- Fixed progress updates overwriting each other (an exercise's XP, score and badge could be
  lost when goal counters updated right after) and the Blood Bank badge never unlocking.
