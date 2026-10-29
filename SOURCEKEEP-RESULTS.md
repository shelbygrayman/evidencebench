# Sourcekeep keyword evaluation

On 28 October 2026, EvidenceBench ran Sourcekeep commit `ea45ee7459029f0306a4c82971d8a59291d6157b`'s unmodified `chunkDocument` and `lexicalSearch` on all 300 labeled BEIR SciFact test queries across 5,183 documents. On Node 24.22.1, Linux x64, AMD EPYC 9V74, the document-level nDCG@10 was **0.6299**, Recall@5 **0.7172**, MRR@10 **0.5935**. All 3,000 selected excerpts passed hash and offset verification.

This is a Node evaluation of the search core, not an in-browser test. The corpus exceeds Sourcekeep's ordinary import limits; the evaluator collapses the complete passage ranking by document for BEIR labels, while Sourcekeep displays six passages. Document relevance does not establish the truth or relevance of an individual passage. The 300 public scientific queries are not a private holdout and are not representative of every personal document collection. The matches to EvidenceBench's previous scores reflect the related BM25 formula, not an independent validation or superiority claim. Model-based search was not measured here.

## Reproduce

Use Node 24 and put Sourcekeep next to the EvidenceBench checkout. Pin Sourcekeep to the commit above. Then run:

```sh
node --test sourcekeep-eval.test.mjs
node download.mjs
node sourcekeep-eval.mjs ../sourcekeep data/scifact sourcekeep-results.json
```

The output file must not already exist. The full generated report retains each query's rankings, scores, evidence hashes and offsets, input hashes, code hashes, timings and limitations. The inputs have separate attribution and licensing; see [DATA.md](DATA.md). Avoid publishing private documents or reports. This evaluation runs one query pass without explicit warmup; timing is environment-dependent and not directly comparable to EvidenceBench's indexed timings.


The [compact per-query results](sourcekeep-scifact-summary.json) retain every query's metrics and ranked document IDs. They omit excerpt hashes, individual passage scores and query timings; the evaluator regenerates the full evidence report. The compact result is provided under CC BY-SA 4.0 where applicable to derived SciFact data.


## Comparing complete rankings

A [comparison](comparison-2026-10-29.json) of the published Sourcekeep keyword run against the earlier EvidenceBench BM25 report found **296 identical top-ten document rankings** out of 300 queries; all 300 top-ranked documents matched. For queries 50, 823, 985 and 1137, tied scores changed the order of two lower-ranked documents. Sourcekeep breaks ties using content-hash-based passage IDs; EvidenceBench uses dataset document IDs. This explains why equality of rounded aggregate metrics does not imply identical rankings. These reports were measured on different machines and cannot establish a latency comparison.

To compare regenerated full reports, run `node compare-runs.mjs sourcekeep-results.json scifact-2026-10-25.json comparison.json`. The tool rejects different dataset hashes and mismatched queries; it reports ranking differences without treating them as relevance judgments or significance tests. The compact report is provided under CC BY-SA 4.0 where applicable to derived SciFact data.
