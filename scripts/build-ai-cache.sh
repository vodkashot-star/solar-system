#!/usr/bin/env bash
# Regenerate functions/api/ai/data.js from spaceAI/data/ai_cache.json
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

python3 -c "
import json
with open('$ROOT_DIR/spaceAI/data/ai_cache.json') as f:
    data = json.load(f)
with open('$ROOT_DIR/functions/api/ai/data.js', 'w') as out:
    out.write('// Auto-generated from spaceAI/data/ai_cache.json\n')
    out.write('export const aiCache = ')
    json.dump(data, out, indent=2)
    out.write(';\n')
"
echo "Regenerated functions/api/ai/data.js"
