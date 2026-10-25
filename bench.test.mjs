import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildIndex,search,chunks,metrics,evidence,verify,percentile} from './bench.mjs';
test('metrics match hand-calculated graded ranking',()=>{
  const m=metrics(['b','x','a'],new Map([['a',2],['b',1]]));
  assert.equal(m.recallAt5,1); assert.equal(m.mrrAt10,1);
  assert.ok(Math.abs(m.ndcgAt10-(1+3/2)/(3+1/Math.log2(3)))<1e-12);
});
test('misses and rank boundaries retain the full denominator',()=>{
  const labels=new Map([['a',1],['b',1]]);
  assert.deepEqual(metrics([],labels),{ndcgAt10:0,recallAt5:0,mrrAt10:0});
  assert.equal(metrics(['x','y','z','q','a','b'],labels).recallAt5,.5);
  assert.equal(metrics(['x','y','z','q','a','b'],labels).mrrAt10,.2);
});
test('invalid and duplicated relevance cannot inflate metrics',()=>{
  assert.throws(()=>metrics(['a','a'],new Map([['a',1]])));
  for(const grade of [-1,NaN,11,.5]) assert.throws(()=>metrics([],new Map([['a',grade]])));
  assert.throws(()=>metrics([],new Map()));
});
test('BM25 score agrees with its formula and repeated query terms deduplicate',()=>{
  const idx=buildIndex([{id:'a',text:'apple apple pear'},{id:'b',text:'pear'}]);
  const result=search(idx,'apple apple');
  assert.equal(result[0].docId,'a');
  assert.ok(Math.abs(result[0].score-Math.log(2)*4.4/(2+1.2*(.25+.75*3/2)))<1e-12);
  assert.deepEqual(result,search(idx,'apple'));
});
test('ranking is deterministic, deduplicated by document, and abstains without overlap',()=>{
  const idx=buildIndex([{id:'b',text:'apple '.repeat(300)},{id:'a',text:'apple'}]);
  assert.equal(new Set(search(idx,'apple').map(r=>r.docId)).size,2);
  for(const mode of ['bm25','tfidf']) assert.deepEqual(search(idx,'quasarzz',mode),[]);
  assert.deepEqual(search(idx,'the and'),[]);
  assert.throws(()=>search(idx,'apple','magic'));
});
test('UTF-16 chunks preserve emoji and exact source offsets',()=>{
  const doc={id:'unicode',text:'x'.repeat(49)+'😀'+'y'.repeat(100)};
  const parts=chunks(doc,50);
  assert.equal(parts.map(p=>p.text).join(''),doc.text);
  for(const p of parts) assert.ok(verify(evidence(p,doc),doc));
  assert.equal(parts[0].end,49);
});
test('tampered source, excerpt, bounds and identity fail verification',()=>{
  const doc={id:'a',text:'alpha beta'},r=chunks(doc)[0],record=evidence(r,doc);
  assert.ok(verify(record,doc));
  for(const mutation of [{start:-1},{end:100},{end:0},{docId:'b'},{excerptHash:'x'},{sourceHash:'x'}]) assert.equal(verify({...record,...mutation},doc),false);
  assert.equal(verify(record,{...doc,text:'altered'}),false);
  assert.equal(verify(record,null),false);
  assert.throws(()=>evidence({...r,text:'fake'},doc));
});
test('empty and duplicate corpora rejected',()=>{
  assert.throws(()=>buildIndex([]));
  assert.throws(()=>buildIndex([{id:'a',text:'a'},{id:'a',text:'b'}]));
  assert.throws(()=>chunks({id:'a',text:''}));
});
test('nearest-rank percentiles handle exact boundaries without mutation',()=>{
  const a=[4,1,3,2]; assert.equal(percentile(a,.5),2);assert.equal(percentile(a,.95),4);
  assert.deepEqual(a,[4,1,3,2]);assert.throws(()=>percentile([], .5));
});
test('CLI evaluates all queries, labels custom data honestly, and protects existing reports',()=>{
  const dir=mkdtempSync(join(tmpdir(),'evidencebench-'));
  try {
    mkdirSync(join(dir,'qrels'));
    writeFileSync(join(dir,'corpus.jsonl'),JSON.stringify({_id:'a',title:'Apple',text:'fresh fruit'})+'\n'+JSON.stringify({_id:'b',title:'Rocket',text:'space engine'})+'\n');
    writeFileSync(join(dir,'queries.jsonl'),JSON.stringify({_id:'q1',text:'apple'})+'\n'+JSON.stringify({_id:'q2',text:'unmatchedzz'})+'\n');
    writeFileSync(join(dir,'qrels/test.tsv'),'query-id\tcorpus-id\tscore\nq1\ta\t1\nq2\tb\t1\n');
    const output=join(dir,'report.json');
    const run=()=>spawnSync(process.execPath,[new URL('./cli.mjs',import.meta.url).pathname,dir,output],{encoding:'utf8'});
    assert.equal(run().status,0);
    const report=JSON.parse(readFileSync(output,'utf8'));
    assert.equal(report.dataset.name,'User-supplied BEIR-layout data');
    assert.equal(report.dataset.queries,2);
    assert.equal(report.methods.bm25.summary.recallAt5,.5);
    const before=readFileSync(output,'utf8');
    assert.equal(run().status,1);assert.equal(readFileSync(output,'utf8'),before);
    writeFileSync(join(dir,'qrels/test.tsv'),'query-id\tcorpus-id\tscore\nq1\tmissing\t1\n');
    assert.match(run().stderr,/Unknown ID/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
