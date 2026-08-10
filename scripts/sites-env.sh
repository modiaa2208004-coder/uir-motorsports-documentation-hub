#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
runtime_root="${SITES_RUNTIME_ROOT:-${project_root}/.sites-runtime}"
user_home="${HOME:-}"

# better-sqlite3 is a native Node addon. Keep all project commands on the
# Node 22 ABI declared by .nvmrc, even when the user's shell currently points
# at another installed Node version.
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
shopt -s nullglob
node22_candidates=(
  "${SITES_NODE22_BIN:-}"
  "/opt/homebrew/opt/node@22/bin"
  "/usr/local/opt/node@22/bin"
  "${user_home}"/.nvm/versions/node/v22.*/bin
)
shopt -u nullglob
if [[ "${node_major}" != "22" ]]; then
  for node_bin in "${node22_candidates[@]}"; do
    if [[ -x "${node_bin}/node" ]]; then
      export PATH="${node_bin}:${PATH}"
      node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
      break
    fi
  done
fi

if [[ "${node_major}" != "22" ]]; then
  echo "This project requires Node.js 22.x for better-sqlite3. Run 'nvm use' or set SITES_NODE22_BIN to a Node 22 bin directory." >&2
  exit 1
fi

mkdir -p \
  "${runtime_root}/home" \
  "${runtime_root}/npm-cache" \
  "${runtime_root}/xdg-config" \
  "${runtime_root}/tmp" \
  "${runtime_root}/wrangler/logs"

export SITES_ENV_READY=1
export SITES_PROJECT_ROOT="${project_root}"
export HOME="${runtime_root}/home"
export XDG_CONFIG_HOME="${runtime_root}/xdg-config"
export TMPDIR="${runtime_root}/tmp"
export WRANGLER_WRITE_LOGS=false
export WRANGLER_LOG_PATH="${runtime_root}/wrangler/logs"
export MINIFLARE_REGISTRY_PATH="${runtime_root}/wrangler/registry"

# The runtime may provide a global npm cache. Keep the image's read-only Sites
# seed separate and make this project's writable cache authoritative.
unset NPM_CONFIG_CACHE npm_config_cache || true
export npm_config_cache="${runtime_root}/npm-cache"
export npm_config_audit=false
export npm_config_fund=false
export npm_config_update_notifier=false

# The runtime already supplies the standard HTTP(S)_PROXY variables. Remove
# npm-specific aliases so npm 11 does not reinterpret or warn about them.
unset \
  npm_config_proxy \
  npm_config_http_proxy \
  npm_config_https_proxy \
  NPM_CONFIG_PROXY \
  NPM_CONFIG_HTTP_PROXY \
  NPM_CONFIG_HTTPS_PROXY \
  || true

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ "$#" -eq 0 ]]; then
  echo "usage: scripts/sites-env.sh -- command [args...]" >&2
  exit 64
fi

cd "${project_root}"
exec "$@"
