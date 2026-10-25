import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {hash} from './bench.mjs';
const base='https://huggingface.co/datasets/';
const files=[
  ['corpus.jsonl','BeIR/scifact/resolve/a75ae049398addde9b70f6b268875f5cbce99089/corpus.jsonl.gz','dec31c8182f3d744c7d2c09423756fd1d17cbef75808db13ba01cc0aab4d1ac6'],
  ['queries.jsonl','BeIR/scifact/resolve/a75ae049398addde9b70f6b268875f5cbce99089/queries.jsonl.gz','8ff84a7c903f722981cd8d595c022660140c51867b27608a6d4910db86080313'],
  ['qrels/test.tsv','BeIR/scifact-qrels/resolve/main/test.tsv','0864bb985e0ca2367ba217977e72004d549054b2b06666ed9d4825ac7c21284c']
];
try {
  await mkdir('data/scifact/qrels',{recursive:true});
  for(const [name,url,expected] of files) {
    const path=join('data/scifact',name);
    let existing;
    try {existing=await readFile(path);} catch(e) {if(e.code!=='ENOENT') throw e;}
    if(existing) {if(hash(existing)!==expected) throw Error(`Existing file checksum mismatch: ${name}`);console.log(`Verified ${name}`);continue;}
    const response=await fetch(base+url,{signal:AbortSignal.timeout(60000)});
    if(!response.ok) throw Error(`Download failed: HTTP ${response.status}`);
    const raw=Buffer.from(await response.arrayBuffer());
    const data=url.endsWith('.gz')?gunzipSync(raw,{maxOutputLength:20000000}):raw;
    if(hash(data)!==expected) throw Error(`Download checksum mismatch: ${name}`);
    await writeFile(path,data,{flag:'wx'});console.log(`Downloaded and verified ${name}`);
  }
} catch(error) {console.error(error.message);process.exitCode=1;}
