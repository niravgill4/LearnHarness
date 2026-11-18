import { fetch as proxyFetch, EnvHttpProxyAgent } from 'undici';
const dispatcher = new EnvHttpProxyAgent();
globalThis.fetch = ((input: unknown, init?: RequestInit) => proxyFetch(input as string, { ...init, dispatcher, signal: AbortSignal.timeout(15000) } as Parameters<typeof proxyFetch>[1])) as unknown as typeof fetch;
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { loadAccountGraph } from '../../lib/supabase/account-graph';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
let id: string|undefined;
try {
 const created=await admin.auth.admin.createUser({email:`graph-recovery-${randomUUID()}@example.com`,password:randomUUID()+randomUUID(),email_confirm:true});assert.ifError(created.error);id=created.data.user!.id;
 const original=await loadAccountGraph(id);
 original.store.appendNode({id:'n_recovery',name:'Recovery',statement:'Persisted account graph',aliases:['Recovered'],provenance:[],createdAt:new Date().toISOString()});
 original.store.appendCheckpoint({chatId:'fixture',foldedAt:new Date().toISOString()});
 await original.flush();
 const first=await loadAccountGraph(id),second=await loadAccountGraph(id);
 assert.equal(first.store.readNodes()[0]?.aliases[0],'Recovered');assert.equal(first.store.readCheckpoints().length,1);
 first.store.writePositions({n_recovery:{x:1,y:2}});await first.flush();
 second.store.writePositions({n_recovery:{x:99,y:99}});await assert.rejects(second.flush(),/concurrent changes/);
 const final=await loadAccountGraph(id);assert.deepEqual(final.store.readPositions().n_recovery,{x:1,y:2});
 console.log('PASS: graph schema, cold-instance recovery, durable checkpoints and revision conflict fencing');
} finally {if(id){const result=await admin.auth.admin.deleteUser(id);assert.ifError(result.error);console.log('Temporary graph account removed');} await dispatcher.close();}
