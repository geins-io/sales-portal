#!/usr/bin/env bash
# =============================================================================
# SALES PORTAL - Which build does this origin serve?
# =============================================================================
# Reads commitSha from the authorized /api/health response. The deploy workflow
# asks it once, with EXPECT_SHA, to wait until the target has actually started
# on the new image. The rollback workflow asks it three times - the slot and
# production before the swap, and production after it - and the answer decides
# whether a swap happens at all.
#
# It reads what the origin *reports*, never linuxFxVersion. The configured
# image and the running one are different claims, and only the second is a
# reason to move customer traffic.
#
# The distinction worth having, and the reason this is a script: a 200 whose
# body carries no commitSha is the *public* health response. That means the
# health key did not authorize, not that the origin serves the wrong build.
# Reporting it as a build mismatch would send the reader to the image when the
# problem is an app setting.
#
# Whether that is final depends on what is being asked. Reading the build an
# origin serves right now (no EXPECT_SHA): final, since waiting adds no field
# to a response that cannot carry it. Waiting for an origin to *become* a build
# (EXPECT_SHA set): a public answer is the old process, still up while the new
# one pulls and starts - on 2026-09-10 the staging slot answered like that for
# two minutes after the image was set, and a check that gave up on it failed a
# healthy release. So with EXPECT_SHA the poll continues, and only the last
# attempt reports the key as the likely cause.
#
# Inputs, all environment variables (the key is never printed):
#   BASE_URL     https://host, no path
#   HEALTH_KEY   value of the health check secret
#   EXPECT_SHA   optional; poll until the origin reports this, then succeed
#   ATTEMPTS     polls before giving up (12)
#   INTERVAL     seconds between polls (5)
#   MAX_TIME     curl timeout per request (30)
#   LABEL        name for the log lines ("origin")
#
# stdout: the commit sha and nothing else, so a caller can use it in a command
# substitution. Every log line goes to stderr for that reason.
# exit 1: no 200, a 200 without commitSha, or EXPECT_SHA never appeared.
# =============================================================================

set -uo pipefail

BASE_URL="${BASE_URL:-}"
HEALTH_KEY="${HEALTH_KEY:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
ATTEMPTS="${ATTEMPTS:-12}"
INTERVAL="${INTERVAL:-5}"
MAX_TIME="${MAX_TIME:-30}"
LABEL="${LABEL:-origin}"

say() { echo "$(date -u +%T) UTC - $*" >&2; }
err() { echo "::error::$*" >&2; }

missing=""
[[ -n "$BASE_URL" ]] || missing="${missing} BASE_URL"
[[ -n "$HEALTH_KEY" ]] || missing="${missing} HEALTH_KEY"

if [[ -n "$missing" ]]; then
  err "Not set:${missing}."
  exit 1
fi

# An unset repository variable reaches a caller that builds "https://$HOST" as a
# scheme with no host, which curl reports as a network error - misleading enough
# to be worth its own message.
if [[ ! "$BASE_URL" =~ ^https?://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]+)?$ ]]; then
  err "BASE_URL '${BASE_URL}' is not an origin. Expected https://host, with no path."
  exit 1
fi

if ((ATTEMPTS < 1)); then
  err "ATTEMPTS is ${ATTEMPTS}; at least 1 poll has to run."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  err "jq is required to read /api/health."
  exit 1
fi

if [[ -n "$EXPECT_SHA" ]]; then
  say "waiting for ${LABEL} at ${BASE_URL} to serve ${EXPECT_SHA}"
else
  say "reading the build ${LABEL} at ${BASE_URL} serves"
fi

last=""
public_answers=0
for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  # -w appends the status on its own line, so a body and a transport failure are
  # told apart without a second request.
  response=$(curl -sS -L --max-time "$MAX_TIME" -w '\n%{http_code}' \
    "${BASE_URL}/api/health?key=${HEALTH_KEY}" 2>/dev/null || printf '\n000')
  code=$(printf '%s' "$response" | tail -n 1)
  body=$(printf '%s' "$response" | sed '$d')

  if [[ "$code" != "200" ]]; then
    say "${LABEL}: /api/health answered HTTP ${code} on attempt ${attempt}/${ATTEMPTS}"
  else
    sha=$(printf '%s' "$body" | jq -r '.commitSha // empty' 2>/dev/null)

    if [[ -z "$sha" ]]; then
      if [[ -z "$EXPECT_SHA" ]]; then
        err "${LABEL} answered the public health response, which carries no commitSha, so no build was read. The health key did not authorize - NUXT_HEALTH_CHECK_SECRET on the target and HEALTH_CHECK_SECRET here have to match. This is not a build mismatch, and it is not retried."
        exit 1
      fi
      # Waiting for a build: the process that answered has no key in its environment,
      # which is what the previous container looks like until the new one takes over.
      public_answers=$((public_answers + 1))
      say "${LABEL}: public health response (no commitSha) on attempt ${attempt}/${ATTEMPTS}, waiting for ${EXPECT_SHA}"
    else
      last="$sha"

      if [[ -z "$EXPECT_SHA" || "$sha" == "$EXPECT_SHA" ]]; then
        say "${LABEL}: ${sha}"
        printf '%s\n' "$sha"
        exit 0
      fi

      say "${LABEL}: ${sha} on attempt ${attempt}/${ATTEMPTS}, waiting for ${EXPECT_SHA}"
    fi
  fi

  if ((attempt < ATTEMPTS)); then
    sleep "$INTERVAL"
  fi
done

if [[ -n "$EXPECT_SHA" ]]; then
  if [[ -z "$last" && "$public_answers" -gt 0 ]]; then
    err "${LABEL} never reported a build in ${ATTEMPTS} attempts: every 200 was the public health response. Either the new container never took over, or NUXT_HEALTH_CHECK_SECRET on the target does not match HEALTH_CHECK_SECRET here - the log above shows which, since a container that started would have changed the answer."
  else
    err "${LABEL} never reported ${EXPECT_SHA} after ${ATTEMPTS} attempts; the last build it reported was ${last:-none}."
  fi
else
  err "${LABEL} never answered 200 on /api/health after ${ATTEMPTS} attempts."
fi

exit 1
