# Evaluation protocol v1

Frozen before the initial measured run on 2026-10-25. The source and CLI hashes are included in each JSON result.

1. Load every SciFact corpus document, joining its title and abstract with one newline. Reject duplicate document IDs, missing judgment targets, duplicate query IDs or duplicate judgments.
2. Evaluate all 300 queries appearing in the public BEIR test judgments. Do not sample easy cases, exclude misses, train on labels, or tune after reading scores. Training judgments are not downloaded or used in this version.
3. Split sources into at most 700 UTF-16 code units per passage, preferring a space boundary in the second half and preserving surrogate pairs. No overlap. Normalize tokens with NFKC and lowercase; retain Unicode letters/numbers and remove the documented stop list in `bench.mjs`.
4. Build an inverted index once. Apply BM25 (k1=1.2, b=0.75) or log-TF × IDF. Rank passages and retain the highest-scoring passage per document. Tie-break by passage ID. Retrieve ten distinct documents.
5. Use one untimed pass over the labeled queries per method, then three measured searches per query. Query IDs are ordered lexicographically; BM25 is measured before TF-IDF. Report nearest-rank percentiles across all 900 measured searches per method. This ordering can introduce warm-cache/system-load bias, so tiny latency differences are not a winner claim.
6. Compute macro-average nDCG@10, Recall@5 and MRR@10 over every labeled query. Grades use exponential DCG gains. Missing results contribute zero. Unjudged documents receive zero, which reflects incomplete labels rather than proof of irrelevance.
7. Verify every returned passage against the original normalized source. Store document ID, offsets, source SHA-256 and excerpt SHA-256, without redistributing source text. Tests deliberately alter text, bounds, IDs and hashes to ensure those errors are rejected.
8. Include runtime, CPU, platform, data hashes, code hashes, index time, every query's metric values, raw repeat timings, and top ten results in a new JSON file. Never overwrite an earlier run silently.

## Not measured

Model downloads, embeddings, hybrid retrieval, GPU/CPU inference comparison, browser rendering, calibrated no-answer behavior, energy, peak memory, multi-device variance, statistical confidence intervals and real-world user outcomes. A no-overlap regression fixture checks abstention mechanics but is not an irrelevant-query benchmark. Hash checks do not establish authorship, source truth, or relevance of a passage.

## Next evaluation

Keep this run as a baseline. Add a separately licensed development split and a predeclared protocol for model comparisons. Evaluate embeddings and fusion on identical passages with pinned model revisions; report cold download/indexing separately from warm queries. Do not advertise a model comparison before those runs exist.
