import { readFile } from "node:fs/promises";
import { config } from "./config.js";
import * as db from "./db.js";
import { gemini, parseJson } from "./gemini.js";
import { claude } from "./claude.js";
import { searchNews } from "./news.js";
import { sendMessage, downloadFile } from "./telegram.js";
import { SCORE_PROMPT, KEYWORDS_PROMPT, TRANSCRIBE_PROMPT, draftSystem, draftPrompt } from "./prompts.js";

const DIVIDER = "─────────────────────────────────";
const DECISION_RE = /^\s*(APPROVE|REJECT)\b/i;

export async function loadVoiceSkill() {
  const fromDb = await db.activeVoiceSkill().catch(() => null);
  if (fromDb) return fromDb;
  const fromFile = (await readFile(new URL("../voice-skill.txt", import.meta.url), "utf8")).trim();
  await db.saveVoiceSkill(fromFile).catch(() => {}); // seed the table on first run
  return fromFile;
}

export async function scoreNote(text) {
  const result = await gemini([{ text: SCORE_PROMPT + text }], { json: true, temperature: 0 });
  return { score: Math.max(0, Math.min(10, Math.round(Number(result.score) || 0))), reason: String(result.reason || "").trim() };
}

export async function findNewsAngle(text) {
  try {
    const { search_phrase } = await gemini([{ text: KEYWORDS_PROMPT + text }], { json: true, temperature: 0 });
    if (!search_phrase) return null;
    return await searchNews(search_phrase);
  } catch (err) {
    console.warn("News lookup failed, drafting without it:", err.message);
    return null;
  }
}

export async function writeDraft(text, news, voiceSkill, model = config.draftModel()) {
  const system = draftSystem(voiceSkill);
  const prompt = draftPrompt(text, news);
  const raw =
    model === "claude"
      ? parseJson(await claude(prompt, { system }))
      : await gemini([{ text: prompt }], { system, json: true, temperature: 0.7 });
  const post = String(raw.post || "").trim();
  if (!post) throw new Error("Draft model returned an empty post");
  return { post, usedNews: Boolean(news && raw.used_news) };
}

export function formatDraft(post, news, usedNews, label = "") {
  let out = label ? `${label}\n\n${post}` : post;
  if (usedNews && news) {
    out += `\n\n${DIVIDER}\nNEWS SOURCE: ${news.headline}\nFROM: ${news.source} · ${news.date}\nLINK: ${news.url}\n⚠ Check this before publishing — you are the author of this claim\n${DIVIDER}`;
  }
  return `${out}\n\nReply APPROVE or REJECT to this message.`;
}

async function noteText(message) {
  const media = message.voice || message.audio;
  if (media) {
    const audio = await downloadFile(media.file_id);
    const transcript = await gemini(
      [{ text: TRANSCRIBE_PROMPT }, { inline_data: { mime_type: media.mime_type || "audio/ogg", data: audio.toString("base64") } }],
      { temperature: 0 }
    );
    return { source: "voice", text: transcript };
  }
  return { source: "text", text: (message.text || message.caption || "").trim() };
}

// Entry point for every Telegram message/channel post.
export async function handleMessage(message) {
  const chatId = message.chat.id;
  const raw = (message.text || "").trim();

  if (/^\/(start|help)\b/.test(raw)) {
    await sendMessage(chatId, "Send me a note (text or voice). Notes that score 6+ come back as a LinkedIn draft in your voice. Reply APPROVE or REJECT to a draft to record your decision. Nothing is ever posted for you.\n\n/compare <note> drafts the same note with Gemini and Claude side by side.");
    return;
  }
  if (DECISION_RE.test(raw)) return handleDecision(message);

  const compare = raw.match(/^\/compare\s+([\s\S]+)/);
  const { source, text } = compare ? { source: "text", text: compare[1].trim() } : await noteText(message);
  if (!text) return;

  const note = await db.insertNote({ chat_id: chatId, telegram_message_id: message.message_id, source, content: text });
  if (!note) return; // already handled this message (Telegram retry)

  try {
    const { score, reason } = await scoreNote(text);
    const passed = score >= config.scoreThreshold();
    await db.updateNote(note.id, { score, score_reason: reason, status: passed ? "received" : "rejected" });

    if (!passed) {
      await sendMessage(chatId, `No draft: this note scored ${score}/10.\n${reason}`, message.message_id);
      return;
    }

    const [news, voiceSkill] = await Promise.all([findNewsAngle(text), loadVoiceSkill()]);
    const models = compare ? ["gemini", "claude"] : [config.draftModel()];

    for (const model of models) {
      const { post, usedNews } = await writeDraft(text, news, voiceSkill, model);
      const label = compare ? `[${model.toUpperCase()} DRAFT · note scored ${score}/10]` : `[Draft · note scored ${score}/10]`;
      const ids = await sendMessage(chatId, formatDraft(post, news, usedNews, label), message.message_id);
      await db.insertDraft({
        note_id: note.id,
        chat_id: chatId,
        content: post,
        model: model === "claude" ? config.claudeModel() : config.geminiModel(),
        used_news: usedNews,
        news_headline: usedNews ? news.headline : null,
        news_source: usedNews ? news.source : null,
        news_date: usedNews ? news.date : null,
        news_url: usedNews ? news.url : null,
        telegram_message_ids: ids,
      });
    }
    await db.updateNote(note.id, { status: "drafted" });
  } catch (err) {
    console.error("Pipeline failed:", err);
    await db.updateNote(note.id, { status: "error", error: String(err.message).slice(0, 1000) }).catch(() => {});
    await sendMessage(chatId, `Something went wrong with this note: ${err.message}`, message.message_id).catch(() => {});
  }
}

async function handleDecision(message) {
  const chatId = message.chat.id;
  const decision = message.text.match(DECISION_RE)[1].toUpperCase();
  const replyTo = message.reply_to_message?.message_id;

  const draft = replyTo ? await db.findDraftByMessage(chatId, replyTo) : await db.latestPendingDraft(chatId);
  if (!draft) {
    await sendMessage(chatId, replyTo ? "That message isn't a draft I know about." : "No pending draft to decide on. Reply directly to a draft with APPROVE or REJECT.", message.message_id);
    return;
  }

  const status = decision === "APPROVE" ? "approved" : "rejected";
  await db.updateDraft(draft.id, { status, decided_at: new Date().toISOString() });
  await sendMessage(
    chatId,
    status === "approved"
      ? "Marked approved. Nothing has been posted: copy it to LinkedIn and publish it yourself when you're ready."
      : "Marked rejected. The note and draft are kept so we can see what to improve.",
    message.message_id
  );
}
