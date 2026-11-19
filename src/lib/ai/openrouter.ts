/**
 * Minimale OpenRouter-client (server-only). Native fetch, gestructureerde JSON-output.
 * Gratis modellen: 20 verzoeken/minuut en 50/dag (1000/dag na eenmalig $10 tegoed).
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/free';
const TIMEOUT_MS = 45_000;

export type ChatMessage = { role: 'system' | 'user'; content: string };

export type JsonSchema = Record<string, unknown>;

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Haalt de eerste JSON-waarde uit modeltekst (ook als die in ```json ... ``` staat). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.search(/[[{]/);
    const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new Error('AI-antwoord bevat geen geldige JSON');
  }
}

export async function chatJson(
  messages: ChatMessage[],
  schemaName: string,
  schema: JsonSchema,
): Promise<{ data: unknown; model: string | null }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is niet geconfigureerd');
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': 'Conference Tracker',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = (await res.json().catch(() => null)) as {
    model?: string;
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  } | null;
  if (!res.ok) {
    const reason = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429)
      throw new Error(`AI-limiet bereikt (${reason}); probeer het later opnieuw`);
    throw new Error(`AI-verzoek mislukt: ${reason}`);
  }
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Leeg AI-antwoord');
  return { data: extractJson(content), model: body?.model ?? model };
}
