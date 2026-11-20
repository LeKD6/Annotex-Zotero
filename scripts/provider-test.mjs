import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const prefs = new Map(), logins = [], calls = [];
let blocks;
let status = 200, bodyResult = 'Fixture answer';
const fetch = async (url, options) => {
  calls.push({url, ...options, body:JSON.parse(options.body)});
  return {ok:status===200, status, json:async()=>url.endsWith('/messages') ? {content:blocks} : ({choices:[{message:{content:bodyResult}}]})};
};
const baseURL = 'https://api.openai.com/v1', claude = 'https://api.anthropic.com/v1';
  const context = vm.createContext({ URL, setTimeout, clearTimeout,
    Zotero: { Prefs: { get: k => prefs.get(k), set: (k, v) => prefs.set(k, v) }, getMainWindow: () => ({ fetch, AbortController }) },
    Services: { logins: { findLogins: () => logins.slice(), removeLogin: l => logins.splice(logins.indexOf(l), 1), addLoginAsync: async l => logins.push(l) } },
    Components: { classes: { '@mozilla.org/login-manager/loginInfo;1': { createInstance: () => ({ init(origin, form, realm, username, password) { Object.assign(this, { origin, realm, username, password }); } }) } }, interfaces: { nsILoginInfo: {} } }
  });
  vm.runInContext(await readFile(new URL('../content/provider.js', import.meta.url), 'utf8'), context);
  const p = context.AnnotexProvider;
  const passage = { selection: 'Legislative oversight was more frequent in divided governments.', documentTitle: 'Fixture' };
  for (const mode of ['define', 'explain']) {
    const prompt = p.explanationPrompt({ ...passage, mode });
    assert.match(prompt, /give the intuition/i);
    assert.match(prompt, mode === 'define' ? /define the selected term/i : /without inventing a cause/);
    assert.match(prompt, /illustration, not as evidence/);
    assert.ok(prompt.endsWith(passage.selection));
  }
  p.setPref('cloudAIEnabled', true);
  p.setPref('cloudProviderURL', baseURL);
  p.setPref('providerModel', 'fixture-model');
  await p.save({baseURL, model:'fixture-model', enabled:true}, 'fixture-upgrade-key', true);
  p.shutdown();
  prefs.delete(p.PREFIX+'sendOnClickEnabled'); // An upgrade has only the earlier opt-in and stored login.
  assert.equal(p.config().enabled, false);
  assert.equal(p.keyFor(p.validateEndpoint(baseURL).endpoint), 'fixture-upgrade-key');
  await assert.rejects(p.complete({prompt:'legacy'}), /AI is off/);
  assert.equal(calls.length,0);
  p.forget();
  const config = {baseURL, model:'fixture-model', enabled:true};
  const secret = 'fixture-secret-do-not-save';
  for (const url of ['https://ai-gateway.vercel.sh/v1','http://localhost:11434/v1','https://127.0.0.1/v1','https://10.1.1.1/v1','https://other.example/v1',baseURL+'?x',baseURL+'#x',baseURL+'/extra','https://api.openai.com:8443/v1','https://u@api.openai.com/v1','file:///tmp']) {
    await assert.rejects(p.save({...config,baseURL:url},secret,true));
    p.setPref('cloudProviderURL',url); p.setPref('sendOnClickEnabled',true);
    assert.equal(p.config().enabled,false); assert.equal(p.config().model,'');
    await assert.rejects(p.complete({prompt:'test'}));
  }
  assert.equal(logins.length,0); assert.equal(calls.length,0);
  await assert.rejects(p.save(config), /API key/);
  await assert.rejects(p.save({...config,reasoning:'invalid'},secret,true));
  await assert.rejects(p.save({...config,model:secret},secret,true));
  await p.save(config,secret,true);
  assert.equal(calls.length,0, 'saving settings sends nothing');
  bodyResult='Accidental echo '+secret;
  const result=await p.complete({prompt:'Excerpt '+secret});
  assert.equal(calls.length,1, 'each action sends directly without a confirmation prompt');
  assert.ok(!result.content.includes(secret)); assert.ok(!calls[0].body.messages[0].content.includes(secret));
  assert.equal(calls[0].headers.Authorization,'Bearer '+secret);
  assert.equal(calls[0].url,baseURL+'/chat/completions'); assert.equal(calls[0].body.max_completion_tokens,800);
  assert.equal(calls[0].redirect,'error'); assert.equal(calls[0].credentials,'omit'); assert.equal(calls[0].referrerPolicy,'no-referrer');
  assert.ok(!JSON.stringify([...prefs]).includes(secret));
  await assert.rejects(p.save({...config,baseURL:claude}), /API key/);
  await p.save({...config,baseURL:claude,reasoning:'low',tokenParameter:'max_completion_tokens'},'claude-test-key');
  blocks=[{type:'thinking',thinking:'not a note'},{type:'text',text:'First'},{type:'text',text:'Then claude-test-key'}];
  const reply = await p.complete({prompt:'Claude excerpt claude-test-key'});
  assert.equal(reply.content,'First\nThen [credential redacted]');
  assert.equal(calls[1].body.messages[0].content,'Claude excerpt [credential redacted]');
  assert.equal(calls[1].url,claude+'/messages'); assert.equal(calls[1].headers.Authorization,undefined); assert.equal(calls[1].headers['x-api-key'],'claude-test-key'); assert.equal(calls[1].headers['anthropic-version'],'2023-06-01');
  assert.equal(calls[1].body.max_tokens,800); assert.equal(calls[1].body.reasoning_effort,undefined); assert.equal(calls[1].body.max_completion_tokens,undefined);
  blocks=[]; await assert.rejects(p.complete({prompt:'Empty reply'}),/no readable text/);
  p.shutdown(); await assert.rejects(p.complete({prompt:'No session key'}), /API key/);
  await p.save(config);
  context.Services.logins.modifyLogin = () => { throw Error('Locked store'); };
  await assert.rejects(p.save(config, 'replacement-fixture-key', true));
  assert.equal(p.keyFor(p.validateEndpoint(baseURL).endpoint), secret);
  assert.equal(p.memoryKeys.size, 0);
  status = 402; await assert.rejects(p.complete({ prompt: 'Limit test' }), error => /HTTP 402/.test(error.message) && !error.message.includes(secret));
  assert.equal(p.normalizeReferences('Claim [1:ABCDEFGH:IJKLMNOP]', [{ id: '1:ABCDEFGH:IJKLMNOP' }]), 'Claim [Source 1:ABCDEFGH:IJKLMNOP]');
  assert.throws(() => p.normalizeReferences('[Source 1:BAD:BAD]', []));
  assert.throws(() => p.normalizeReferences('[1:ABCDEFGH:IJKLMNOP]', []));
  p.forget(); assert.equal(logins.length, 0); assert.equal(p.config().enabled, false);
  const requestsBeforeDisable = calls.length;
  await assert.rejects(p.complete({prompt:'Disabled'}), /AI is off/);
  assert.equal(calls.length,requestsBeforeDisable);
  p.setPref('sendOnClickEnabled', true);
  context.Services.logins.findLogins = () => { throw Error('Locked store'); };
  assert.throws(() => p.forget()); assert.equal(p.config().enabled, false);
  console.log('Cloud provider guards, fresh click-to-send opt-in, key isolation, redaction, status handling and source attribution passed (mock transport, zero network).');
