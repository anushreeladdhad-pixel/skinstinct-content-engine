# Building Skinstinct Content Engine with Claude Code

This file is written **for an AI coding agent** (Claude Code, or similar) that a person has
pointed at this repo and asked to "build/deploy this for me." If you are that agent: read this
whole file first, then follow it top to bottom. **Ask the user one question at a time** at each
numbered checkpoint below — don't ask everything up front, and don't skip a checkpoint because
it "seems optional." Wait for their answer before moving to the next step. If a step fails,
show them the actual error, don't guess silently.

If you are a human reading this directly: hand this whole file to your Claude Code (or
equivalent) session and say "follow this guide, ask me what you need as we go."

---

## What this project is

Telegram note → score (reject if weak) → optional news angle → draft in the founder's voice →
sent back to Telegram → human replies APPROVE/REJECT → Supabase record updated. **Nothing
auto-publishes, ever** — approval only flips a database row. If you're tempted to wire up
auto-posting to LinkedIn/anywhere, don't — that's a deliberate design constraint, not a
missing feature.

---

## Before you start — ask the user this first

Ask, and wait for an answer before doing anything else:

> "This build needs five things set up: a Telegram bot + private channel, a Gemini API key,
> optionally an Anthropic API key, a Supabase project, and a place to deploy (Vercel). Do you
> already have any of these, or are we starting from zero on all of them?"

Use their answer to skip steps they've already done. Otherwise, go in order.

---

## Step 1 — Telegram bot + capture channel

Ask the user to do this themselves (you cannot do it for them — it needs their phone):

1. Open Telegram, message **@BotFather**, send `/newbot`, follow the prompts. They'll get back
   a **bot token** (format `123456789:AA...`). Ask them to paste it to you.
2. They create a **private channel** (not a group) — this is the capture inbox.
3. They add the bot as **Administrator** of that channel.
4. They post any message in the channel — this is required before you can look up the chat ID.

Once they confirm step 4, fetch the chat ID yourself:

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

Look for a `channel_post` entry; `chat.id` (a negative number starting `-100`) is the chat ID.
If the result is `{"ok":true,"result":[]}`, the bot likely isn't admin yet, or they haven't
posted since being added — tell them exactly that, don't guess further.

**Known trap:** channel posts arrive in the webhook payload as `update.channel_post`, **not**
`update.message`. If you're reviewing or writing webhook code, handle both:
```js
const message = update?.channel_post || update?.message;
```
A webhook that only checks `update.message` will silently return 200 OK and do nothing for
every real note — no error, just silence. This bit us in the original build; don't repeat it.

**Also:** a message sent *by the bot itself* (e.g. via `sendMessage`, for testing) does **not**
generate a webhook update. To test the pipeline, the note must be posted from the user's own
Telegram account/app, not by you calling the Bot API on their behalf.

---

## Step 2 — API keys

Ask for these one at a time, not all at once:

**Gemini** (required — used for scoring + keyword extraction, and for drafting if `DRAFT_MODEL=gemini`):
> "Go to https://aistudio.google.com/ → Get API key → Create API key. Paste it here."

**Anthropic** (optional — only needed if drafting will use Claude):
> "Do you want drafts written by Claude or by Gemini? If Claude, get a key from
> https://console.anthropic.com/ → API Keys."
If they say Gemini-only, skip this and make sure `DRAFT_MODEL=gemini` gets set later — don't
leave it defaulted to `claude` with no Anthropic key, or drafting will throw on every note.

**Before you hardcode any model name**, verify it's actually live for their key — model names
get deprecated faster than you'd expect. Don't trust a model ID from an older doc, tutorial, or
your own training data. Check with:
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=<GEMINI_KEY>" \
  | grep -A1 '"name"' | grep generateContent -B1
```
Then confirm your chosen model actually answers:
```bash
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/<MODEL>:generateContent?key=<GEMINI_KEY>" \
  -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"Say OK"}]}]}'
