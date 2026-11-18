import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const adminKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!url||!adminKey||!publicKey) throw new Error('Supabase environment configuration is required');
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(u,o)=>fetch(u,{...o,signal:AbortSignal.timeout(20000)})}};
const admin=createClient(url,adminKey,options);
const ids=[];
const tag=randomUUID();
try {
 const clients=[];
 for(let i=0;i<2;i++){
  const email=`cloud-audit-${tag}-${i}@example.com`,password=randomUUID()+randomUUID();
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  assert.ifError(error); assert.ok(data.user); ids.push(data.user.id);
  const client=createClient(url,publicKey,options);
  const login=await client.auth.signInWithPassword({email,password}); assert.ifError(login.error);
  clients.push(client);
  const insert=await admin.from('graph_nodes').insert({id:`audit_${tag}_${i}`,user_id:data.user.id,name:'Isolation fixture',statement:'Temporary audit record'}); assert.ifError(insert.error);
 }
 for(let i=0;i<2;i++){
  const result=await clients[i].from('graph_nodes').select('id,user_id').in('user_id',ids);
  assert.ifError(result.error); assert.equal(result.data.length,1); assert.equal(result.data[0].user_id,ids[i]);
  const forbidden=await clients[i].from('graph_nodes').insert({id:`forbidden_${tag}`,user_id:ids[1-i],name:'Forbidden',statement:'Must reject'});
  assert.ok(forbidden.error,'Cross-account insertion must fail');
  const claim=await clients[i].rpc('claim_cloud_task'); assert.ok(claim.error,'Authenticated users must not claim worker jobs');
 }
 const anon=createClient(url,publicKey,options);
 const read=await anon.from('graph_nodes').select('id').in('user_id',ids);
 assert.ok(read.error||read.data.length===0,'Anonymous caller must not see account records');
 const claim=await anon.rpc('claim_cloud_task'); assert.ok(claim.error,'Anonymous caller must not claim worker jobs');
 console.log('PASS: two-account graph isolation, cross-account write rejection, anonymous isolation, restricted job claiming');
} finally {
 let failed=false;
 for(const id of ids){const {error}=await admin.auth.admin.deleteUser(id); if(error){failed=true;console.error('Test account cleanup failed; administrative cleanup required',id)}}
 if(failed) process.exitCode=1;
 else console.log('Temporary test accounts removed');
}
