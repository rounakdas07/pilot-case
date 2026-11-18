import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,FIELDS,calculate,validate,sensitivity,encodeScenario,decodeScenario,toCsv} from '../model.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('A hand-worked 6-month example balances each cost and separates capacity from cash',()=>{
 const r=calculate(DEFAULTS);assert.equal(r.ok,true);near(r.kits,252);near(r.kitsCost,6300);near(r.staffCost,945);near(r.followupCost,720);near(r.cost,9381.666666666666);near(r.totalCost,56290);near(r.threshold,26.8047619047619);near(r.bedDays,40);near(r.capacityValue,14000);near(r.netResource,4618.333333333334);near(r.cashAvoided,0);near(r.cashBudget,r.cost);near(r.bedDaysPer100,100/6);
});
test('Repeated kits raise purchase and delivery costs, not the patient-benefit denominator',()=>{
 const a=calculate(DEFAULTS),b=calculate({...DEFAULTS,extraTests:100});near(b.kits,480);near(b.bedDays,a.bedDays);near(b.bedDaysPer100,a.bedDaysPer100);assert.ok(b.cost>a.cost);assert.ok(b.threshold>a.threshold);
});
test('Extending the pilot dilutes setup per month but never drops setup from total cost',()=>{
 const r=calculate({...DEFAULTS,months:12});near(r.totalCost,12*(DEFAULTS.fixed+6300+945+720)+DEFAULTS.setup);near(r.setupMonthly,4000/12);
});
test('Zero resource value is explicitly not computable; zero admissions has no capacity',()=>{
 const r=calculate({...DEFAULTS,bedValue:0});assert.equal(r.ok,true);assert.equal(r.threshold,null);assert.equal(r.thresholdPerAdmission,null);assert.equal(r.cashThreshold,null);
 const z=calculate({...DEFAULTS,admissions:0});assert.equal(z.bedDays,0);assert.equal(z.thresholdPossible,false);assert.equal(z.thresholdPerAdmission,null);
});
test('An impossible required reduction is flagged rather than implied attainable',()=>{
 const r=calculate({...DEFAULTS,price:1000});assert.equal(r.thresholdPossible,false);assert.ok(r.threshold>r.maxBedDays);
});
test('Avoidable cash is independently entered and is not added to capacity value',()=>{
 const r=calculate({...DEFAULTS,cashValue:20});near(r.cashAvoided,800);near(r.cashBudget,r.cost-800);near(r.capacityValue,14000);near(r.netResource,14000-r.cost);assert.equal(calculate({...DEFAULTS,cashValue:351}).ok,false);
});
test('No effect produces no benefit even when economics are favourable',()=>{
 const r=calculate({...DEFAULTS,reduction:0});assert.equal(r.bedDays,0);assert.equal(r.capacityValue,0);near(r.netResource,-r.cost);near(r.cashBudget,r.cost);
});
test('Boundaries, malformed inputs and invalid cohorts cannot produce outputs',()=>{
 for(const patch of [{episodes:-1},{episodes:2.5},{episodes:0},{admissions:241},{months:0},{months:Infinity},{price:NaN},{price:''},{reduction:2.1},{baselineDays:-2},{cashValue:400},{extraTests:-1}]) assert.equal(calculate({...DEFAULTS,...patch}).ok,false,JSON.stringify(patch));
 for(const f of FIELDS){const obj={...DEFAULTS};delete obj[f.key];assert.ok(Object.keys(validate(obj)).length);}
});
test('Zero activity and free pilot are representable without NaN or infinity',()=>{
 const r=calculate({...DEFAULTS,episodes:0,admissions:0,fixed:0,setup:0});assert.equal(r.ok,true);assert.equal(r.cost,0);assert.equal(r.threshold,0);assert.equal(r.bedDaysPer100,null);assert.equal(r.ceiling,null);assert.equal(r.cashBudget,0);
});
test('Sensitivity centre equals base case, higher kit prices need more capacity',()=>{
 const m=sensitivity(DEFAULTS);near(m[1].cells[1].result.threshold,calculate(DEFAULTS).threshold);assert.ok(m[2].cells[1].result.threshold>m[0].cells[1].result.threshold);assert.ok(m[1].cells[2].result.threshold<m[1].cells[0].result.threshold);
 const edge=sensitivity({...DEFAULTS,price:10000,bedValue:100000});assert.ok(edge.flatMap(r=>r.cells).every(c=>c.result.ok));
});
test('Scenario links round-trip and reject malformed/nonfinite financial inputs',()=>{
 const s={v:1,inputs:{...DEFAULTS},site:'Example & "new"',basis:'Quote\n£25',checked:['costs','effect']};assert.deepEqual(decodeScenario(encodeScenario(s)),s);assert.equal(decodeScenario('%bad'),null);assert.equal(decodeScenario(encodeScenario({...s,inputs:{...DEFAULTS,price:null}})),null);assert.equal(decodeScenario(encodeScenario({...s,v:2})),null);
});
test('CSV preserves newlines and quotes while neutralising text spreadsheet formulas',()=>{
 const csv=toCsv([['=1+1','A "quote"','two\nlines',-123]]);assert.equal(csv,'"\'=1+1","A ""quote""","two\nlines","-123"');
});
