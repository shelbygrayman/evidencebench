import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hash} from './bench.mjs';

// Fixed selection before running retrieval: one distinct judged document for each
// of the first 20 eligible query IDs, then the first ten other corpus IDs.
export function selectFixture(corpus, queries, qrels) {
  const docs = new Map(corpus.map(d => [String(d._id),d]));
  const qs = new Map(queries.map(q => [String(q._id),q]));
  if (docs.size !== corpus.length || qs.size !== queries.length) throw Error('Duplicate ID');
  const positives = new Map();
  for (const {queryId, docId, grade} of qrels) {
    if (!qs.has(queryId) || !docs.has(docId) || !Number.isInteger(grade) || grade < 0 || grade > 10) throw Error('Invalid qrel');
    if (grade > 0) {
      if (!positives.has(queryId)) positives.set(queryId,new Map());
      if (positives.get(queryId).has(docId)) throw Error('Duplicate qrel');
      positives.get(queryId).set(docId,grade);
    }
  }
  const selected=[], chosen=new Set();
  for (const qid of [...positives.keys()].sort()) {
    const docId=[...positives.get(qid).keys()].sort().find(id=>!chosen.has(id));
    if (!docId) continue;
    chosen.add(docId); selected.push(qid);
    if (selected.length===20) break;
  }
  if (selected.length!==20) throw Error('Need 20 queries with distinct relevant documents');
  for (const id of [...docs.keys()].sort()) { if (chosen.size===30) break; chosen.add(id); }
  if (chosen.size!==30) throw Error('Need 30 documents');
  const documents=[...chosen].sort().map(id=>{const d=docs.get(id); return {id,text:[d.title,d.text].filter(Boolean).join('\n')};});
  if (documents.some(d=>!d.text.trim()) || new Set(documents.map(d=>d.text)).size!==30) throw Error('Empty or duplicate text');
  return {schema:'sourcekeep.browser-eval.v1', selection:'First 20 lexicographic query IDs with distinct positive document, first eligible doc ID per query, then first 10 remaining corpus IDs; qrels restricted to selected corpus.',
    documents, queries:selected.map(id=>({id,text:qs.get(id).text,relevance:Object.fromEntries([...positives.get(id)].filter(([d])=>chosen.has(d)))}))};
}
async function main() {
  const [folder,out,...rest]=process.argv.slice(2); if(!folder||!out||rest.length) throw Error('Usage: node make-browser-fixture.mjs DATA_FOLDER OUTPUT.json');
  const contents=await Promise.all(['corpus.jsonl','queries.jsonl','qrels/test.tsv'].map(x=>readFile(join(folder,x),'utf8')));
  const parse=s=>s.trim().split(/\r?\n/).map(x=>JSON.parse(x));
  const lines=contents[2].trim().split(/\r?\n/); if(lines.shift()!=='query-id\tcorpus-id\tscore') throw Error('Bad qrels header');
  const qrels=lines.map(line=>{const p=line.split('\t');if(p.length!==3||!/^\d+$/.test(p[2])) throw Error('Bad qrel');return {queryId:p[0],docId:p[1],grade:Number(p[2])};});
  const fixture=selectFixture(parse(contents[0]),parse(contents[1]),qrels);
  fixture.provenance={corpusSha256:hash(contents[0]),queriesSha256:hash(contents[1]),qrelsSha256:hash(contents[2]),notice:'User-supplied dataset; attribution and licensing apply. Scientific claims, not representative personal notes.'};
  await writeFile(resolve(out),JSON.stringify(fixture,null,2)+'\n',{flag:'wx'});
  console.log(`Wrote ${fixture.documents.length} documents and ${fixture.queries.length} queries to ${resolve(out)}`);
}
if (process.argv[1] && resolve(process.argv[1])===new URL(import.meta.url).pathname) main().catch(e=>{console.error(e.message);process.exitCode=1;});
