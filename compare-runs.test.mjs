import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareRuns} from './compare-runs.mjs';
const hash='a'.repeat(64), dataset={corpusSha256:hash,queriesSha256:hash,qrelsSha256:hash};
const row=(id,docs)=>({queryId:id,queryHash:hash,results:docs.map(docId=>({docId}))});
const reports=()=>[{schema:'sourcekeep-evaluation.v1',dataset,rows:[row('q1',['1','2']),row('q2',['3'])]}, {schema:'evidencebench.v1',dataset,methods:{bm25:{rows:[row('q1',['1','2']),row('q2',['4'])]}}}];
test('reports per-query rank and top-result differences',()=>{const [a,b]=reports();const r=compareRuns(a,b);assert.equal(r.sameTop,1);assert.equal(r.identicalRankings,1);assert.equal(r.differences[0].queryId,'q2');});
test('refuses to compare mismatched datasets, queries and duplicate result ids',()=>{let [a,b]=reports();b={...b,dataset:{...dataset,corpusSha256:'b'.repeat(64)}};assert.throws(()=>compareRuns(a,b),/Dataset mismatch/);[a,b]=reports();b.methods.bm25.rows[0].queryHash='bad';assert.throws(()=>compareRuns(a,b),/mismatched query/);[a,b]=reports();a.rows[0]=row('q1',['1','1']);assert.throws(()=>compareRuns(a,b),/duplicate document/);});

test('two empty rankings have no shared top result',()=>{const [a,b]=reports();a.rows[0]=row('q1',[]);b.methods.bm25.rows[0]=row('q1',[]);assert.equal(compareRuns(a,b).sameTop,0);});
