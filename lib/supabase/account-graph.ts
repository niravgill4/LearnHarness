import { createAdminClient } from './server';
import { restoreGraphFromCloud } from './sync';
import { createAccountGraph, type AccountGraphState } from '../../src/store/account-graph';

export async function loadAccountGraph(userId: string) {
 const client=createAdminClient();
 if(!client)throw new Error('Cloud graph storage is not configured');
 const {data,error}=await client.from('account_graph_state').select('revision,state').eq('user_id',userId).maybeSingle();
 if(error)throw new Error('Account graph storage is unavailable; apply the account graph migration');
 let initial: Partial<AccountGraphState>;
 if(data)initial=data.state;
 else {
  const legacy=await restoreGraphFromCloud(userId,client);
  if(!legacy)throw new Error('The existing account graph could not be loaded');
  initial=legacy;
 }
 const graph=createAccountGraph(initial);
 let revision: number=data?.revision??0;
 return {...graph, async flush(){
  if(!graph.isDirty())return;
  const result=await client.rpc('save_account_graph',{p_user_id:userId,p_revision:revision,p_state:graph.snapshot()});
  if(result.error)throw new Error('Account graph could not be saved; concurrent changes or storage failure');
  revision=result.data;
  graph.markClean();
 }};
}
