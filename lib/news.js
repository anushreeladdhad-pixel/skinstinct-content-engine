// Google News RSS: no key, no account.
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  return decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")).trim();
}

function decode(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

export async function searchNews(phrase) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(phrase)}+when:30d&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (content-engine)" } });
  if (!res.ok) throw new Error(`Google News ${res.status}`);
  const xml = await res.text();
  const item = xml.match(/<item>([\s\S]*?)<\/item>/)?.[1];
  if (!item) return null;

  const source = tag(item, "source");
  let headline = tag(item, "title");
  if (source && headline.endsWith(` - ${source}`)) headline = headline.slice(0, -(source.length + 3));
  const summary = decode(tag(item, "description").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const pub = tag(item, "pubDate");

  return {
    headline,
    source: source || "Unknown source",
    date: pub ? new Date(pub).toDateString() : "Unknown date",
    url: tag(item, "link"),
    summary: summary && !summary.startsWith(headline) ? summary.slice(0, 300) : headline,
  };
}
