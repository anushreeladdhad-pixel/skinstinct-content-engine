import { missingConfig } from "../lib/config.js";
import { ping } from "../lib/db.js";

export default async function handler(req, res) {
  const missing = missingConfig();
  let database = "not checked";
  if (!missing.includes("SUPABASE_URL") && !missing.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    database = await ping().then(() => "ok", (err) => `error: ${err.message}`);
  }
  const ok = missing.length === 0 && database === "ok";
  res.status(ok ? 200 : 500).json({ ok, missing_env: missing, database });
}
