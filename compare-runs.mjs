import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hash} from './bench.mjs';

// Compare rankings only when both reports identify the same inputs and queries.
export function compareRuns(sourcekeep, baseline) {
  if(sourcekeep?.schema!=='sourcekeep-evaluation.v1' || baseline?.schema!=='evidencebench.v1') throw Error('Unsupported report schemas');
  for(const key of ['corpusSha256','queriesSha256','qrelsSha256']) {
    if(!/^[0-9a-f]{64}$/.test(sourcekeep.dataset?.[key] || '') || sourcekeep.dataset[key]!==baseline.dataset?.[key]) throw Error(`Dataset mismatch: ${key}`);
  }
  const left=sourcekeep.rows, right=baseline.methods?.bm25?.rows;
  if(!Array.isArray(left)||!Array.isArray(right)||!left.length||left.length!==right.length) throw Error('Query counts differ or are empty');
  const validate=rows=>{
    const ids=new Set();
    for(const row of rows){
      if(typeof row.queryId!=='string'||ids.has(row.queryId)||!Array.isArray(row.results)||!row.queryHash) throw Error('Invalid or duplicate query');
      ids.add(row.queryId);
      const docs=row.results.map(r=>r.docId);
      if(docs.some(id=>typeof id!=='string'||!id)||new Set(docs).size!==docs.length) throw Error('Invalid or duplicate document ID');
    }
  };
  validate(left);validate(right);
  const byId=new Map(right.map(r=>[r.queryId,r])), differences=[];let sameTop=0;
  for(const row of left){
    const other=byId.get(row.queryId);
    if(!other||other.queryHash!==row.queryHash) throw Error(`Missing or mismatched query: ${row.queryId}`);
    const a=row.results.map(r=>r.docId),b=other.results.map(r=>r.docId);
    if((a[0]??null)===(b[0]??null))sameTop++;
    if(a.length!==b.length||a.some((id,i)=>id!==b[i])) differences.push({queryId:row.queryId,sourcekeep:a,baseline:b});
  }
  return {schema:'evidencebench.rank-comparison.v1',dataset:sourcekeep.dataset,queries:left.length,sameTop,identicalRankings:left.length-differences.length,differences,
    caveats:['Compares the returned document IDs, not relevance, statistical significance, passage identity or timing.','Matching data hashes do not prove matching implementation, parameters, or no test-data contamination.','Public SciFact queries assess scientific-document relevance, not personal notes or truth.']};
}
async function main(){
  const [a,b,out,...rest]=process.argv.slice(2);if(!a||!b||!out||rest.length)throw Error('Usage: node compare-runs.mjs SOURCEKEEP.json EVIDENCEBENCH.json OUTPUT.json');
  const [rawA,rawB]=await Promise.all([readFile(a,'utf8'),readFile(b,'utf8')]);
  const report=compareRuns(JSON.parse(rawA),JSON.parse(rawB));
  report.inputSha256={sourcekeep:hash(rawA),evidencebench:hash(rawB)};
  await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({queries:report.queries,sameTop:report.sameTop,identicalRankings:report.identicalRankings,differentRankings:report.differences.length,output:out},null,2));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
