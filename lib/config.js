function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

export const config = {
  telegramToken: () => env("TELEGRAM_BOT_TOKEN"),
  webhookSecret: () => env("TELEGRAM_WEBHOOK_SECRET"),
  // Comma-separated: the capture channel and/or the founder's private chat with the bot.
  allowedChatIds: () => env("TELEGRAM_CHAT_ID").split(",").map((id) => id.trim()).filter(Boolean),
  geminiKey: () => env("GEMINI_API_KEY"),
  geminiModel: () => env("GEMINI_MODEL", "gemini-flash-latest"),
  draftModel: () => env("DRAFT_MODEL", "gemini").toLowerCase(),
  anthropicKey: () => env("ANTHROPIC_API_KEY"),
  claudeModel: () => env("CLAUDE_MODEL", "claude-sonnet-5"),
  supabaseUrl: () => env("SUPABASE_URL").replace(/\/$/, ""),
  supabaseKey: () => env("SUPABASE_SERVICE_ROLE_KEY"),
  scoreThreshold: () => Number(env("SCORE_THRESHOLD", "6")) || 6,
};

export function missingConfig() {
  const required = {
    TELEGRAM_BOT_TOKEN: config.telegramToken(),
    GEMINI_API_KEY: config.geminiKey(),
    SUPABASE_URL: config.supabaseUrl(),
    SUPABASE_SERVICE_ROLE_KEY: config.supabaseKey(),
  };
  if (config.draftModel() === "claude") required.ANTHROPIC_API_KEY = config.anthropicKey();
  return Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
}
