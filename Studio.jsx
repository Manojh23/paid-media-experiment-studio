import React,{useEffect,useState} from 'react';
import './studio.css';

const format=(cents,currency)=>cents===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency}).format(cents/100);
const pct=n=>n===null?'—':(n*100).toFixed(1)+'%';
const delta=n=>n===null?'—':(n>0?'+':'')+pct(n);

export default function MediaStudio({api}){
  const [analysis,setAnalysis]=useState(null);
  const [history,setHistory]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    const c=new AbortController();
    api('/media/experiments',{signal:c.signal}).then(setHistory).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return ()=>c.abort();
  },[]);
  async function perform(fn){
    setBusy(true);setError('');
    try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function analyze(csv){
    const result=await api('/media/analyze',{method:'POST',body:JSON.stringify({csv})});
    setAnalysis(result);setHistory(await api('/media/experiments'));
  }
  function upload(event){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(file.size>100000){setError('Choose a CSV under 100 KB.');return;}
    perform(async()=>analyze(await file.text()));
  }
  async function downloadTemplate(){
    const {csv}=await api('/media/sample');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    const a=document.createElement('a');a.href=url;a.download='paid-media-example.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function decide(status){
    perform(async()=>{
      const current=analysis.experiment;
      const updated=await api('/media/experiments/'+current.id,{
        method:'PATCH',body:JSON.stringify({status,version:current.version}),
      });
      setAnalysis({report:updated.report,experiment:updated});
      setHistory(await api('/media/experiments'));
    });
  }
  const p=analysis?.report.proposal,e=analysis?.experiment,b=e?.brief;
  return <div className="media-studio">
    <section className="card media-intro">
      <div className="eyebrow">MARKETING WORKFLOW</div>
      <h2>Paid Media Experiment Studio</h2>
      <p>Compare Google Ads and Meta Ads exports, identify where lead efficiency dropped, and prepare a test for marketing review.</p>
      <div className="media-actions">
        <button className="primary" disabled={busy} onClick={()=>perform(async()=>analyze((await api('/media/sample')).csv))}>Analyze sample exports</button>
        <button disabled={busy} onClick={()=>perform(downloadTemplate)}>Download CSV template</button>
        <label>Import normalized CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={upload}/></label>
      </div>
      {busy&&<p role="status">Working…</p>}
      {error&&<p role="alert" className="alert">{error}</p>}
    </section>
    {analysis&&<section className="card">
      <h2>Campaign diagnosis</h2>
      <p>Seven-day windows starting {analysis.report.windows.join(' and ')}. Changes are descriptive signals.</p>
      <div className="table-scroll"><table><thead><tr><th>Campaign</th><th>Leads</th><th>Cost / lead</th><th>Click rate</th><th>Post-click conversion</th><th>Signal</th></tr></thead>
      <tbody>{analysis.report.campaigns.map(c=><tr key={c.id}><td><strong>{c.campaign}</strong><small>{c.channel} · {c.id}</small></td>
        <td>{c.prev.conversions} → {c.current.conversions}</td>
        <td>{format(c.prev.cpl,c.currency)} → {format(c.current.cpl,c.currency)} <small>{delta(c.delta.cpl)}</small></td>
        <td>{pct(c.prev.ctr)} → {pct(c.current.ctr)}</td><td>{pct(c.prev.cvr)} → {pct(c.current.cvr)}</td><td><span className="tag">{c.signal}</span></td></tr>)}</tbody></table></div>
      {!p&&<p className="notice">No budget scenario meets the volume, comparability, and efficiency checks. Review the campaign signals before proposing a change.</p>}
    </section>}
    {p&&b&&<div className="media-grid">
      <section className="card">
        <div className="eyebrow">SCENARIO</div><h2>Compare a capped budget shift</h2>
        <p>Move <strong>{format(p.amount_cents,p.donor.currency)}</strong> from {p.donor.campaign} to {p.receiver.campaign} in this scenario.</p>
        <dl><dt>{p.donor.campaign}</dt><dd>{format(p.donor.current.spend_cents,p.donor.currency)} → {format(p.donor.current.spend_cents-p.amount_cents,p.donor.currency)}</dd>
          <dt>{p.receiver.campaign}</dt><dd>{format(p.receiver.current.spend_cents,p.receiver.currency)} → {format(p.receiver.current.spend_cents+p.amount_cents,p.receiver.currency)}</dd></dl>
        <small>Combined spend stays flat. The scenario is separate from the A/B test and has no effect on live ad accounts.</small>
      </section>
      <section className="card">
        <div className="eyebrow">EXPERIMENT BRIEF</div><h2>Review a test</h2>
        <p><strong>Hypothesis:</strong> {b.hypothesis}</p>
        <p><strong>Variant:</strong> {b.action}</p><p><strong>Success:</strong> {b.review}</p><p><strong>Stop:</strong> {b.stop}</p>
        <small>Evidence: {b.evidence_ids.join(', ')} · Drafted using {b.source}</small>
        <div className="media-actions">
          <span className="tag">{e.status}</span>
          {e.status==='draft'&&<><button className="primary" disabled={busy} onClick={()=>decide('approved')}>Approve brief</button>
            <button disabled={busy} onClick={()=>decide('declined')}>Decline brief</button></>}
        </div>
      </section>
    </div>}
    {history.length>0&&<section className="card">
      <h2>Review history</h2>
      <ul className="media-history">{history.map(item=><li key={item.id}>
        <button disabled={busy} onClick={()=>{setError('');setAnalysis({report:item.report,experiment:item});}}>{item.report.proposal.donor.campaign} · {item.report.windows[1]}</button>
        <span className="tag">{item.status}</span></li>)}</ul>
    </section>}
  </div>;
}