```
Prefer the `-latest` aliases (e.g. `gemini-flash-latest`, `gemini-pro-latest`) over a pinned
version number — Google rotates pinned model IDs out from under you, and the aliases don't
break when that happens.

---

## Step 3 — Supabase project

Ask:
> "Do you have an existing Supabase project you want to reuse, or should we create a new one?
> A new one keeps this app's data separate from anything else — recommended unless you have a
> reason to share."

If creating new: have them do it via https://supabase.com/dashboard → New project (pick any
org, name, region, DB password). It's free-tier and takes ~2 minutes. If you have Supabase MCP
tool access and hit a "cost confirmation" error trying to create a project programmatically,
don't fight it — this dashboard path is faster and just as valid.

Once they give you the project's URL and **`service_role`** secret key (Settings → API — NOT
the `anon`/publishable key), run `supabase/schema.sql` against it (via SQL editor, migration
tool, or `execute_sql` if you have DB access). Confirm the three tables (`notes`, `drafts`,
`voice_skill`) exist afterward — don't assume the migration succeeded silently.

If reusing an existing project, list its tables first and flag it to the user if it already has
unrelated tables, so they can decide instead of you deciding for them.

---

## Step 4 — Push the code and deploy

1. If this repo isn't already on the user's GitHub, ask whether to create a new repo (public or
   private — flag that this repo may contain a business's voice/content strategy, so private is
   usually the safer default) and push it.
2. Exclude anything that isn't app code from the repo (e.g. a case-study writeup docx) — add it
   to `.gitignore` rather than committing it.
3. Import the repo into Vercel (a new project linked to the GitHub repo, so pushes auto-deploy).
4. Set every variable from `.env.example` as a Vercel environment variable — **encrypted type**,
   all three targets (production/preview/development). Generate a random
   `TELEGRAM_WEBHOOK_SECRET` yourself (e.g. `openssl rand -hex 16`) rather than asking the user
   to invent one.
5. Trigger a deployment and wait for `READY` state before moving on — don't set the webhook
   against a still-building deployment.
6. Sanity-check the deployment before touching Telegram:
   ```bash
   curl -s https://<deployment-url>/api/health
   ```

---

## Step 5 — Point Telegram at the deployment

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<deployment-url>/api/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
Expect `{"ok":true,"result":true,...}`. If not, show the user the actual response — don't
paraphrase it away.

---

## Step 6 — Test it for real

Tell the user (don't do this step yourself):
> "Post a real, substantial note in your capture channel now — something with a specific detail
> or number, not just a test word like 'hi'. Within about 30–90 seconds you should get back
> either a draft ending in 'Reply APPROVE or REJECT to this message', or a rejection with a
> one-line reason."

While waiting, you can check progress by querying the `notes` and `drafts` tables directly
(faster and more reliable than `getUpdates`, which is blocked once a webhook is active).
Processing can genuinely take 60–100 seconds end to end (scoring + news lookup + drafting are
all separate model calls) — don't conclude something is broken after only 10–15 seconds.

If nothing shows up after ~2 minutes, check runtime error logs for the deployment before
guessing — a wrong model name, a missing env var, and a silently-ignored `update.message` vs
`update.channel_post` mismatch all fail differently, and the logs will tell you which.

Once a draft arrives, have the user reply `APPROVE` or `REJECT` under that specific message, and
confirm the corresponding row in `drafts` flips to `approved`/`rejected` with a `decided_at`
timestamp.

---

## Step 7 — Wrap-up checklist

Read this back to the user at the end:

- [ ] GitHub repo created/updated and pushed
- [ ] Vercel project deployed, env vars set, `/api/health` returns 200
- [ ] Supabase schema applied, tables confirmed
- [ ] Telegram webhook set, `getWebhookInfo` shows the right URL
- [ ] A real note was sent, scored, and (if it passed) drafted
- [ ] APPROVE/REJECT confirmed to update Supabase, not any external platform

Do not consider the build "done" until every one of these has been verified with a real check
(a curl call, a DB query, a log read) — not assumed from the deploy succeeding.
