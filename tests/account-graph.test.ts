import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountGraph } from '../src/store/account-graph';
import { userAuthStorage } from '../src/core/user-auth-context';
import { stores } from '../src/server/stores';
const node={id:'n_fixture',name:'Private',statement:'Account-owned',aliases:[],createdAt:new Date().toISOString(),provenance:[]};
test('graph adapters isolate records and returned references',()=>{
 const alice=createAccountGraph(),bob=createAccountGraph();alice.store.appendNode(node);
 assert.equal(alice.store.readNodes().length,1);assert.equal(bob.store.readNodes().length,0);
 const result=alice.store.readNodes();result[0]!.name='changed';assert.equal(alice.store.readNodes()[0]!.name,'Private');
 assert.equal(alice.isDirty(),true);assert.equal(bob.isDirty(),false);
});
test('account context refuses shared graph fallback and routes initialized contexts independently',async()=>{
 userAuthStorage.run({userId:'missing',keys:{}},()=>assert.throws(()=>stores.graphStore.readNodes(),/shared filesystem access refused/));
 const alice=createAccountGraph({nodes:[node]}),bob=createAccountGraph();
 await Promise.all([
 userAuthStorage.run({userId:'alice',keys:{},graphStore:alice.store},async()=>{await Promise.resolve();assert.equal(stores.graphStore.readNodes().length,1);}),
 userAuthStorage.run({userId:'bob',keys:{},graphStore:bob.store},async()=>{await Promise.resolve();assert.equal(stores.graphStore.readNodes().length,0);}),
 ]);
});
test('coverage and checkpoints survive snapshot reload',()=>{
 const graph=createAccountGraph();
 graph.store.appendCheckpoint({chatId:'fixture',foldedAt:new Date().toISOString()});
 const restored=createAccountGraph(graph.snapshot());assert.deepEqual(restored.store.readCheckpoints(),graph.store.readCheckpoints());
 graph.store.rewriteLedgers({checkpoints:[]});assert.equal(graph.store.readCheckpoints().length,0);
});
