import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectFixture} from './make-browser-fixture.mjs';
test('selection is fixed by IDs and retains only labels in the selected corpus',()=>{
  const corpus=Array.from({length:35},(_,i)=>({_id:`d${String(i).padStart(2,'0')}`,text:`unique document ${i}`}));
  const queries=Array.from({length:22},(_,i)=>({_id:`q${String(i).padStart(2,'0')}`,text:`query ${i}`}));
  const qrels=queries.map((q,i)=>({queryId:q._id,docId:corpus[i]._id,grade:1}));
  const first=selectFixture(corpus,queries,qrels);
  assert.equal(first.documents.length,30);assert.equal(first.queries.length,20);
  assert.deepEqual(first,selectFixture([...corpus].reverse(),[...queries].reverse(),[...qrels].reverse()));
  assert.ok(first.queries.every(q=>Object.keys(q.relevance).every(id=>first.documents.some(d=>d.id===id))));
});
test('rejects insufficient documents and invalid judgments',()=>{
  assert.throws(()=>selectFixture([],[],[]));
  assert.throws(()=>selectFixture([{_id:'d',text:'hello'}],[{_id:'q',text:'x'}],[{queryId:'q',docId:'d',grade:-1}]));
});
