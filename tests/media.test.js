import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyze,makeBrief} from '../analysis.js';

const csv=await readFile(new URL('../example.csv',import.meta.url),'utf8');
test('separates click-through deterioration from post-click changes',()=>{
  const report=analyze(csv);
  const {donor,receiver,amount_cents,allowed_treatment}=report.proposal;
  assert.equal(donor.channel,'Meta Ads');
  assert.equal(receiver.channel,'Google Ads');
  assert.equal(donor.signal,'weaker click-through');
  assert.equal(allowed_treatment,'creative');
  assert.equal(amount_cents,5900);
  assert.equal(report.campaigns.find(x=>x.campaign==='Retargeting pilot').signal,'low volume');
});
test('different conversion goals block cross-platform budget scenarios',()=>{
  const report=analyze(csv.split('\n').map(row=>row.startsWith('Google Ads')?row.replace('event-inquiry','newsletter-signup'):row).join('\n'));
  assert.equal(report.proposal,null);
});
test('invalid counts and mismatched reporting windows are rejected',()=>{
  assert.throws(()=>analyze(csv.replace('15000,540,34','15000,540,900')),/funnel/);
  assert.throws(()=>analyze(csv.replaceAll('2026-10-12','2026-10-13')),/seven days/);
});
test('AI brief must match permitted treatment and evidence IDs',()=>{
  const report=analyze(csv);
  const draft={source:'claude',treatment:'creative',evidence_ids:[report.proposal.donor.id,report.proposal.receiver.id],
    hypothesis:'The audience may be less responsive to the current creative.',
    variant:'Try a new venue headline while keeping targeting constant.'};
  assert.equal(makeBrief(report,draft).source,'structured AI');
  assert.equal(makeBrief(report,{...draft,evidence_ids:['C9','C1']}).source,'evidence rules');
  assert.equal(makeBrief(report,{...draft,variant:'Increase clicks by 99% with a new headline.'}).source,'evidence rules');
});
