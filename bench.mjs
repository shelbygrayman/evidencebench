import { createHash } from 'node:crypto';
export const hash = text => createHash('sha256').update(text).digest('hex');
const stop = new Set('a an the is are was were to of for in on at and or with my i it this that how what when where do does can'.split(' '));
export const terms = text => (text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => !stop.has(t));
export function chunks(doc, size=700) {
  if (!Number.isInteger(size) || size<50) throw Error('Invalid chunk size');
  if (typeof doc.id!=='string' || !doc.id || typeof doc.text!=='string' || !doc.text.trim()) throw Error('Invalid document');
  const rows=[];
  for(let start=0;start<doc.text.length;) {
    let end=Math.min(start+size,doc.text.length);
    if(end<doc.text.length) {
      const boundary=doc.text.lastIndexOf(' ',end);
      if(boundary>start+size/2) end=boundary;
      const c=doc.text.charCodeAt(end-1);
      if(c>=0xd800 && c<=0xdbff) end--;
    }
    const text=doc.text.slice(start,end);
    if(text.trim()) rows.push({id:`${doc.id}:${start}`,docId:doc.id,start,end,text});
    start=end;
  }
  return rows;
}
export function buildIndex(documents) {
  if(!documents.length || new Set(documents.map(d=>d.id)).size!==documents.length) throw Error('Empty corpus or duplicate IDs');
  const passages=documents.flatMap(d=>chunks(d)), postings=new Map(), lengths=[];
  for(const [i,p] of passages.entries()) {
    const tokens=terms(p.text), counts=new Map(); lengths.push(tokens.length);
    for(const t of tokens) counts.set(t,(counts.get(t)||0)+1);
    for(const [t,tf] of counts) {
      if(!postings.has(t)) postings.set(t,[]);
      postings.get(t).push([i,tf]);
    }
  }
  return {passages,postings,lengths,average:lengths.reduce((a,b)=>a+b,0)/passages.length || 1};
}
export function search(index,query,mode='bm25',limit=10) {
  if(!['bm25','tfidf'].includes(mode)) throw Error('Unknown baseline');
  if(!Number.isInteger(limit)||limit<1) throw Error('Invalid limit');
  const scores=new Map(), n=index.passages.length;
  for(const t of new Set(terms(query))) {
    const posting=index.postings.get(t)||[], df=posting.length;
    for(const [i,tf] of posting) {
      const score=mode==='bm25' ? Math.log(1+(n-df+0.5)/(df+0.5))*tf*2.2/(tf+1.2*(0.25+0.75*index.lengths[i]/index.average)) : (1+Math.log(tf))*Math.log(1+n/df);
      scores.set(i,(scores.get(i)||0)+score);
    }
  }
  const ranked=[...scores].sort((a,b)=>b[1]-a[1] || index.passages[a[0]].id.localeCompare(index.passages[b[0]].id));
  const seen=new Set(), results=[];
  for(const [i,score] of ranked) {
    const p=index.passages[i];
    if(seen.has(p.docId)) continue;
    seen.add(p.docId); results.push({...p,score});
    if(results.length===limit) break;
  }
  return results;
}
export function metrics(rankedIds, relevance) {
  if(new Set(rankedIds).size!==rankedIds.length) throw Error('Duplicate ranked document');
  const grades=[...relevance.values()];
  if(!grades.length || grades.some(g=>!Number.isInteger(g)||g<0||g>10) || !grades.some(g=>g>0)) throw Error('Invalid relevance labels');
  const relevant=grades.filter(g=>g>0).length;
  const dcg=(gs)=>gs.reduce((s,g,i)=>s+(2**g-1)/Math.log2(i+2),0);
  const gains=rankedIds.slice(0,10).map(id=>relevance.get(id)||0);
  const ideal=dcg(grades.sort((a,b)=>b-a).slice(0,10));
  const first=gains.findIndex(g=>g>0);
  return {ndcgAt10:dcg(gains)/ideal,recallAt5:gains.slice(0,5).filter(g=>g>0).length/relevant,mrrAt10:first<0?0:1/(first+1)};
}
export function evidence(result,doc) {
  if(result.docId!==doc.id || !Number.isInteger(result.start)||!Number.isInteger(result.end)||result.start<0||result.end<=result.start||result.end>doc.text.length||doc.text.slice(result.start,result.end)!==result.text) throw Error('Excerpt mismatch');
  return {docId:doc.id,start:result.start,end:result.end,sourceHash:hash(doc.text),excerptHash:hash(result.text)};
}
export function verify(record,doc) {
  return Boolean(doc && record.docId===doc.id && Number.isInteger(record.start)&&Number.isInteger(record.end)&&record.start>=0&&record.end>record.start&&record.end<=doc.text.length&&record.sourceHash===hash(doc.text)&&record.excerptHash===hash(doc.text.slice(record.start,record.end)));
}
export function percentile(values,q) {
  if(!values.length||values.some(x=>!Number.isFinite(x)||x<0)||q<=0||q>1) throw Error('Invalid percentile');
  return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*q)-1];
}
