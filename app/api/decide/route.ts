import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { creatureRequestSchema, buildCreatureApiCall, buildCreatureCallTrace, normalizeOpenAICreatureResponse, readCreatureWorld } from '@/lib/creature-decisions';

export async function GET() {
  const keys = env as Record<string, unknown>;
  return Response.json({ configured: Boolean(keys.OPENROUTER_API_KEY), providers: { jev: Boolean(keys.OPENROUTER_API_KEY), openai: Boolean(keys.OPENAI_API_KEY) } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const parsed = creatureRequestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'Enter a valid scene instruction of up to 1,000 characters.' }, { status: 400 });
  const body = parsed.data, openai = body.provider === 'openai', label = openai ? 'OpenAI Decisions' : 'Jev';
  const keys = env as Record<string, string>;
  const apiKey = openai ? keys.OPENAI_API_KEY : body.apiKey || keys.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: openai ? 'Add OPENAI_API_KEY to the server configuration first.' : 'Connect your OpenRouter API key first.' }, { status: 400 });
  const start = performance.now();
  const call = buildCreatureApiCall(body);
  let rawResponse: unknown = null, upstreamStatus: number | null = null;
  const trace = () => buildCreatureCallTrace(call, rawResponse, upstreamStatus, Math.round(performance.now() - start), [keys.OPENAI_API_KEY, keys.OPENROUTER_API_KEY, body.apiKey].filter((key): key is string => Boolean(key)));
  try {
    const response = await fetch(call.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(call.params),
      signal: AbortSignal.timeout(20000),
    });
    upstreamStatus = response.status;
    const responseText = await response.text();
    try { rawResponse = JSON.parse(responseText); } catch { rawResponse = responseText; }
    if (!response.ok) return Response.json({ error: response.status === 401 || response.status === 403 ? `${label} rejected the key or access. Check the server configuration.` : response.status === 402 ? `${label} needs credits.` : response.status === 429 ? `${label} is rate limited. Wait a moment, then try again.` : `${label} is unavailable (HTTP ${response.status}). Your scene is unchanged.`, trace: trace() }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    const result = readCreatureWorld(openai ? normalizeOpenAICreatureResponse(rawResponse) : rawResponse);
    const completedTrace = trace();
    return Response.json({ ...result, provider: body.provider, latency: completedTrace.latency, trace: completedTrace }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof z.ZodError || error instanceof Error && error.message === 'invalid' ? `${label} returned an incomplete decision. Retry; your scene is unchanged.` : `Could not reach ${label}. Check your connection and try again.`, trace: trace() }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
