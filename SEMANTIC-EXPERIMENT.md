# Small Sourcekeep model comparison

On 29 October 2026, we evaluated Sourcekeep's keyword, semantic-only and hybrid retrieval on a **deliberately selected 30-document, 20-query subset of BEIR SciFact**. This is a small diagnostic, not a full-dataset benchmark or a claim that these results generalize to private notes. The test queries and relevance judgments are publicly available and not contamination-proof.

The fixed selection rule takes the first 20 lexicographic query IDs with distinct positively judged documents, chooses the first eligible relevant document ID for each, and fills the corpus with the first ten other document IDs. Judgments are restricted to this selected corpus, so every selected query has at least one known relevant document. Selection was defined before running the three methods; it is not random and makes the task easier than searching the full corpus. The task is scientific-claim-to-abstract retrieval, not personal-note search.

| Method | nDCG@10 | Recall@5 | MRR@10 |
| --- | ---: | ---: | ---: |
| Keyword | 0.8744 | 0.9000 | 0.8500 |
| Semantic only | 0.9815 | 1.0000 | 0.9750 |
| Hybrid | 0.9031 | 0.9500 | 0.8875 |

For nDCG@10, semantic-only scored higher on 4 queries, keyword higher on 1, and 15 tied. These counts are descriptive, not a significance test. No decision to change the default ranking follows from 20 queries. The [machine-readable report](semantic-scifact-2026-10-29.json) retains every query's judgments, document rankings and scores, as well as dataset, code, and model-asset hashes.

The experiment used Sourcekeep's original chunking, lexical ranking, cosine and reciprocal-rank fusion functions; a q8 Mixedbread `mxbai-embed-xsmall-v1` model at revision `e6ac24e5d6efb8782b59de1647b3ececb4ece94e`; Transformers.js 4.3.1; and Node 24.22.1 on Linux x64 using ONNX Runtime CPU. Embeddings use mean pooling and normalization as in Sourcekeep. This is **not** a browser, WebGPU or end-to-end app benchmark; Sourcekeep's normal UI exposes keyword and hybrid modes, while semantic-only is an experimental diagnostic. Rankings are collapsed from passages to documents because SciFact labels documents, and relevance does not prove that a returned passage or claim is true. No cross-device latency claim is made.

## Reproduce

Use Node 24, npm and curl. Place this repository and a Sourcekeep checkout side by side. Pin Sourcekeep to commit `ea45ee7459029f0306a4c82971d8a59291d6157b`. Dataset and model assets are downloaded separately and have their own licences; see [DATA.md](DATA.md) and the [model card](https://huggingface.co/mixedbread-ai/mxbai-embed-xsmall-v1). Do not commit downloaded data or model weights.

```sh
node download.mjs
node make-browser-fixture.mjs data/scifact browser-fixture.json
cd semantic
npm ci --ignore-scripts
sh download-model.sh
node evaluate.mjs ../../sourcekeep ../browser-fixture.json ../my-semantic-report.json
```

`npm ci --ignore-scripts` avoids optional postinstall downloads; the CPU runtime included in the locked package is used. The evaluator verifies the four pinned model asset SHA-256 hashes before inference and refuses to overwrite an existing report. Linux x64 was tested; package compatibility and results may differ on other systems. Timing excludes model download. The generated fixture contains public data and is not checked into Git; it and the derived report are subject to the dataset licence. See [DATA.md](DATA.md).
