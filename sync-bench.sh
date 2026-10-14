#!/bin/sh
# Copy the latest proxy-bench results into bench/ for the published page.
# Only the summary, the app list and the Mac model + app versions are copied; nothing else from proxy-bench.
set -e
cd "$(dirname "$0")"
SRC="${PROXY_BENCH:-../proxy-bench}"   # set PROXY_BENCH if proxy-bench lives elsewhere
mkdir -p bench
cp "$SRC/results/summary.json" bench/summary.json
cut -f1,2 "$SRC/configs/apps.tsv" > bench/apps.tsv
last=$(python3 -c 'import json;s=[x for x in json.load(open("bench/summary.json"))["sessions"] if x.endswith("-B")];print(s[-1] if s else "")')
if [ -n "$last" ]; then grep -E '^(model=|app )' "$SRC/results/raw/$last/meta.txt" > bench/meta.txt; fi
echo "bench/ updated from session ${last:-none}"
