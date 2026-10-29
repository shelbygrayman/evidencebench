# EvidenceBench

**Measure retrieval. Check the source. Keep the failures.**

A dependency-free Node benchmark for document retrieval and excerpt integrity. Compare two explicit lexical baselines on identical passages, retain every query's ranked results, and verify source hashes and character offsets. No API key, generated answers, telemetry, or document uploads.

## First measured run

BEIR SciFact: **5,183 documents, all 300 labeled test queries**, 25 October 2026. Node 24.19.0, Apple M2 Pro, macOS arm64. Fixed settings were selected before this run; no parameters were tuned against its test labels.

| Baseline | nDCG@10 | Recall@5 | MRR@10 | Warm p50 / p95 |
| --- | ---: | ---: | ---: | ---: |
| BM25 | 0.6299 | 0.7172 | 0.5935 | 1.31 / 2.92 ms |
| Log-TF × IDF | 0.6122 | 0.6897 | 0.5762 | 1.27 / 2.78 ms |

Both methods returned 3,000 excerpts whose offsets and hashes verified. **Integrity does not mean relevance or truth.** These are our implementations on one dataset and one machine, not official BEIR leaderboard scores or a statistical superiority claim. Lower quality results remain in the raw report.

[Full per-query JSON](scifact-2026-10-25.json) · [Protocol and limitations](PROTOCOL.md) · [Dataset attribution](DATA.md)

## Reproduce

Install Node 24 or newer. No `npm install` required.

```sh
npm test
node download.mjs
node cli.mjs data/scifact results.json
```

The downloader retrieves public SciFact data from Hugging Face and verifies pinned SHA-256 checksums before writing. It leaves existing matching files intact and rejects changed files. The benchmark runs locally; output paths must not already exist. Data files are ignored by Git. To rerun, choose a new output name.

The CLI also accepts an existing BEIR-layout folder with `corpus.jsonl`, `queries.jsonl`, and `qrels/test.tsv`. Only files matching the pinned SciFact hashes receive the SciFact label; other inputs are marked user-supplied with undetermined licensing. Use the pinned downloader for comparable runs.

## What the scores mean

- **nDCG@10:** rewards relevant documents near the top, normalized against ideal relevance grades.
- **Recall@5:** fraction of labeled relevant documents found in the first five, averaged across every labeled query.
- **MRR@10:** inverse rank of the first relevant result within ten, with misses scored zero.
- **Evidence checks:** title-plus-abstract source hash and exact UTF-16 boundaries for the highest-ranked passage from each document.

BM25 uses k1=1.2 and b=0.75. Both baselines use the same Unicode tokenizer, stop words, 700-character non-overlapping passages and maximum-passage document score. The TF-IDF baseline is a log-TF × IDF sum, **not cosine-normalized TF-IDF**. There is no stemming. These choices are explicit so results can be reproduced, challenged, and improved.

## Sourcekeep evaluation

The [Sourcekeep keyword adapter](SOURCEKEEP-RESULTS.md) evaluates the actual Sourcekeep core against BEIR document labels. It is a Node research run with important app-limit and ranking differences; semantic and hybrid evaluation remain future work.

## Small model comparison

[Keyword, semantic-only and hybrid retrieval on a small selected SciFact corpus](SEMANTIC-EXPERIMENT.md), including per-query results, reproducible inputs and limitations.

## Scope

The main full-SciFact benchmark evaluates lexical search. A separate small CPU experiment evaluates embeddings and hybrid fusion; mobile/browser performance and calibrated abstention are future work. SciFact labels document relevance for scientific claims; it does not measure general personal-note search, passage truth, or proof quality. Public test queries are externally authored but not contamination-proof or secret. Do not repeatedly tune on these test scores and still call them held-out results.

Sourcekeep's tokenizer, chunking convention and BM25 formula informed this implementation; indexing and the benchmark harness are separate. Its timings are not Sourcekeep browser timings. This is a small open research tool, not an independent certification service.

## Contribute

Add a minimal failing fixture for metric or integrity bugs. For retrieval changes, record configuration before evaluating, keep train/development data separate, publish all test rows, and retain failures. Please do not commit private documents or credentials.

MIT code, © 2026 Shelby. SciFact/BEIR data has separate attribution and licensing; see [DATA.md](DATA.md).
