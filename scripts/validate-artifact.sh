#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

next_build="${SITES_PROJECT_ROOT}/.next"
layout="${SITES_PROJECT_ROOT}/app/layout.tsx"

[[ -d "${next_build}" ]] || {
  echo "Missing Next.js build output: .next/" >&2
  exit 66
}

[[ -f "${layout}" ]] || {
  echo "Missing app layout file: app/layout.tsx" >&2
  exit 66
}

grep -q '"codex-preview"[[:space:]]*:[[:space:]]*"development"' "${layout}" || {
  echo "Missing preview metadata in app/layout.tsx: metadata.other['codex-preview'] = 'development'" >&2
  exit 66
}

echo "Validated Azure artifact: Next.js build output present and preview metadata configured."
