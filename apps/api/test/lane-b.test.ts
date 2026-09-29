import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALPHA_API_PATHS, ALPHA_RESPONSE_META } from '@zugrio/alpha-api-contract';
import { SharedEntryEngine, buildLaneBValidationFrame } from '@zugrio/decision-core';
import { startApi, type RunningApi, postJson } from './helpers.js';
describe('Lane B read-only engine validation API',()=>{
 let api:RunningApi;beforeAll(async()=>{api=await startApi();});afterAll(async()=>api?.close());
 it('lists named fabricated scenarios',async()=>{const r=await api.request(ALPHA_API_PATHS.engineValidationScenarios());expect(r.status).toBe(200);expect(r.body.meta).toEqual(ALPHA_RESPONSE_META);expect(r.body.data).toHaveLength(9);});
 it('returns exact deterministic engine output across concurrent reads',async()=>{const path=ALPHA_API_PATHS.engineValidationFrame('gold-reclaim',2);const expected=buildLaneBValidationFrame(new SharedEntryEngine(),'gold-reclaim',2);const reads=await Promise.all(Array.from({length:10},()=>api.request(path)));for(const r of reads){expect(r.status).toBe(200);expect(r.body.data).toEqual(expected);expect(r.body.data.accountRisk.researchAdmission).toBe('PASS');}});
 it('exposes protected add-ons, campaign re-entry and account blocks end-to-end',async()=>{for(const [id,admission] of [['gold-protected-addon','PASS'],['gold-campaign-reentry','PASS'],['gold-margin-conflict','BLOCK'],['gold-stale-account','BLOCK']]){const r=await api.request(ALPHA_API_PATHS.engineValidationFrame(id!,2));expect(r.status).toBe(200);expect(r.body.data.entry.state).toBe('STRUCTURAL_READY');expect(r.body.data.accountRisk.researchAdmission).toBe(admission);}});
 it('rejects invalid frame and unknown scenario',async()=>{expect((await api.request('/v1/alpha/engine-validation/scenarios/gold-reclaim/frames/-1')).status).toBe(400);expect((await api.request(ALPHA_API_PATHS.engineValidationFrame('missing',0))).status).toBe(404);});
 it('has no order, Auto or caller-supplied risk endpoint',async()=>{for(const p of ['/v1/alpha/engine-validation/scenarios','/v1/alpha/engine-validation/orders','/v1/alpha/auto'])expect((await api.request(p,postJson({authority:'LIVE',accountId:'x'}))).status).toBe(404);});
});
