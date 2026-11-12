import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {connectPostgres} from './postgres.js';

export class Problem extends Error {
  constructor(status,message){super(message);this.status=status;}
}
export async function createDb(location='memory://'){
  const external=Boolean(process.env.DATABASE_URL||process.env.PGHOST);
  const db=external?await connectPostgres():await PGlite.create(location);
  const schema=await readFile(new URL('./schema.sql',import.meta.url),'utf8');
  await db.transaction(async tx=>{
    if(external)await tx.query('SELECT pg_advisory_xact_lock(17074127)');
    await tx.exec(schema);
  });
  return db;
}
