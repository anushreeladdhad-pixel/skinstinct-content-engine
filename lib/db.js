import { config } from "./config.js";

async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${config.supabaseUrl()}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: config.supabaseKey(),
      // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys go in apikey only.
      ...(config.supabaseKey().startsWith("eyJ") ? { Authorization: `Bearer ${config.supabaseKey()}` } : {}),
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`Supabase ${res.status}: ${data?.message || text}`);
    err.code = data?.code;
    throw err;
  }
  return data;
}

// Returns the new note, or null if this Telegram message was already processed (webhook retry).
export async function insertNote(note) {
  try {
    const [row] = await rest("notes", { method: "POST", body: note, prefer: "return=representation" });
    return row;
  } catch (err) {
    if (err.code === "23505") return null; // unique violation
    throw err;
  }
}

export async function updateNote(id, fields) {
  await rest(`notes?id=eq.${id}`, { method: "PATCH", body: fields });
}

export async function insertDraft(draft) {
  const [row] = await rest("drafts", { method: "POST", body: draft, prefer: "return=representation" });
  return row;
}

export async function updateDraft(id, fields) {
  const rows = await rest(`drafts?id=eq.${id}`, { method: "PATCH", body: fields, prefer: "return=representation" });
  return rows[0];
}

export async function findDraftByMessage(chatId, messageId) {
  const rows = await rest(
    `drafts?chat_id=eq.${chatId}&telegram_message_ids=cs.%7B${messageId}%7D&limit=1`
  );
  return rows[0] || null;
}

export async function latestPendingDraft(chatId) {
  const rows = await rest(`drafts?chat_id=eq.${chatId}&status=eq.pending&order=created_at.desc&limit=1`);
  return rows[0] || null;
}

export async function activeVoiceSkill() {
  const rows = await rest("voice_skill?is_active=eq.true&order=created_at.desc&limit=1");
  return rows[0]?.content || null;
}

export async function saveVoiceSkill(content) {
  await rest("voice_skill?is_active=eq.true", { method: "PATCH", body: { is_active: false } });
  await rest("voice_skill", { method: "POST", body: { content, is_active: true } });
}

export async function ping() {
  await rest("voice_skill?select=id&limit=1");
}
