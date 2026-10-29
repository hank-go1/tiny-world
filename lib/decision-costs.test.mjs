import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateDecisionUsage } from './decision-costs.ts';

test('estimates the entire request and uses the selected engine rate when usage is unavailable', () => {
  const params = { state: 'world context', questions: { action: { instructions: 'Choose an activity' } } };
  const tokens = Math.ceil(JSON.stringify(params).length / 4);
  for (const [provider,rate] of [['openai',.10],['jev',.042]]) {
    const usage = estimateDecisionUsage(provider,params);
    assert.deepEqual(usage,{inputTokens:tokens,inputEstimated:true,costUsd:tokens*rate/1_000_000,costEstimated:true});
    assert.ok(estimateDecisionUsage(provider,{...params,questions:{}}).inputTokens < tokens);
  }
});
test('uses provider input tokens and reported charges, including a zero charge', () => {
  const usage = estimateDecisionUsage('jev',{}, {usage:{input_tokens:15281,output_tokens:3215,cost:.000641802}},200);
  assert.deepEqual(usage,{inputTokens:15281,inputEstimated:false,costUsd:.000641802,costEstimated:false});
  assert.equal(estimateDecisionUsage('jev',{}, {usage:{input_tokens:15281,cost:0}},200).costUsd,0);
  assert.equal(estimateDecisionUsage('jev',{}, {usage:{input_tokens:1_000_000,output_tokens:99999}},200).costUsd,.042);
});
test('OpenAI charges uncached input, cache reads and both cache-write durations once, with free output', () => {
  const usage = estimateDecisionUsage('openai',{}, {usage:{input_tokens:1_000_000,output_tokens:50000,input_tokens_details:{cached_tokens:200_000,cache_write_tokens:300_000,cache_write_tokens_details:{ttl_30m_tokens:200_000,ttl_12h_tokens:100_000}}}},200);
  assert.equal(usage.inputTokens,1_000_000);
  assert.equal(usage.inputEstimated,false);
  assert.equal(usage.costEstimated,true);
  assert.ok(Math.abs(usage.costUsd - .102) < 1e-12);
  assert.equal(estimateDecisionUsage('openai',{}, {usage:{input_tokens:1_000_000}},200).costUsd,.10);
});
test('rejections without usage cost zero; canceled and unanswered calls keep a finite estimate', () => {
  const params = {input:'The island'};
  for (const status of [400,401,402,403,422,429]) assert.deepEqual(estimateDecisionUsage('openai',params,{error:'rejected'},status),{inputTokens:0,inputEstimated:false,costUsd:0,costEstimated:false});
  for (const status of [undefined,null,200,502]) {
    const usage = estimateDecisionUsage('openai',params,null,status);
    assert.ok(usage.inputTokens > 0 && usage.costUsd > 0);
    assert.equal(usage.inputEstimated,true);
  }
  const invalid = estimateDecisionUsage('jev',params,{usage:{input_tokens:NaN,cost:-1}},200);
  assert.ok(Number.isFinite(invalid.costUsd) && invalid.costUsd > 0);
});
