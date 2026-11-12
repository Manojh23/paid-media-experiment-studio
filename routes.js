import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Problem} from './db.js';
import {analyze,makeBrief} from './analysis.js';

const sample=await readFile(new URL('./example.csv',import.meta.url),'utf8');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function registerMedia(app,db,agentUrl) {
  app.get('/api/media/sample',(_req,res)=>res.json({csv:sample}));
  app.get('/api/media/experiments',async(_req,res)=>res.json((await db.query('SELECT * FROM media_experiments ORDER BY created_at DESC LIMIT 25')).rows));
  app.post('/api/media/analyze',async(req,res)=>{
    const csv=req.body?.csv;
    let report;
    try {report=analyze(csv);}catch(error){throw new Problem(422,error.message);}
    if(!report.proposal)return res.json({report,experiment:null});
    const digest=createHash('sha256').update(csv).digest('hex');
    const {rows:prior}=await db.query('SELECT * FROM media_experiments WHERE digest=$1',[digest]);
    if(prior.length)return res.json({report,experiment:prior[0]});
    let selection=null;
    const p=report.proposal;
    try {
      const response=await fetch(new URL('/media-brief',agentUrl),{
        method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(4500),
        body:JSON.stringify({donor:p.donor.id,receiver:p.receiver.id,signal:p.donor.signal,allowed_treatment:p.allowed_treatment,
          cpl_change:p.donor.delta.cpl,ctr_change:p.donor.delta.ctr,cvr_change:p.donor.delta.cvr}),
      });
      if(response.ok)selection=await response.json();
    } catch { /* Rule-based brief remains available if the provider is offline. */ }
    const brief=makeBrief(report,selection);
    const {rows}=await db.query(`INSERT INTO media_experiments(id,digest,report,brief) VALUES ($1,$2,$3,$4)
      ON CONFLICT(digest) DO NOTHING RETURNING *`,[randomUUID(),digest,JSON.stringify(report),JSON.stringify(brief)]);
    const experiment=rows[0]??(await db.query('SELECT * FROM media_experiments WHERE digest=$1',[digest])).rows[0];
    res.status(rows.length?201:200).json({report,experiment});
  });
  app.patch('/api/media/experiments/:id',async(req,res)=>{
    const {id}=req.params,{status,version}=req.body??{};
    if(!uuid.test(id)||!['approved','declined'].includes(status)||!Number.isInteger(version)||version<1)
      throw new Problem(422,'Provide an experiment ID, a decision, and its current version.');
    const {rows}=await db.query(`UPDATE media_experiments SET status=$2,version=version+1,decided_at=now()
      WHERE id=$1 AND status='draft' AND version=$3 RETURNING *`,[id,status,version]);
    if(!rows.length)throw new Problem(409,'Experiment is no longer an active draft. Refresh before reviewing.');
    res.json(rows[0]);
  });
}
