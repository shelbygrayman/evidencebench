import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {pipeline,env} from '@huggingface/transformers';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {metrics} from '../bench.mjs';
const hash=data=>createHash('sha256').update(data).digest('hex');
const [sourcekeepDir,fixturePath,out,...extra]=process.argv.slice(2);
if(!sourcekeepDir||!fixturePath||!out||extra.length)throw Error('Usage: node evaluate.mjs SOURCEKEEP_DIR FIXTURE OUTPUT');
const corePath=resolve(sourcekeepDir,'core.js');
const {makeDocument,chunkDocument,lexicalSearch,cosine,fuseRanks}=await import(pathToFileURL(corePath));
function documentRanking(passages){const ids=[],seen=new Set();for(const p of passages)if(!seen.has(p.name)){seen.add(p.name);ids.push(p.name);if(ids.length===10)break;}return ids;}
const bytes=await readFile(fixturePath),fixture=JSON.parse(bytes);
if(fixture.schema!=='sourcekeep.browser-eval.v1'||fixture.documents.length!==30||fixture.queries.length!==20)throw Error('Unexpected fixture');
const docs=await Promise.all(fixture.documents.map(d=>makeDocument(d.id,d.text)));
const chunks=docs.flatMap(d=>chunkDocument(d));
const expected={'config.json':'55f755d351fd04b0fef37760e07e195eb47e15f7aed6fc42d9be3dde3d38bca4','tokenizer.json':'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0','tokenizer_config.json':'bd2e06a5b20fd1b13ca988bedc8763d332d242381b4fbc98f8fead4524158f79','onnx/model_quantized.onnx':'952f996d8cf46c311ee8654a750fa942b71c8b94aabe69d043dbb2bcaff5528e'};
for(const [file,digest] of Object.entries(expected))if(hash(await readFile('model/'+file))!==digest)throw Error('Model asset checksum mismatch: '+file);
const start=performance.now();
env.allowRemoteModels=false;
const model=await pipeline('feature-extraction','./model',{dtype:'q8',device:'cpu',local_files_only:true});
const loadMs=performance.now()-start;
async function embed(text){return (await model(text,{pooling:'mean',normalize:true})).tolist()[0];}
const t=performance.now(),vectors=[];
for(const [i,c] of chunks.entries()){vectors.push(await embed(c.text));if((i+1)%20===0)console.error(`Embedded ${i+1}/${chunks.length} passages`);}
const indexingMs=performance.now()-t;
const rows=[];
for(const q of fixture.queries){
  const lexical=lexicalSearch(chunks,q.text);
  const vector=await embed(q.text);
  const semantic=chunks.map((c,i)=>({...c,score:cosine(vectors[i],vector)})).sort((a,b)=>b.score-a.score);
  const hybrid=fuseRanks(lexical,semantic);
  const methods={};
  for(const [name,ranked] of Object.entries({keyword:lexical,semantic,hybrid})) {
    const ids=documentRanking(ranked);
    methods[name]={...metrics(ids,new Map(Object.entries(q.relevance))),documentIds:ids};
  }
  rows.push({queryId:q.id,relevant:q.relevance,methods});
  console.error(`Query ${rows.length}/${fixture.queries.length}`);
}
const means=Object.fromEntries(['keyword','semantic','hybrid'].map(mode=>[mode,Object.fromEntries(['ndcgAt10','recallAt5','mrrAt10'].map(metric=>[metric,rows.reduce((s,r)=>s+r.methods[mode][metric],0)/rows.length]))]));
const files=['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx'];
const modelHashes=Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await readFile('model/'+f))])));
const outReport={schema:'sourcekeep.cpu-quality-evaluation.v1',createdAt:new Date().toISOString(),fixtureSha256:hash(bytes),selection:fixture.selection,provenance:fixture.provenance,
 runtime:process.version,platform:`${process.platform}-${process.arch}`,cpu:os.cpus()[0]?.model,transformers:'4.3.1',model:'mixedbread-ai/mxbai-embed-xsmall-v1',revision:'e6ac24e5d6efb8782b59de1647b3ececb4ece94e',dtype:'q8',backend:'Node ONNX Runtime CPU',modelHashes,
 sourcekeepCoreSha256:hash(await readFile(corePath)),evaluatorSha256:hash(await readFile(new URL(import.meta.url))),metricsSha256:hash(await readFile(new URL('../bench.mjs',import.meta.url))),documents:docs.length,passages:chunks.length,queries:rows.length,loadMs,indexingMs,means,rows,
 protocol:'Actual Sourcekeep chunkDocument, lexicalSearch, cosine and fuseRanks. Model embeds each passage and query using mean pooling and normalization. Semantic ranking is cosine descending, hybrid uses Sourcekeep RRF over top 50 passages. Rankings collapse passages to unique documents for BEIR document-level judgments.',
 caveats:['Node CPU, not browser, WebGPU, or an end-to-end application benchmark.','Model assets were downloaded separately; loading time excludes download.','Small, deliberately constructed corpus: each query has at least one relevant document; judgments outside corpus are excluded.','Scientific claim-to-abstract retrieval differs from personal note search; no statistical superiority or general accuracy claim.','Public test labels are not contamination-proof; document relevance does not validate exact passage or truth.','No query-time comparisons reported; timings depend on hardware and workload.']};
await writeFile(out,JSON.stringify(outReport,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({documents:docs.length,passages:chunks.length,queries:rows.length,loadMs,indexingMs,means},null,2));
