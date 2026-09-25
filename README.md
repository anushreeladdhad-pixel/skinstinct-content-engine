# Skinstinct Content Engine

Telegram note → score (0–10, below 6 is rejected with a reason) → news angle from Google News → draft in
Meera's voice → back to Telegram → Meera replies **APPROVE** / **REJECT** → Supabase row updated.

**Nothing auto-publishes, ever.** Approval only flips a database row. Meera publishes to LinkedIn herself.
That is the Cut (check 07, Judgment Protected), not a missing feature.

| Step | Where |
| --- | --- |
| Webhook (text, voice notes, channel posts) | `api/webhook.js` |
| Scoring, keywords, drafting, APPROVE/REJECT | `lib/pipeline.js`, prompts in `lib/prompts.js` |
| Voice profile | `voice-skill.txt` (copied into the `voice_skill` table on first run) |
| News | `lib/news.js` (Google News RSS, no key) |
| Memory | `supabase/schema.sql` |
| Health check | `GET /api/health` |

## In Telegram
- Any note, as text or voice, gets scored and possibly drafted.
- Reply `APPROVE` or `REJECT` to a draft to record the decision.
- `/compare <note>` drafts the same note with Gemini and Claude side by side (needs `ANTHROPIC_API_KEY`).

## Setup
Follow `BUILD_WITH_CLAUDE_CODE.md`. In short: copy `.env.example` to `.env`, apply `supabase/schema.sql`,
deploy to Vercel with the same env vars, then set the webhook:

    https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<app>.vercel.app/api/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>

Try a note locally without Telegram or Supabase:

    npm install
    node --env-file=.env scripts/try-note.mjs "your note" --model gemini
