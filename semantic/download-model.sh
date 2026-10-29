#!/bin/sh
# Public model assets pinned to a revision; evaluation verifies SHA-256 before use.
set -eu
base='https://huggingface.co/mixedbread-ai/mxbai-embed-xsmall-v1/resolve/e6ac24e5d6efb8782b59de1647b3ececb4ece94e'
mkdir -p model/onnx
for file in config.json tokenizer.json tokenizer_config.json onnx/model_quantized.onnx; do
  if [ ! -f "model/$file" ]; then
    curl --fail --location --silent --show-error --output "model/$file.tmp" "$base/$file"
    mv "model/$file.tmp" "model/$file"
  fi
done
printf '%s\n' 'Model assets downloaded. The evaluation checks every SHA-256 before loading.'
