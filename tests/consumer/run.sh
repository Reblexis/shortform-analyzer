#!/usr/bin/env bash
# Success criterion 2: a blank Node project installs the packed tarball and uses both entry points, from .mjs and .ts.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
(cd "$root" && npm pack --silent --pack-destination "$work" >/dev/null)
cp "$root"/tests/consumer/*.mjs "$root"/tests/consumer/types.ts "$work"/
cd "$work"
npm init -y >/dev/null
npm pkg set type=module >/dev/null
npm install --silent --no-audit --no-fund ./shortform-breakdown-*.tgz typescript@~5.7.3 @types/node@^20.17.0 >/dev/null
node analyze.mjs
node primitives.mjs
npx tsc --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 --types node types.ts
npx --no-install shortform-breakdown --version
echo "consumer: ok"
