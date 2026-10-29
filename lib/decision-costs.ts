import type { DecisionProvider } from './creature-decisions';

export type DecisionUsage = { inputTokens: number; inputEstimated: boolean; costUsd: number; costEstimated: boolean };

// USD per million tokens, checked 2026-10-28. Decisions output is free for both engines.
// https://developers.openai.com/api/docs/guides/decisions#pricing-and-availability
// https://developers.openai.com/api/docs/pricing (gpt-6-luna cache reads/writes)
// https://openrouter.ai/typesafe/jev-1.13
const inputRates = { openai: .10, jev: .042 };
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

export function estimateDecisionUsage(provider: DecisionProvider, params: unknown, response?: unknown, status?: number | null): DecisionUsage {
  const usage = record(record(response).usage);
  const inputEstimated = !nonnegative(usage.input_tokens);
  // A rough text-only estimate including the world, history, instructions and all questions.
  const inputTokens = inputEstimated ? Math.ceil(JSON.stringify(params).length / 4) : usage.input_tokens as number;
  if (nonnegative(usage.cost)) return { inputTokens, inputEstimated, costUsd: usage.cost, costEstimated: false };
  // Rejected requests without usage are not counted as model spend.
  if (inputEstimated && status !== undefined && status !== null && status >= 400 && status < 500) return { inputTokens: 0, inputEstimated: false, costUsd: 0, costEstimated: false };
  let cost = inputTokens * inputRates[provider];
  if (provider === 'openai' && !inputEstimated) {
    const details = record(usage.input_tokens_details), writes = record(details.cache_write_tokens_details);
    const cached = nonnegative(details.cached_tokens) ? Math.min(details.cached_tokens, inputTokens) : 0;
    const written = nonnegative(details.cache_write_tokens) ? Math.min(details.cache_write_tokens, inputTokens - cached) : 0;
    const longWrites = nonnegative(writes.ttl_12h_tokens) ? Math.min(writes.ttl_12h_tokens, written) : 0;
    cost = (inputTokens - cached - written) * .10 + cached * .01 + (written - longWrites) * .125 + longWrites * .25;
  }
  return { inputTokens, inputEstimated, costUsd: cost / 1_000_000, costEstimated: true };
}
