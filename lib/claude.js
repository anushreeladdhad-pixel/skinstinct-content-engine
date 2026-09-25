import { config } from "./config.js";

export async function claude(prompt, { system, maxTokens = 2000 } = {}) {
  if (!config.anthropicKey()) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.anthropicKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.claudeModel(),
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
