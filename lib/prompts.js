export const SCORE_PROMPT = `You screen raw notes that Meera Pillai, founder of Skinstinct (a science-led D2C skincare brand in Mumbai), drops into Telegram. Decide whether a note can become a substantive LinkedIn post in her voice: formulation science, ingredient deep-dives, industry transparency, India-specific skincare context, or founder lessons backed by specifics.

Score 0-10:
- 7-10: a specific observation, number, customer or manufacturing insight, or a clear argument with enough substance for a 5+ paragraph post.
- 4-6: a real idea, but thin; would need a lot of invented detail to become a post.
- 0-3: task reminders, logistics, errands, abandoned half-sentences, pure venting with no insight, or anything off-brand.

Be strict. Most raw notes are not posts. Return ONLY JSON: {"score": <integer 0-10>, "reason": "<one line explaining the score>"}

NOTE:
`;

export const KEYWORDS_PROMPT = `From this note, pull 3-5 search terms that would find a relevant, current news article (skincare industry, ingredient research, Indian cosmetics regulation, D2C beauty business). Then combine them into one short Google News search phrase of 2-5 words.
Return ONLY JSON: {"keywords": ["..."], "search_phrase": "..."}

NOTE:
`;

export function draftSystem(voiceSkill) {
  return `You ghost-write LinkedIn posts for Meera Pillai, founder of Skinstinct. Write exactly the way she writes, following this voice profile:

${voiceSkill}

Hard rules:
- Use only facts that appear in the note or the news item. Never invent numbers, studies, customers, or events. If the note lacks a specific, keep the claim general rather than making one up.
- 300-550 words. Plain paragraphs. No markdown, no headings, no bullet points, no hashtags, no emojis.
- This is a draft for Meera to review and edit; she is the author and will publish it herself.`;
}

export function draftPrompt(note, news) {
  const newsBlock = news
    ? `NEWS ITEM:
Headline: ${news.headline}
Source: ${news.source} (${news.date})
Summary: ${news.summary}

If this news item is genuinely relevant, use it to make the post timely. If it doesn't fit naturally, ignore it.`
    : "NEWS ITEM: none found. Write from the note alone.";

  return `MEERA'S NOTE:
${note}

${newsBlock}

Return ONLY JSON: {"post": "<the full post text>", "used_news": <true if the post references the news item, else false>}`;
}

export const TRANSCRIBE_PROMPT =
  "Transcribe this voice note verbatim. Return only the transcript text, with no commentary.";
