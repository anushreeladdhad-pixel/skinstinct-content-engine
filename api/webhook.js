import { waitUntil } from "@vercel/functions";
import { config } from "../lib/config.js";
import { handleMessage } from "../lib/pipeline.js";
import { sendMessage } from "../lib/telegram.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const secret = config.webhookSecret();
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(401).json({ ok: false });
  }

  const update = req.body || {};
  // Channel posts arrive as channel_post, not message. Checking only .message silently ignores every note.
  const message = update.channel_post || update.message;
  const allowed = config.allowedChatId();

  if (message && (!allowed || String(message.chat.id) === allowed)) {
    // Acknowledge Telegram immediately so it doesn't retry; keep processing in the background.
    waitUntil(handleMessage(message).catch((err) => console.error("Unhandled:", err)));
  } else if (message?.chat?.type === "private") {
    console.warn("Ignored private chat", message.chat.id);
    waitUntil(
      sendMessage(message.chat.id, "I only read notes posted in your capture channel. Post this note there and the draft will come back in the channel.").catch(() => {})
    );
  }
  return res.status(200).json({ ok: true });
}
