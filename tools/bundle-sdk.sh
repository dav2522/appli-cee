#!/usr/bin/env bash
# tools/bundle-sdk.sh — reconstruit vendor/anthropic-sdk.min.mjs (SDK officiel @anthropic-ai/sdk, bundle navigateur).
# Usage : tools/bundle-sdk.sh [version]   (defaut 0.129.0). Necessite node et npm dans le PATH.
set -euo pipefail
VERSION="${1:-0.129.0}"; ESBUILD="0.28.2"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
npm init -y >/dev/null
npm install --no-audit --no-fund "esbuild@$ESBUILD" "@anthropic-ai/sdk@$VERSION" >/dev/null
printf 'import Anthropic from "@anthropic-ai/sdk";\nexport default Anthropic;\nexport { Anthropic };\n' > entree.mjs
ESB="$(ls node_modules/@esbuild/*/bin/esbuild | head -1)"
"$ESB" entree.mjs --bundle --format=esm --platform=browser --target=es2022 --minify --legal-comments=none --outfile=sortie.mjs
{ printf '// @anthropic-ai/sdk %s (MIT) — bundle esbuild %s, voir tools/bundle-sdk.sh\n' "$VERSION" "$ESBUILD"; cat sortie.mjs; } > "$RACINE/vendor/anthropic-sdk.min.mjs"
cp node_modules/@anthropic-ai/sdk/LICENSE "$RACINE/vendor/LICENSE-anthropic-sdk"
echo "OK : vendor/anthropic-sdk.min.mjs ($(wc -c < "$RACINE/vendor/anthropic-sdk.min.mjs") octets)"
