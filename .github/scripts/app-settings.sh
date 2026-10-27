#!/usr/bin/env bash
# =============================================================================
# SALES PORTAL - Compare app settings without printing them
# =============================================================================
# On prod the app settings reach production only through the swap: Bicep writes
# them to the staging slot, the swap carries them over, and the swap job copies
# production's set back onto the slot. Three checks in deploy.yml ask whether a
# set changed, or whether the two sides match, and none of them may print a
# value - the list holds the registry token, the health key and the Sentry DSN.
#
# Commands:
#   digest        one SHA-256 over the sorted "name=value" lines of the site
#                 (or, with SLOT set, the slot). Equal digests, equal sets.
#   differing     the names that differ between the site and the slot: missing
#                 on one side or with another value. Names only.
#
# Inputs, all environment variables:
#   RESOURCE_GROUP   required
#   WEBAPP_NAME      required
#   SLOT             optional, for digest: read this slot instead of the site
#
# stdout: the digest, or one name per line. Logs and errors go to stderr.
# exit 1: a read failed or returned something that is not a settings list. The
# caller must stop rather than compare an empty answer, which would read as
# "nothing changed".
# =============================================================================

set -uo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-}"
WEBAPP_NAME="${WEBAPP_NAME:-}"
SLOT="${SLOT:-}"

err() { echo "::error::$*" >&2; }

if [[ -z "$RESOURCE_GROUP" || -z "$WEBAPP_NAME" ]]; then
  err "RESOURCE_GROUP and WEBAPP_NAME must be set."
  exit 1
fi

# Echoes the settings as a JSON array of {name, value}.
read_settings() {
  local slot="$1" json
  local slot_args=()
  [[ -n "$slot" ]] && slot_args=(--slot "$slot")

  if ! json=$(az webapp config appsettings list \
    --resource-group "$RESOURCE_GROUP" --name "$WEBAPP_NAME" ${slot_args[@]+"${slot_args[@]}"} \
    --output json); then
    err "Could not read the app settings of ${WEBAPP_NAME}${slot:+ slot ${slot}}."
    return 1
  fi

  if ! printf '%s' "$json" | jq -e 'type == "array"' >/dev/null 2>&1; then
    err "The app settings of ${WEBAPP_NAME}${slot:+ slot ${slot}} did not come back as a list."
    return 1
  fi

  printf '%s' "$json"
}

case "${1:-}" in
  digest)
    settings=$(read_settings "$SLOT") || exit 1
    printf '%s' "$settings" |
      jq -r 'sort_by(.name) | map("\(.name)=\(.value // "")") | join("\n")' |
      sha256sum | cut -d' ' -f1
    ;;
  differing)
    site=$(read_settings "") || exit 1
    slot=$(read_settings "staging") || exit 1
    jq -nr --argjson a "$site" --argjson b "$slot" '
      ($a | map({(.name): (.value // "")}) | add // {}) as $s
      | ($b | map({(.name): (.value // "")}) | add // {}) as $t
      | ($s + $t | keys) | map(select($s[.] != $t[.])) | .[]'
    ;;
  *)
    err "Usage: app-settings.sh digest|differing"
    exit 1
    ;;
esac
