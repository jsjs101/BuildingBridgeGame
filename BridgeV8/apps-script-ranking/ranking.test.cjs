const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');

function server() {
  const rows=[], properties=new Map(), cache=new Map();
  let locked=false;
  const sheet={getLastRow:()=>rows.length,appendRow:row=>rows.push([...row]),setFrozenRows(){},getRange(row,column,count,width){return {getValues:()=>rows.slice(row-1,row-1+count).map(values=>Array.from({length:width},(_,index)=>values[column-1+index]??'')),setValues:values=>values.forEach((value,index)=>{rows[row-1+index] ||= [];value.forEach((cell,offset)=>{rows[row-1+index][column-1+offset]=cell})})}}};
  const spreadsheet={getId:()=> 'test-sheet',getSheetByName:()=>rows.length?sheet:null,insertSheet:()=>sheet};
  const context=vm.createContext({console:{error(){}},PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value)})},SpreadsheetApp:{getActiveSpreadsheet:()=>spreadsheet,openById:()=>spreadsheet,flush(){}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()]},LockService:{getScriptLock:()=>({tryLock:()=>{locked=true;return true},hasLock:()=>locked,releaseLock:()=>{locked=false}})},CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value)})}});
  vm.runInContext(fs.readFileSync(__dirname+'/Code.gs','utf8'),context);
  context.setupRanking();
  return {rows,cache,context,post:input=>context.doPost({postData:{contents:JSON.stringify(input)}}),get:(overrides={})=>context.doGet({parameter:{season:'v8-1',levelId:'set01_level01',difficulty:'easy',cost:'220',...overrides}})};
}
function record(overrides={}) {
  return {action:'submit',season:'v8-1',levelId:'set01_level01',difficulty:'easy',nickname:'테스트 설계자',token:'a'.repeat(64),attemptId:crypto.randomBytes(32).toString('hex'),cost:220,timeMs:1000,peakRatio:.5,design:{nodes:[[0,0],[100,0]],members:[[0,1,'road']]},...overrides};
}

test('empty board has no invented percentile',()=>{
  const api=server(), response=api.get();
  assert.equal(response.total,0);assert.equal(response.comparison,null);assert.equal(response.entries.length,0);
});
test('multiple completions from one browser remain separate and exclude private identity',()=>{
  const api=server(), response=api.post(record());
  assert.equal(response.ok,true);assert.equal(response.total,1);assert.equal(response.comparison.rank,1);assert.equal(response.comparison.percentile,100);
  assert.equal(response.entries[0].mine,true);assert.equal(response.entries[0].cost,220);
  assert.equal(JSON.stringify(response).includes('a'.repeat(64)),false);assert.equal('player' in response.entries[0],false);
  api.cache.clear();
  const worse=api.post(record({cost:440,design:{nodes:[[0,0],[200,0]],members:[[0,1,'road']]}}));
  assert.equal(worse.registered,true);assert.equal(worse.comparison.cost,440);assert.equal(api.rows.length,3);
  api.cache.clear();
  const improved=api.post(record({cost:110,design:{nodes:[[0,0],[50,0]],members:[[0,1,'road']]}}));
  assert.equal(improved.registered,true);assert.equal(improved.comparison.cost,110);assert.equal(api.rows.length,4);
});
test('ties share rank, predictions include candidate, and histogram includes all players',()=>{
  const api=server();
  api.post(record());api.post(record({token:'b'.repeat(64)}));api.post(record({token:'c'.repeat(64),cost:440,design:{nodes:[[0,0],[200,0]],members:[[0,1,'road']]}}));
  const response=api.get({cost:'440'});
  assert.deepEqual(response.entries.map(entry=>entry.rank),[1,1,3]);
  assert.equal(response.comparison.rank,3);assert.equal(response.comparison.total,4);assert.equal(response.comparison.percentile,75);
  assert.equal(response.histogram.reduce((sum,count)=>sum+count,0),3);
});
test('contracts, difficulty, season are isolated',()=>{
  const api=server();api.post(record());
  assert.equal(api.get({difficulty:'hard'}).total,0);assert.equal(api.get({levelId:'set02_bonus01'}).total,0);
  assert.equal(api.get({season:'invalid'}).ok,false);
});
test('same cost separate completions are both retained',()=>{
  const api=server();api.post(record());api.cache.clear();
  const response=api.post(record({timeMs:500}));
  assert.equal(response.registered,true);assert.equal(response.entries.find(entry=>entry.mine).timeMs,500);assert.equal(api.rows.length,3);
});
test('server rejects forged cost and malformed or oversized geometry',()=>{
  for(const overrides of [{cost:1},{timeMs:0},{peakRatio:-1},{nickname:'=IMPORTXML("url")'},{token:'x'},{design:{nodes:[[0,0],[100,0]],members:[[0,2,'road']]}},{design:{nodes:[[0,0],[100,0]],members:[[0,1,'invalid']]}},{design:{nodes:[[0,0],[100,0]],members:[[0,1,'road'],[1,0,'wood']]}},{design:{nodes:Array(301).fill([0,0]),members:[[0,1,'road']]}}]) {
    const api=server(), response=api.post(record(overrides));assert.equal(response.ok,false,JSON.stringify(overrides));assert.equal(api.rows.length,1);
  }
});
test('server enforces cooldown and setup is non-destructive',()=>{
  const api=server();assert.equal(api.post(record()).ok,true);assert.equal(api.post(record()).ok,false);
  api.context.setupRanking();assert.equal(api.rows.length,2);
});
test('own entry outside top eight is still returned',()=>{
  const api=server();
  for(let i=0;i<9;i++)api.post(record({token:(i+1).toString(16).repeat(64)}));
  const response=api.post(record({token:'f'.repeat(64),cost:440,design:{nodes:[[0,0],[200,0]],members:[[0,1,'road']]}}));
  assert.equal(response.entries.length,9);assert.equal(response.entries[8].mine,true);assert.equal(response.entries[8].rank,10);
});

test('retrying one completion is idempotent even during cooldown',()=>{
  const api=server(), attempt=record();
  assert.equal(api.post(attempt).duplicate,false);
  const retry=api.post(attempt);
  assert.equal(retry.registered,true);assert.equal(retry.duplicate,true);assert.equal(api.rows.length,2);
});
test('setup migrates the old eight columns without changing records or identity',()=>{
  const api=server();api.post(record());
  const previous=JSON.stringify(api.rows[1].slice(0,8));
  api.rows.forEach(row=>row.length=8);
  assert.equal(api.get().ok,false);
  api.context.setupRanking();
  assert.equal(api.rows[0][8],'attemptId');assert.equal(JSON.stringify(api.rows[1].slice(0,8)),previous);
  assert.equal(api.get().total,1);
  api.cache.clear();assert.equal(api.post(record()).total,2);
});
