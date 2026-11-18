import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { reserveCloudTurn, persistCloudTurn } from '../../lib/supabase/cloud-turns';
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
const tag=randomUUID();
let userId: string | undefined;
try {
 const {data,error}=await admin.auth.admin.createUser({email:`lease-audit-${tag}@example.com`,password:randomUUID()+randomUUID(),email_confirm:true});
 assert.ifError(error); userId=data.user!.id;
 const chatId=`audit_${tag}`;
 const inserted=await admin.from('chats').insert({id:chatId,user_id:userId,title:'Temporary execution fixture'});assert.ifError(inserted.error);
 const first=await reserveCloudTurn(userId,chatId,{input:'fixture'});assert.equal(first.ok,true);if(!first.ok)throw new Error('Reservation failed');
 const second=await reserveCloudTurn(userId,chatId,{});assert.equal(second.ok,false);if(!second.ok)assert.equal(second.conflict,true);
 await assert.rejects(persistCloudTurn(first.id,randomUUID(),{},'wrong lease','completed'));
 const stream='data: {"type":"fixture"}\n\n';
 await persistCloudTurn(first.id,first.token,{},stream,'running');
 const read=await admin.from('cloud_tasks').select('input,status').eq('id',first.id).single();assert.ifError(read.error);assert.equal(read.data!.input.stream,stream);
 await persistCloudTurn(first.id,first.token,{},stream,'completed');
 await assert.rejects(persistCloudTurn(first.id,first.token,{},'late write','running'));
 const next=await reserveCloudTurn(userId,chatId,{});assert.equal(next.ok,true);
 console.log('PASS: exclusive turn reservation, lease fencing, persisted replay, terminal state fencing, subsequent turn admission');
} finally {
 if(userId){const result=await admin.auth.admin.deleteUser(userId);assert.ifError(result.error);console.log('Temporary execution fixture removed');}
}
