# Dataset provenance

The first evaluation uses [SciFact in BEIR](https://huggingface.co/datasets/BeIR/scifact) and its [relevance judgments](https://huggingface.co/datasets/BeIR/scifact-qrels). Both Hugging Face dataset cards identify the data as **CC BY-SA 4.0**. The dataset is downloaded separately and is not relicensed under this repository's MIT code licence.

SciFact was introduced by David Wadden, Shanchuan Lin, Kyle Lo, Lucy Lu Wang, Madeleine van Zuylen, Arman Cohan and Hannaneh Hajishirzi in *Fact or Fiction: Verifying Scientific Claims* (EMNLP 2020). BEIR was introduced by Nandan Thakur, Nils Reimers, Andreas Rücklé, Abhishek Srivastava and Iryna Gurevych in *BEIR: A Heterogeneous Benchmark for Zero-shot Evaluation of Information Retrieval Models* (NeurIPS Datasets and Benchmarks, 2021).

- [Original SciFact project](https://github.com/allenai/scifact)
- [BEIR project and dataset information](https://github.com/beir-cellar/beir)
- [CC BY-SA 4.0 terms](https://creativecommons.org/licenses/by-sa/4.0/)

The downloader uses corpus and queries at Hugging Face revision `a75ae049398addde9b70f6b268875f5cbce99089`. The qrels URL uses `main`, but the exact contents are pinned by SHA-256; upstream changes cause a failure rather than a silently different evaluation.

Uncompressed SHA-256 values:

| File | SHA-256 |
| --- | --- |
| corpus.jsonl | dec31c8182f3d744c7d2c09423756fd1d17cbef75808db13ba01cc0aab4d1ac6 |
| queries.jsonl | 8ff84a7c903f722981cd8d595c022660140c51867b27608a6d4910db86080313 |
| qrels/test.tsv | 0864bb985e0ca2367ba217977e72004d549054b2b06666ed9d4825ac7c21284c |

The evaluation joins title and abstract and chunks that joined text; originals are otherwise unchanged. Public result JSON contains IDs, ranks, scores, timings and integrity hashes, not corpus text. This measured result artifact is provided under CC BY-SA 4.0 where applicable to derived dataset material. No affiliation with or endorsement by the original authors is implied.
