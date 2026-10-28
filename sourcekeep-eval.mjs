// Evaluate Sourcekeep's unmodified keyword implementation against BEIR document labels.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {metrics, percentile, hash, evidence, verify} from './bench.mjs';

async function main() {
  const [sourceDir, folder, out, ...extra] = process.argv.slice(2);
  if (!sourceDir || !folder || !out || extra.length) throw Error('Usage: node sourcekeep-eval.mjs SOURCEKEEP_DIR BEIR_DATA_DIR OUTPUT.json');
  const corePath = resolve(sourceDir, 'core.js');
  const {chunkDocument, lexicalSearch} = await import(pathToFileURL(corePath));
  const files = await Promise.all(['corpus.jsonl', 'queries.jsonl', 'qrels/test.tsv'].map(f => readFile(join(folder, f), 'utf8')));
  const parse = s => s.trim().split(/\r?\n/).map(line => JSON.parse(line));
  const docs = parse(files[0]).map(d => { const text = [d.title, d.text].filter(Boolean).join('\n'); return {id: hash(text), originalId: String(d._id), name: String(d._id), text}; });
  if (new Set(docs.map(d => d.id)).size !== docs.length) throw Error('Duplicate document text: Sourcekeep deduplicates it; document labels cannot be mapped unambiguously.');
  if (new Set(docs.map(d => d.originalId)).size !== docs.length || docs.some(d => !d.text.trim())) throw Error('Invalid or duplicate corpus document');
  const queries = parse(files[1]);
  const queryMap = new Map(queries.map(q => [String(q._id), q.text]));
  if (queryMap.size !== queries.length || queries.some(q => typeof q.text !== 'string')) throw Error('Invalid or duplicate query');
  const byId = new Map(docs.map(d => [d.id, d]));
  const originalIds = new Set(docs.map(d => d.originalId));
  const lines = files[2].trim().split(/\r?\n/), labels = new Map();
  if (lines.shift() !== 'query-id\tcorpus-id\tscore') throw Error('Unexpected qrels header');
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length !== 3) throw Error('Malformed qrel');
    const [q, d, score] = parts;
    if (!queryMap.has(q) || !originalIds.has(d) || !/^\d+$/.test(score) || +score > 10) throw Error('Invalid qrel');
    if (!labels.has(q)) labels.set(q, new Map());
    if (labels.get(q).has(d)) throw Error('Duplicate qrel');
    labels.get(q).set(d, +score);
  }
  if (!labels.size) throw Error('No labeled queries');
  const beginIndex = performance.now(), passages = docs.flatMap(d => chunkDocument(d));
  const chunkMs = performance.now() - beginIndex, rows = [];
  for (const id of [...labels.keys()].sort((a,b) => a.localeCompare(b))) {
    const start = performance.now();
    const ranked = lexicalSearch(passages, queryMap.get(id));
    const elapsed = performance.now() - start;
    // Document labels require collapsing the full passage ranking; UI shows only six passages.
    const seen = new Set(), top = [];
    for (const p of ranked) {
      const d = byId.get(p.docId);
      if (!d || seen.has(d.originalId)) continue;
      seen.add(d.originalId);
      const record = evidence(p, d);
      if (!verify(record, d)) throw Error('Evidence check failed');
      top.push({docId:d.originalId, score:p.score, evidence:record});
      if (top.length === 10) break;
    }
    rows.push({queryId:id, queryHash:hash(queryMap.get(id)), ...metrics(top.map(r => r.docId), labels.get(id)), searchMs:elapsed, results:top});
    if (rows.length % 25 === 0) console.error(`Evaluated ${rows.length}/${labels.size} queries`);
  }
  const report = {schema:'sourcekeep-evaluation.v1', createdAt:new Date().toISOString(), runtime:process.version, platform:`${process.platform}-${process.arch}`, cpu:os.cpus()[0]?.model,
    sourcekeepCoreSha256:hash(await readFile(corePath)), harnessSha256:hash(await readFile(new URL(import.meta.url))),
    dataset:{documents:docs.length, queries:rows.length, corpusSha256:hash(files[0]), queriesSha256:hash(files[1]), qrelsSha256:hash(files[2])},
    protocol:{method:'Sourcekeep lexicalSearch and chunkDocument', chunkSize:700, documentAggregation:'first occurrence in full passage ranking', maxDocuments:10, timing:'one search per query in Node; includes tokenization and sorting, excludes chunking and verification', queryOrder:'lexicographic ID', warmup:'none'},
    chunkMs, passages:passages.length,
    summary:{...Object.fromEntries(['ndcgAt10','recallAt5','mrrAt10'].map(k => [k, rows.reduce((s,r) => s+r[k],0)/rows.length])),p50Ms:percentile(rows.map(r=>r.searchMs),.5),p95Ms:percentile(rows.map(r=>r.searchMs),.95), evidenceVerified:rows.reduce((s,r)=>s+r.results.length,0)}, rows,
    caveats:['Node evaluation of unmodified core functions, not a browser performance measurement.','The full corpus can exceed app limits and is not an ordinary Sourcekeep session.','Document-level deduplication and top 10 differ from the UI, which displays six passages.','Labels assess document relevance, not selected passage relevance or truth.','No semantic or hybrid model evaluated. Public test set is not a private holdout.','Single sequential timing per query; runtime and machine affect latency.']};
  await writeFile(resolve(out), JSON.stringify(report,null,2)+'\n', {flag:'wx'});
  console.log(JSON.stringify({output:resolve(out),dataset:report.dataset,passages:report.passages,chunkMs,summary:report.summary},null,2));
}
main().catch(e => {console.error(e.message); process.exitCode=1;});
