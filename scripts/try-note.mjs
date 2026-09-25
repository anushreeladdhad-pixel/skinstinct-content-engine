// Run the pipeline on a note locally, without Telegram or Supabase:
//   node --env-file=.env scripts/try-note.mjs "your note here"   [--model claude]
import { readFile } from "node:fs/promises";
import { scoreNote, findNewsAngle, writeDraft, formatDraft } from "../lib/pipeline.js";
import { config } from "../lib/config.js";

const args = process.argv.slice(2);
const mi = args.indexOf("--model");
const model = mi >= 0 ? args.splice(mi, 2)[1] : config.draftModel();
const note = args.join(" ").trim();
if (!note) {
  console.error('Usage: node --env-file=.env scripts/try-note.mjs "note text" [--model gemini|claude]');
  process.exit(1);
}

const { score, reason } = await scoreNote(note);
console.log(`SCORE ${score}/10 — ${reason}\n`);
if (score < config.scoreThreshold()) process.exit(0);

const news = await findNewsAngle(note);
console.log("NEWS:", news ? `${news.headline} (${news.source}, ${news.date})` : "none", "\n");
const voice = (await readFile(new URL("../voice-skill.txt", import.meta.url), "utf8")).trim();
const { post, usedNews } = await writeDraft(note, news, voice, model);
console.log(formatDraft(post, news, usedNews, `[${model} draft]`));
