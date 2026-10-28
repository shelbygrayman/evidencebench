import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run = promisify(execFile);

test('Sourcekeep adapter scores document labels, verifies excerpts, and refuses overwrite', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sourcekeep-eval-'));
  try {
    await mkdir(join(dir, 'qrels'));
    await writeFile(join(dir, 'corpus.jsonl'), [
      {_id:'1', title:'', text:'Oranges are citrus fruit.'},
      {_id:'2', title:'', text:'Astronomy studies distant stars.'}
    ].map(JSON.stringify).join('\n')+'\n');
    await writeFile(join(dir, 'queries.jsonl'), JSON.stringify({_id:'q',text:'citrus'})+'\n');
    await writeFile(join(dir, 'qrels/test.tsv'), 'query-id\tcorpus-id\tscore\nq\t1\t1\n');
    const output=join(dir,'result.json');
    const args=['sourcekeep-eval.mjs',resolve(process.env.SOURCEKEEP_DIR || '../sourcekeep'),dir,output];
    await run(process.execPath,args);
    const report=JSON.parse(await readFile(output,'utf8'));
    assert.equal(report.summary.ndcgAt10,1);
    assert.equal(report.summary.recallAt5,1);
    assert.equal(report.rows[0].results[0].docId,'1');
    assert.equal(report.summary.evidenceVerified,1);
    await assert.rejects(run(process.execPath,args));
  } finally { await rm(dir,{recursive:true,force:true}); }
});
