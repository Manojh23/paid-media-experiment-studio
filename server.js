import express from 'express';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createDb} from './db.js';
import {registerMedia} from './routes.js';

export function createApp(db,briefUrl='http://127.0.0.1:8002'){
  const app=express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'128kb'}));
  app.get('/api/health',async(_req,res)=>{await db.query('SELECT 1');res.json({ok:true});});
  registerMedia(app,db,briefUrl);
  app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
  app.use(express.static(fileURLToPath(new URL('./web/dist',import.meta.url))));
  app.use((error,_req,res,_next)=>{
    const status=Number.isInteger(error.status)&&error.status>=400&&error.status<500?error.status:500;
    if(status===500)console.error(error);
    res.status(status).json({error:status===500?'Unexpected error.':error.message});
  });
  return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const db=await createDb(process.env.MEDIA_DB??'.media-data');
  const server=createApp(db,process.env.MEDIA_AGENT_URL).listen(Number(process.env.PORT??4174),process.env.HOST??'127.0.0.1',()=>console.log('Studio: http://127.0.0.1:'+server.address().port));
}
