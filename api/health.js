import { missingConfig } from "../lib/config.js";
import { ping } from "../lib/db.js";

const EXPECTED = /TELEGRAM|GEMINI|SUPABASE|DRAFT|SCORE|CLAUDE|ANTHROPIC/;

export default async function handler(req, res) {
  const missing = missingConfig();
  let database = "not checked";
  if (!missing.includes("SUPABASE_URL") && !missing.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    database = await ping().then(() => "ok", (err) => `error: ${err.message}`);
  }
  const ok = missing.length === 0 && database === "ok";
  const body = { ok, missing_env: missing, database };
  if (missing.length) {
    // Names (JSON-quoted to expose stray whitespace) and value lengths only — never values.
    body.env_seen = Object.keys(process.env)
      .filter((k) => EXPECTED.test(k))
      .map((k) => `${JSON.stringify(k)}:${(process.env[k] || "").length}`);
  }
  res.status(ok ? 200 : 500).json(body);
}
