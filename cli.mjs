import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {buildIndex,search,metrics,evidence,verify,percentile,hash} from './bench.mjs';

async function main() {
  const [folder,out,...extra]=process.argv.slice(2);
  if(!folder || !out || extra.length) throw Error('Usage: node cli.mjs DATA_FOLDER OUTPUT.json (output must not exist)');
  const files=await Promise.all(['corpus.jsonl','queries.jsonl','qrels/test.tsv'].map(f=>readFile(join(folder,f),'utf8')));
  const isSciFact=['dec31c8182f3d744c7d2c09423756fd1d17cbef75808db13ba01cc0aab4d1ac6','8ff84a7c903f722981cd8d595c022660140c51867b27608a6d4910db86080313','0864bb985e0ca2367ba217977e72004d549054b2b06666ed9d4825ac7c21284c'].every((expected,i)=>hash(files[i])===expected);
  const jsonl=s=>s.trim().split(/\r?\n/).map(x=>JSON.parse(x));
  const documents=jsonl(files[0]).map(d=>({id:String(d._id),text:[d.title,d.text].filter(Boolean).join('\n')}));
  const queries=jsonl(files[1]);
  if(new Set(queries.map(q=>q._id)).size!==queries.length) throw Error('Duplicate query IDs');
  const queryMap=new Map(queries.map(q=>[String(q._id),q.text])), docs=new Map(documents.map(d=>[d.id,d]));
  const lines=files[2].trim().split(/\r?\n/), labels=new Map();
  if(lines.shift()!=='query-id\tcorpus-id\tscore') throw Error('Unexpected qrels header');
  for(const line of lines) {
    const parts=line.split('\t');
    if(parts.length!==3) throw Error('Malformed qrel');
    const [qid,did,grade]=parts;
    if(!queryMap.has(qid)||!docs.has(did)||!/^\d+$/.test(grade)||Number(grade)>10) throw Error('Unknown ID or invalid grade');
    if(!labels.has(qid)) labels.set(qid,new Map());
    if(labels.get(qid).has(did)) throw Error('Duplicate qrel');
    labels.get(qid).set(did,Number(grade));
  }
  if(!labels.size) throw Error('Empty evaluation split');
  const start=performance.now(),index=buildIndex(documents),indexMs=performance.now()-start;
  const ids=[...labels.keys()].sort((a,b)=>a.localeCompare(b)), methods={};
  // Fixed settings and all labeled test queries; do not tune against this report.
  for(const mode of ['bm25','tfidf']) {
    for(const id of ids) search(index,queryMap.get(id),mode);
    const rows=[];
    for(const id of ids) {
      const timings=[]; let results;
      for(let repeat=0;repeat<3;repeat++) {const begin=performance.now(); results=search(index,queryMap.get(id),mode); timings.push(performance.now()-begin);}
      const records=results.map(r=>evidence(r,docs.get(r.docId)));
      if(!records.every(r=>verify(r,docs.get(r.docId)))) throw Error('Evidence verification failed');
      rows.push({queryId:id,queryHash:hash(queryMap.get(id)),...metrics(results.map(r=>r.docId),labels.get(id)),timingsMs:timings,
        results:results.map((r,i)=>({docId:r.docId,score:r.score,evidence:records[i]}))});
    }
    const timings=rows.flatMap(r=>r.timingsMs);
    methods[mode]={summary:Object.fromEntries(['ndcgAt10','recallAt5','mrrAt10'].map(k=>[k,rows.reduce((s,r)=>s+r[k],0)/rows.length])),
      p50Ms:percentile(timings,.5),p95Ms:percentile(timings,.95),evidenceVerified:rows.reduce((s,r)=>s+r.results.length,0),rows};
  }
  const report={schema:'evidencebench.v1',createdAt:new Date().toISOString(),runtime:process.version,platform:`${process.platform}-${process.arch}`,cpu:os.cpus()[0]?.model,
    codeSha256:hash(await readFile(new URL('./bench.mjs',import.meta.url))),cliSha256:hash(await readFile(new URL('./cli.mjs',import.meta.url))),
    dataset:{name:isSciFact?'BEIR SciFact':'User-supplied BEIR-layout data',split:'test',documents:documents.length,queries:ids.length,corpusSha256:hash(files[0]),queriesSha256:hash(files[1]),qrelsSha256:hash(files[2]),license:isSciFact?'CC-BY-SA-4.0':'Not determined'},
    protocol:{version:1,chunkSize:700,overlap:0,documentAggregation:'max passage score',k1:1.2,b:0.75,warmupPasses:1,measuredRepeats:3,limit:10,queryOrder:'lexicographic ID',methodsOrder:['bm25','tfidf'],offsets:'UTF-16, end exclusive; source = title + newline + abstract',timing:'search only; excludes ingestion, evidence verification, and report serialization'},
    indexMs,passages:index.passages.length,methods,
    caveats:['Fixed lexical baselines only; no embedding model evaluated.','Public externally authored test data, not private or contamination-proof.','Document labels do not establish passage relevance or claim truth.','Timing on one machine; methods run sequentially, no statistical superiority claim.','No BM25 parameter tuning performed on these test labels.']};
  await writeFile(resolve(out),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output:resolve(out),dataset:report.dataset,indexMs,methods:Object.fromEntries(Object.entries(methods).map(([k,v])=>[k,{...v.summary,p50Ms:v.p50Ms,p95Ms:v.p95Ms,evidenceVerified:v.evidenceVerified}]))},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
