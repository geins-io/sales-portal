#!/usr/bin/env bash
# =============================================================================
# SALES PORTAL - Is a slot swap pending?
# =============================================================================
# Between --action preview and --action swap the slot runs with production's
# settings and the switch is half applied. Two steps of the deploy workflow ask
# about that state - the guard that refuses to deploy into it, and the cleanup
# job that clears it - and they have to answer it the same way.
#
# The distinction this script exists for: "there is nothing here yet" and "the
# lookup failed" are different answers, and only the first is a reason to carry
# on. az separates them by exit code - 3 is not-found, anything else non-zero is
# a real failure - and the caller must not turn either into an empty string.
# A swallowed error reads as "nothing pending", which is exactly the answer that
# lets a run finish green over a half-done swap.
#
# Inputs:
#   RESOURCE_GROUP         required
#   WEBAPP_SLOT            slot to ask about (staging)
#   EXPECTED_WEBAPP_NAME   optional cross-check; when the caller already knows
#                          the name, a lookup that finds nothing or something
#                          else means this login is pointing somewhere else
#                          (the subscription lives on the GitHub environment,
#                          and the repository-level one is not production)
#
# stdout, one line, tab separated: "<web app name><TAB><pending target slot>"
#   both empty    nothing exists yet - no deployment, or no such slot
#   name only     the slot is there and no swap is pending
#   name + target a swap is pending to that target
# exit 1          a lookup failed; the caller must stop rather than assume
# =============================================================================

set -uo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-}"
WEBAPP_SLOT="${WEBAPP_SLOT:-staging}"
EXPECTED_WEBAPP_NAME="${EXPECTED_WEBAPP_NAME:-}"

if [[ -z "$RESOURCE_GROUP" ]]; then
  echo "::error::RESOURCE_GROUP is not set." >&2
  exit 1
fi

# Echoes the value on success, echoes "notfound" on az exit 3, and returns 1 on
# anything else after printing what az said. Returning rather than exiting
# matters: these calls run in a command substitution, and an exit there would
# only end the subshell and hand the caller an empty string - the swallow this
# script exists to prevent.
az_read() {
  local description="$1"
  shift
  local output status
  output=$("$@" 2>&1)
  status=$?

  if ((status == 0)); then
    printf '%s' "$output"
    return 0
  fi

  if ((status == 3)); then
    printf 'notfound'
    return 0
  fi

  echo "::error::${description} failed (az exit ${status}): ${output}" >&2
  return 1
}

if ! WEBAPP_NAME=$(az_read "Reading the deployment 'main' in '${RESOURCE_GROUP}'" \
  az deployment group show \
  --resource-group "$RESOURCE_GROUP" \
  --name main \
  --query properties.outputs.webAppName.value \
  --output tsv); then
  exit 1
fi

if [[ "$WEBAPP_NAME" == "notfound" || -z "$WEBAPP_NAME" ]]; then
  if [[ -n "$EXPECTED_WEBAPP_NAME" ]]; then
    echo "::error::No deployment 'main' found in '${RESOURCE_GROUP}', but this run already deployed '${EXPECTED_WEBAPP_NAME}' there. The login is pointing at another subscription, so the state of the slot is unknown - refusing to report it as clean." >&2
    exit 1
  fi

  printf '\t\n'
  exit 0
fi

if [[ -n "$EXPECTED_WEBAPP_NAME" && "$WEBAPP_NAME" != "$EXPECTED_WEBAPP_NAME" ]]; then
  echo "::error::Expected the web app '${EXPECTED_WEBAPP_NAME}' in '${RESOURCE_GROUP}' but the deployment names '${WEBAPP_NAME}'." >&2
  exit 1
fi

if ! PENDING=$(az_read "Reading targetSwapSlot on '${WEBAPP_NAME}/${WEBAPP_SLOT}'" \
  az webapp show \
  --resource-group "$RESOURCE_GROUP" --name "$WEBAPP_NAME" --slot "$WEBAPP_SLOT" \
  --query targetSwapSlot --output tsv); then
  exit 1
fi

# No slot at all: nothing can be pending, but the caller may still want the name.
if [[ "$PENDING" == "notfound" ]]; then
  printf '%s\t\n' "$WEBAPP_NAME"
  exit 0
fi

# null prints as an empty string on tsv; older CLI builds print None.
if [[ "$PENDING" == "None" ]]; then
  PENDING=""
fi

printf '%s\t%s\n' "$WEBAPP_NAME" "$PENDING"
