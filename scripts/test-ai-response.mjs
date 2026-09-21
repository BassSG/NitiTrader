import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const logs=[];
const sandbox={health_:(topic,detail)=>logs.push({topic,detail})};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../backend/gas/Code.gs',import.meta.url),'utf8'),sandbox);
sandbox.health_=(topic,detail)=>logs.push({topic,detail});
const context={candidates:[{candidateId:'zone-1'}]};
const valid={decision:'SELECT',candidateId:'zone-1',reason:'มีหลักฐาน',risks:['ข่าว']};
const response=(data,finish='stop')=>({id:'test-generation',choices:[{finish_reason:finish,message:{content:JSON.stringify(data)}}]});
const parse=r=>sandbox.parseAiDecision_(r,context,'test-run');
let count=0;
function ok(name,fn){fn();count++;console.log('PASS '+name);}
ok('valid SELECT',()=>assert.equal(parse(response(valid)).candidateId,'zone-1'));
ok('valid WAIT',()=>assert.equal(parse(response({...valid,decision:'WAIT',candidateId:null,risks:[]})).decision,'WAIT'));
ok('safe text normalization',()=>{
  const d=parse(response({...valid,decision:' select ',candidateId:' zone-1 ',risks:' ข่าว '}));
  assert.equal(d.decision,'SELECT');assert.equal(d.risks[0],'ข่าว');
});
ok('fenced JSON and content blocks',()=>{
  const r=response(valid);r.choices[0].message.content=[{type:'text',text:'```json\n'+JSON.stringify(valid)+'\n```'}];
  assert.equal(parse(r).candidateId,'zone-1');
});
for(const [name,change,pattern] of [
  ['missing decision',{decision:undefined},/decision/],
  ['invented decision',{decision:'BUY'},/decision/],
  ['missing reason',{reason:undefined},/reason/],
  ['blank reason',{reason:' '},/reason/],
  ['missing risks',{risks:undefined},/risks/],
  ['null risks',{risks:null},/risks/],
  ['object risk',{risks:[{text:'news'}]},/risks/],
  ['blank risk',{risks:['']},/risks/],
  ['unknown candidate',{candidateId:'invented'},/candidateId/],
  ['numeric candidate',{candidateId:123},/candidateId/],
  ['WAIT with candidate',{decision:'WAIT'},/candidateId/]
])ok(name,()=>assert.throws(()=>parse(response({...valid,...change})),pattern));
ok('truncated complete-looking response',()=>assert.throws(()=>parse(response(valid,'length')),/ขีดจำกัด/));
ok('nonterminal response',()=>assert.throws(()=>parse(response(valid,'tool_calls')),/ไม่จบ/));
ok('refusal',()=>{const r=response(valid);r.choices[0].message.refusal='refused';assert.throws(()=>parse(r),/ปฏิเสธ/);});
ok('malformed JSON',()=>{const r=response(valid);r.choices[0].message.content='{';assert.throws(()=>parse(r),/JSON/);});
ok('array root',()=>assert.throws(()=>parse(response([valid])),/วัตถุ JSON/));
ok('no choices',()=>assert.throws(()=>parse({id:'empty',choices:[]}),/ไม่มีข้อความ/));
ok('field diagnostics without raw content',()=>{
  assert(logs.some(x=>x.topic==='AI_RESPONSE_NORMALIZED'));
  const err=logs.find(x=>x.topic==='AI_RESPONSE_ERROR'&&JSON.parse(x.detail).issue.includes('reason'));
  assert(err);assert.equal(JSON.parse(err.detail).run,'test-run');
  assert(!logs.some(x=>x.detail.includes('มีหลักฐาน')));
});
console.log(count+' AI response tests passed; no external API calls.');
