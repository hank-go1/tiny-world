import { env } from 'cloudflare:workers';
import { buildTownDecisionRequest, readTownReply, townChatRequest } from '@/lib/town/decisions';

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ error: 'Please enter a town instruction.' }, { status: 400 }); }
  const parsed = townChatRequest.safeParse(raw);
  if (!parsed.success) return Response.json({ error: 'Use an instruction of up to 1,000 characters, then try again.' }, { status: 400 });
  const apiKey = (env as Record<string, string>).OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: 'The town needs an OpenAI API key in its local environment. Restart the preview after adding it.' }, { status: 503 });
  const started = performance.now();
  try {
    const upstream = await fetch('https://api.openai.com/v1/decisions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildTownDecisionRequest(parsed.data)), signal: AbortSignal.timeout(25000),
    });
    if (!upstream.ok) {
      const message = upstream.status === 401 ? 'OpenAI rejected the API key. Check the saved key.'
        : upstream.status === 403 ? 'This API project does not have access to Decisions.'
        : upstream.status === 429 ? 'OpenAI could not accept this request. Check API credits or limits, then try again.'
        : upstream.status === 404 ? 'The Decisions endpoint or model is unavailable for this API project.'
        : `OpenAI could not complete the decisions (HTTP ${upstream.status}). Try again.`;
      return Response.json({ error: message }, { status: 502 });
    }
    let reply;
    try { reply = readTownReply(await upstream.json(), parsed.data.closed); }
    catch { return Response.json({ error: 'OpenAI returned incomplete or unsupported decisions. Please try again.' }, { status: 502 }); }
    return Response.json({ ...reply, latency: Math.round(performance.now() - started), model: 'gpt-6-luna' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Could not reach OpenAI in time. Check your connection and try again.' }, { status: 502 });
  }
}
