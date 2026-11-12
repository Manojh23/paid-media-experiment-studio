import {parse} from 'csv-parse/sync';

const keys=['channel','campaign','start_date','end_date','currency','goal','attribution_days','impressions','clicks','conversions','spend_cents'];
const channels=new Set(['Google Ads','Meta Ads']);
const treatments={
  creative:'Test a new creative angle against the current ad with audience and landing page held constant.',
  landing:'Test a shorter inquiry form while keeping ads, audience, and budget unchanged.',
  query:'Test tighter query or audience coverage while holding the offer and landing page fixed.',
};
const goals=/^[a-z0-9][a-z0-9 -]{0,49}$/i;
function day(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)
    throw new Error('Use valid YYYY-MM-DD dates.');
  return Date.parse(value)/86400000;
}
const rate=(n,d)=>d?n/d:null;
const change=(a,b)=>a!==null&&a>0&&b!==null?b/a-1:null;
function metric(row) {
  return {spend_cents:row.spend_cents,conversions:row.conversions,clicks:row.clicks,impressions:row.impressions,
    ctr:rate(row.clicks,row.impressions),cvr:rate(row.conversions,row.clicks),
    cpc:rate(row.spend_cents,row.clicks),cpl:rate(row.spend_cents,row.conversions)};
}
export function analyze(csv) {
  if(typeof csv!=='string'||csv.length>100000)throw new Error('Upload a normalized CSV under 100 KB.');
  let rows;
  try {rows=parse(csv,{trim:true,bom:true,skip_empty_lines:true,columns:h=>{
    if(h.length!==keys.length||new Set(h).size!==keys.length||keys.some(k=>!h.includes(k)))throw new Error('Unexpected CSV headers.');
    return h;
  }});} catch {throw new Error('Invalid CSV. Use the supplied export template.');}
  if(rows.length<2||rows.length>100)throw new Error('Provide 2 to 100 campaign-window rows.');
  const groups=new Map(), windows=new Map();
  for(const r of rows) {
    if(!channels.has(r.channel)||!r.campaign||r.campaign.length>100||!/^[A-Z]{3}$/.test(r.currency)||!goals.test(r.goal))
      throw new Error('Invalid channel, campaign, currency, or conversion goal.');
    for(const k of keys.slice(6)) {
      if(!/^\d{1,9}$/.test(r[k]))throw new Error('Counts and spend must be nonnegative whole numbers.');
      r[k]=Number(r[k]);
    }
    if(r.attribution_days<1||r.attribution_days>90||r.conversions>r.clicks||r.clicks>r.impressions)throw new Error('Inconsistent funnel counts or attribution window.');
    const start=day(r.start_date),end=day(r.end_date);
    if(end-start!==6)throw new Error('Each reporting window must be seven days.');
    windows.set(start,r.start_date);
    const key=JSON.stringify([r.channel,r.campaign]);
    const list=groups.get(key)??[];
    if(list.some(x=>x.start_date===r.start_date))throw new Error('A campaign appears twice in a reporting window.');
    list.push(r);groups.set(key,list);
  }
  const dates=[...windows.keys()].sort((a,b)=>a-b);
  if(dates.length!==2||dates[1]-dates[0]!==7)throw new Error('Use two consecutive seven-day reporting windows.');
  const campaigns=[...groups.values()].map((list,i)=>{
    if(list.length!==2)throw new Error('Each campaign needs a row in both windows.');
    const [before,after]=list.sort((a,b)=>a.start_date.localeCompare(b.start_date));
    if(['goal','currency','attribution_days'].some(k=>before[k]!==after[k]))
      throw new Error('A campaign changed conversion goal, currency, or attribution window.');
    const prev=metric(before), current=metric(after);
    const delta=Object.fromEntries(['ctr','cvr','cpc','cpl'].map(k=>[k,change(prev[k],current[k])]));
    const enough=before.conversions>=10&&after.conversions>=10&&prev.spend_cents>0&&current.spend_cents>0;
    let signal='stable';
    if(!enough)signal='low volume';
    else if(delta.cpl>=.20)signal=delta.cvr<=-.15?'post-click drop':delta.ctr<=-.15?'weaker click-through':delta.cpc>=.15?'higher click costs':'cost increase';
    return {id:'C'+(i+1),channel:after.channel,campaign:after.campaign,currency:after.currency,goal:after.goal,
      attribution_days:after.attribution_days,prev,current,delta,enough,signal};
  });
  const compatible=(a,b)=>a.currency===b.currency&&a.goal===b.goal&&a.attribution_days===b.attribution_days;
  const pairs=campaigns.flatMap(d=>!d.enough||d.delta.cpl<.2?[]:campaigns
    .filter(r=>r.id!==d.id&&r.enough&&compatible(d,r)&&r.delta.cpl<=.1&&r.current.cpl<=d.current.cpl*.75)
    .map(r=>({donor:d,receiver:r,gap:d.current.cpl-r.current.cpl})));
  pairs.sort((a,b)=>b.gap-a.gap||a.donor.id.localeCompare(b.donor.id)||a.receiver.id.localeCompare(b.receiver.id));
  const best=pairs[0];
  const amount=best?Math.floor(best.donor.current.spend_cents*.10):0;
  const proposal=amount>=2500?{donor:best.donor,receiver:best.receiver,amount_cents:amount,
    allowed_treatment:best.donor.signal==='post-click drop'?'landing':best.donor.signal==='weaker click-through'?'creative':'query'}:null;
  return {windows:dates.map(x=>windows.get(x)),campaigns,proposal};
}
export function makeBrief(report,selection) {
  const p=report.proposal;
  if(!p)return null;
  const safeDraft=value=>typeof value==='string'&&value.trim().length>=10&&value.length<=240&&!/[0-9]/.test(value);
  const verified=selection?.source==='claude'&&safeDraft(selection.hypothesis)&&safeDraft(selection.variant)&&selection.treatment===p.allowed_treatment&&Array.isArray(selection.evidence_ids)
    &&selection.evidence_ids.length===2&&selection.evidence_ids[0]===p.donor.id&&selection.evidence_ids[1]===p.receiver.id;
  return {treatment:p.allowed_treatment,source:verified?'structured AI':'evidence rules',evidence_ids:[p.donor.id,p.receiver.id],
    hypothesis:verified?selection.hypothesis:'The observed '+p.donor.signal+' points to a possible bottleneck worth isolating in a controlled test.',
    action:verified?selection.variant:treatments[p.allowed_treatment],
    review:'Review after seven days. Seek a 10% lower cost per lead than the control without a drop in lead count.',
    stop:'Stop and review if the variant cost per lead exceeds the control by 20% after at least ten conversions.'};
}
