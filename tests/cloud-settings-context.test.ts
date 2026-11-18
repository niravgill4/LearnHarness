import assert from 'node:assert/strict';
import { test } from 'node:test';
import { userAuthStorage } from '../src/core/user-auth-context';
import { readSettings, writeSettings } from '../src/store/settings';

test('concurrent cloud contexts never read another account or shared file settings', async () => {
 const read = (userId: string, provider: string) => userAuthStorage.run({userId, keys:{}, settings:{version:1,models:{strong:{model:{provider,id:'fixture'}}}}},async()=>{
  await Promise.resolve();
  const settings=readSettings();assert.equal(settings?.models?.strong?.model?.provider,provider);
  if(settings?.models) delete settings.models.strong;
  assert.equal(readSettings()?.models?.strong?.model?.provider,provider,'returned settings must not mutate the request context');
  assert.throws(()=>writeSettings({version:1}),/account-scoped/);
 });
 await Promise.all([read('alice','google'),read('bob','openai')]);
});

test('an authenticated account missing preferences cannot fall back to shared settings',()=>{
 userAuthStorage.run({userId:'alice',keys:{}},()=>assert.equal(readSettings(),null));
});
