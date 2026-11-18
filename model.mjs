// Independent planning model. All defaults are illustrative, not Neutrocheck data.
export const FIELDS = [
  {key:'episodes', label:'Tested episodes / month', unit:'episodes', value:240, min:0, max:100000, step:1, group:'main', help:'Acute-care episodes with one planned index test. Repeat visits are separate episodes, not new patients.'},
  {key:'admissions', label:'Eligible admissions / month', unit:'admissions', value:80, min:0, max:100000, step:1, group:'main', help:'Baseline admissions within those episodes whose stay the proposed pathway could change. This is a local cohort definition, not a risk prediction.'},
  {key:'price', label:'Cost per test kit', unit:'£', value:25, min:0, max:10000, step:0.01, group:'main', help:'Illustrative, not a 52North quote. Use the complete delivered cost, including applicable tax and wastage not counted elsewhere.'},
  {key:'bedValue', label:'Resource value per bed-day', unit:'£', value:350, min:0, max:100000, step:0.01, group:'main', help:'Local accounting value of an occupied bed-day. This values capacity; it is not automatically avoidable spending.'},
  {key:'months', label:'Pilot duration', unit:'months', value:6, min:1, max:36, step:1, group:'main', help:'Setup costs are spread over this period. No annual extrapolation or discounting.'},
  {key:'extraTests', label:'Extra kits per 100 episodes', unit:'kits', value:5, min:0, max:1000, step:0.1, group:'cost', help:'All repeats, invalid tests and wasted kits, beyond one initial kit per episode. A direct count assumption, not diagnostic failure probability.'},
  {key:'minutes', label:'Additional paid time per kit', unit:'minutes', value:5, min:0, max:600, step:0.1, group:'cost', help:'Incremental paid delivery time. Set to zero for redeployed staff; record their workload separately in the evidence plan. Conservative assumption: each consumed kit incurs this time.'},
  {key:'hourly', label:'Loaded staff cost per hour', unit:'£', value:45, min:0, max:2000, step:0.01, group:'cost', help:'Include employment overheads. Applied only to the additional paid time above.'},
  {key:'followup', label:'Extra follow-up cost per episode', unit:'£', value:3, min:0, max:10000, step:0.01, group:'cost', help:'Incremental paid clinical review, repeat assessment or other pathway costs. Exclude anything already counted in kit staffing.'},
  {key:'fixed', label:'Recurring programme cost / month', unit:'£', value:750, min:0, max:1000000, step:0.01, group:'cost', help:'Include reader, software, QA, calibration, support, governance and data collection as relevant. Enter only costs additional to current care.'},
  {key:'setup', label:'One-off setup cost', unit:'£', value:4000, min:0, max:10000000, step:0.01, group:'cost', help:'Training, implementation, equipment and pathway changes not included in recurring costs. Count each item once.'},
  {key:'baselineDays', label:'Baseline stay in eligible admissions', unit:'days', value:2, min:0, max:365, step:0.1, group:'effect', help:'Mean occupied bed-days per eligible admission under the comparator. Used only to bound the shorter-stay scenario.'},
  {key:'reduction', label:'Shorter stay per eligible admission', unit:'days', value:0.5, min:0, max:365, step:0.05, group:'effect', help:'A hypothetical effect, not measured Neutrocheck performance. Count actual occupied bed-days released, not faster test turnaround.'},
  {key:'cashValue', label:'Confirmed cash avoided per bed-day', unit:'£', value:0, min:0, max:100000, step:0.01, group:'effect', help:'Leave at zero without a finance-agreed, avoidable cost. This is a component of the resource value, never an additional benefit to add to it.'}
];
export const DEFAULTS = Object.fromEntries(FIELDS.map(f=>[f.key,f.value]));
export const EVIDENCE = [
  {id:'pathway', title:'Pathway and safety plan', detail:'Agree the HCP-use setting, eligibility, comparator, approvals and safety monitoring. Predefine delayed treatment, reattendance, readmission and escalation outcomes with clinical leads.'},
  {id:'counts', title:'Episodes, admissions and kits', detail:'Separately count people, acute episodes, index tests, invalid/repeat tests and total kits. Verify that eligible admissions belong to the tested cohort.'},
  {id:'costs', title:'A complete local cost quote', detail:'Confirm procurement, paid staff time, implementation, QA, software, support and follow-up costs. Record source, date, tax basis and who bears each cost.'},
  {id:'effect', title:'A credible occupancy comparison', detail:'Measure occupied bed-days over an agreed follow-up window, including reattendance and readmission. Use a suitable comparator and account for case mix and secular changes. Before–after change alone is not causal proof.'},
  {id:'finance', title:'Finance agreement on value', detail:'Confirm the local resource value, any genuinely avoidable cash cost and how released capacity could be used. Faster results and ED hours are not automatically inpatient bed-days.'}
];
export function validate(input) {
  const errors = {};
  for(const f of FIELDS) {
    const v=input[f.key];
    if(typeof v!=='number'||!Number.isFinite(v)) errors[f.key]='Enter a finite number.';
    else if(v<f.min||v>f.max) errors[f.key]=`Use a value from ${f.min} to ${f.max}.`;
    else if(['episodes','admissions','months'].includes(f.key)&&!Number.isInteger(v)) errors[f.key]='Use a whole number.';
  }
  if(input.admissions>input.episodes) errors.admissions='Eligible admissions cannot exceed tested episodes in this model.';
  if(input.reduction>input.baselineDays) errors.reduction='A reduction cannot exceed the baseline occupied stay.';
  if(input.cashValue>input.bedValue) errors.cashValue='Cash avoided must be a component of the resource value, not larger than it.';
  return errors;
}
export function calculate(x) {
  const errors=validate(x);
  if(Object.keys(errors).length) return {ok:false,errors};
  const kits=x.episodes*(1+x.extraTests/100);
  const kitsCost=kits*x.price;
  const staffCost=kits*x.minutes/60*x.hourly;
  const followupCost=x.episodes*x.followup;
  const setupMonthly=x.setup/x.months;
  const cost=kitsCost+staffCost+followupCost+x.fixed+setupMonthly;
  const bedDays=x.admissions*x.reduction;
  const capacityValue=bedDays*x.bedValue;
  const cashAvoided=bedDays*x.cashValue;
  const threshold=x.bedValue>0?cost/x.bedValue:null;
  const maxBedDays=x.admissions*x.baselineDays;
  const thresholdPerAdmission=threshold!==null&&x.admissions>0?threshold/x.admissions:null;
  const nonKitCost=cost-kitsCost;
  const ceiling=kits>0?(capacityValue-nonKitCost)/kits:null;
  const cashThreshold=x.cashValue>0?cost/x.cashValue:null;
  return {ok:true,kits,kitsCost,staffCost,followupCost,setupMonthly,cost,totalCost:cost*x.months,bedDays,capacityValue,cashAvoided,cashBudget:cost-cashAvoided,netResource:capacityValue-cost,threshold,maxBedDays,thresholdPerAdmission,ceiling,cashThreshold,thresholdPossible:threshold!==null&&threshold<=maxBedDays,bedDaysPer100:x.episodes>0?bedDays/x.episodes*100:null};
}
export function sensitivity(x) {
  // Deliberate scenario changes, not confidence intervals.
  return [0.75,1,1.25].map(p=>{const price=Math.min(10000,x.price*p);return {price,cells:[0.75,1,1.25].map(v=>{const bedValue=Math.min(100000,x.bedValue*v);return {bedValue,result:calculate({...x,price,bedValue,cashValue:0})};})};});
}
export function toCsv(rows) {
  return rows.map(row=>row.map(cell=>{
    let s=String(cell??'');
    // Protect spreadsheet text cells from formula execution.
    if(/^[=+@\-]/.test(s)&&!/^-[\d.]+$/.test(s)) s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
}
export function encodeScenario(state) { return encodeURIComponent(JSON.stringify(state)); }
export function decodeScenario(value) {
  try {
    const obj=JSON.parse(decodeURIComponent(value));
    if(obj.v!==1||!obj.inputs||Object.keys(validate(obj.inputs)).length) return null;
    return {v:1,inputs:Object.fromEntries(FIELDS.map(f=>[f.key,obj.inputs[f.key]])),site:typeof obj.site==='string'?obj.site.slice(0,100):'',basis:typeof obj.basis==='string'?obj.basis.slice(0,2000):'',checked:EVIDENCE.map(e=>e.id).filter(id=>Array.isArray(obj.checked)&&obj.checked.includes(id))};
  } catch {return null;}
}
