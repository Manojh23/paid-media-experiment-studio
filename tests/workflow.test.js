import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createApp} from '../server.js';
import {createDb} from '../db.js';

test('the standalone server drafts, approves, and persists a decision',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'media-studio-'));
  const location=join(dir,'db');
  let db,server;
  const start=async()=>{
    db=await createDb(location);
    server=createApp(db,'http://127.0.0.1:0').listen(0,'127.0.0.1');
    await once(server,'listening');
    return 'http://127.0.0.1:'+server.address().port;
  };
  const stop=async()=>{
    if(server){await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));server=null;}
    if(db){await db.close();db=null;}
  };
  try{
    let base=await start();
    const sample=await (await fetch(base+'/api/media/sample')).json();
    const res=await fetch(base+'/api/media/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sample)});
    assert.equal(res.status,201);
    const {experiment}=await res.json();
    assert.equal(experiment.brief.source,'evidence rules');
    const approval=await fetch(base+'/api/media/experiments/'+experiment.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'approved',version:1})});
    assert.equal((await approval.json()).status,'approved');
    await stop();
    base=await start();
    const reviews=await (await fetch(base+'/api/media/experiments')).json();
    assert.equal(reviews[0].status,'approved');
  }finally{
    await stop();
    await rm(dir,{recursive:true,force:true});
  }
});
