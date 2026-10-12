import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { CREDIT_INFERENCE_VERSION } from "../_shared/credit-inference.ts";

// Mantener esta lista en sincronía con supabase-js evita que nuevos encabezados
// del cliente (por ejemplo x-client-info) bloqueen el preflight del navegador.
const headers = { ...corsHeaders, "Content-Type": "application/json" };

function providerFor(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) return "bandcamp";
  if (host === "open.spotify.com" || host.endsWith(".spotify.com")) return "spotify";
  if (host === "soundcloud.com" || host.endsWith(".soundcloud.com")) return "soundcloud";
  return "manual";
}

const MAX_REDIRECTS = 2;
const MAX_RESPONSE_BYTES = 1_000_000;

function allowedHost(url: URL, provider: string) {
  const host = url.hostname.toLowerCase();
  if (provider === "bandcamp") return host === "bandcamp.com" || host.endsWith(".bandcamp.com");
  if (provider === "spotify") return host === "open.spotify.com" || host.endsWith(".spotify.com");
  if (provider === "soundcloud") return host === "soundcloud.com" || host.endsWith(".soundcloud.com");
  return false;
}

async function boundedFetch(source: URL, provider: string, accept: string) {
  let next = source;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (next.protocol !== "https:" || !allowedHost(next, provider)) throw new Error("blocked host");
    const response = await fetch(next, { redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "User-Agent": "DiscoticaEditorial/1.0", Accept: accept } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("redirect limit");
      next = new URL(location, next);
      continue;
    }
    if (!response.ok) throw new Error(`source status ${response.status}`);
    if (Number(response.headers.get("content-length") || "0") > MAX_RESPONSE_BYTES) throw new Error("response too large");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("empty response");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error("response too large");
      chunks.push(value);
    }
    const joined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(joined);
  }
  throw new Error("redirect limit");
}

function meta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i")) ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"));
  return match?.[1]?.replaceAll("&amp;", "&");
}

function decodeHtmlAttribute(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function bandcampMetadata(html: string) {
  const attribute = html.match(/\bdata-tralbum="([\s\S]*?)"/i)?.[1];
  if (!attribute) return null;
  try {
    const data = JSON.parse(decodeHtmlAttribute(attribute));
    const current = data?.current ?? {};
    const date = current.release_date ? new Date(current.release_date) : null;
    return {
      title: typeof current.title === "string" ? current.title : undefined,
      artists: typeof current.artist === "string" && current.artist.trim() ? [current.artist.trim()] : [],
      type: current.type === "track" ? "Single" : current.type === "album" ? "Álbum" : undefined,
      release_date: date && !Number.isNaN(date.valueOf()) ? date.toISOString().slice(0, 10) : undefined,
      review: typeof current.about === "string" ? current.about.trim() : undefined,
    };
  } catch (error) {
    console.error("Could not parse Bandcamp data-tralbum", error);
    return null;
  }
}

export default { fetch: async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return Response.json({ error: "Service unavailable" }, { status: 503, headers });
  const client = createClient(url, key, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401, headers });
  let source: URL;
  try { source = new URL(String((await req.json())?.url ?? "")); } catch { return Response.json({ error: "A valid URL is required" }, { status: 400, headers }); }
  if (source.protocol !== "https:") return Response.json({ error: "Only HTTPS sources are accepted" }, { status: 400, headers });
  const provider = providerFor(source);
  // No arbitrary server-side fetch: unsupported sources stay manual, avoiding SSRF.
  if (provider === "manual") return Response.json({ provider, source_available: false, credit_inference_version: CREDIT_INFERENCE_VERSION }, { headers });
  try {
    if (provider === "spotify") {
      const data = JSON.parse(await boundedFetch(new URL(`https://open.spotify.com/oembed?url=${encodeURIComponent(source.href)}`), provider, "application/json"));
      return Response.json({ provider, title: data.title, artists: data.author_name ? [data.author_name] : [], structured_author: data.author_name, cover_url: data.thumbnail_url, source_available: true, credit_inference_version: CREDIT_INFERENCE_VERSION }, { headers });
    }
    if (provider === "soundcloud") {
      const data = JSON.parse(await boundedFetch(new URL(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(source.href)}`), provider, "application/json"));
      return Response.json({ provider, title: data.title, artists: data.author_name ? [data.author_name] : [], structured_author: data.author_name, cover_url: data.thumbnail_url, source_available: true, credit_inference_version: CREDIT_INFERENCE_VERSION }, { headers });
    }
    const html = await boundedFetch(source, provider, "text/html");
    const parsed = bandcampMetadata(html);
    return Response.json({
      provider,
      title: parsed?.title ?? meta(html, "og:title"),
      artists: parsed?.artists ?? [],
      structured_author: parsed?.artists?.[0],
      type: parsed?.type,
      release_date: parsed?.release_date,
      review: parsed?.review,
      cover_url: meta(html, "og:image"),
      source_available: true,
      credit_inference_version: CREDIT_INFERENCE_VERSION,
    }, { headers });
  } catch (error) {
    console.error("Could not inspect release source", error);
    return Response.json({ provider, source_available: false, credit_inference_version: CREDIT_INFERENCE_VERSION }, { headers });
  }
} };
