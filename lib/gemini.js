import { config } from "./config.js";

// parts: array of Gemini content parts, e.g. [{ text }] or [{ inline_data: { mime_type, data } }]
export async function gemini(parts, { system, json = false, temperature = 0.4 } = {}) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel()}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.geminiKey() },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: "user", parts }],
        generationConfig: { temperature, ...(json ? { responseMimeType: "application/json" } : {}) },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!text) throw new Error(`Gemini returned no text (finishReason: ${data.candidates?.[0]?.finishReason})`);
  return json ? parseJson(text) : text;
}

export function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);
  }
}
