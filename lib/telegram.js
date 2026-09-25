import { config } from "./config.js";

const MAX_LEN = 4000; // Telegram's hard limit is 4096

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${config.telegramToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description}`);
  return data.result;
}

// Sends text, splitting on paragraph boundaries if it's too long. Returns every message id sent.
export async function sendMessage(chatId, text, replyTo) {
  const chunks = [];
  let current = "";
  for (const para of text.split("\n\n")) {
    const next = current ? `${current}\n\n${para}` : para;
    if (next.length > MAX_LEN && current) {
      chunks.push(current);
      current = para;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  const ids = [];
  for (const [i, chunk] of chunks.entries()) {
    const msg = await call("sendMessage", {
      chat_id: chatId,
      text: chunk.slice(0, 4096),
      link_preview_options: { is_disabled: true },
      ...(i === 0 && replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
    });
    ids.push(msg.message_id);
  }
  return ids;
}

export async function downloadFile(fileId) {
  const file = await call("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${config.telegramToken()}/${file.file_path}`);
  if (!res.ok) throw new Error(`Could not download Telegram file (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
