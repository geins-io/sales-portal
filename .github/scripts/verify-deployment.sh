#!/usr/bin/env bash
# =============================================================================
# SALES PORTAL - Verify a deployed origin
# =============================================================================
# Answers one question: does this origin serve the build we deployed, for the
# tenant we expect, and render pages fast enough to take customer traffic?
#
# Run twice by the deploy workflow: against the staging slot inside the swap's
# preview window, and against production after the swap. Runnable by hand
# against any origin, which is how it is tested - a workflow step cannot be.
#
# The rendered-page requests are the warm-up. Filling the caches and proving
# the app renders are the same act, so there is nothing to run before this.
#
# The category page is looked up in /api/__sitemap__/urls at run time and never
# listed here. A path list would tie the release gate to the catalogue: rename
# or unpublish that category and a healthy deploy fails for a reason that has
# nothing to do with the deploy. The sitemap does not list single products by
# design, and a category page already exercises the same heavy path - Geins
# listing, CMS areas, cache fill - so no product page is rendered.
#
# Inputs, all environment variables (the health key is never printed):
#   BASE_URL            https://host
#   EXPECTED_TENANT_ID  tenantId that /api/config must report
#   EXPECTED_SHA        full commit the deployed image was built from
#   HEALTH_KEY          value of the health check secret
#   HOME_PATH           locale root to render and to pick a category under (/se/sv/)
#   TTFB_BUDGET_MS      ceiling for the median warm TTFB per page (4000)
#   ROUNDS              readiness attempts (3)
#   ROUND_PAUSE         seconds between rounds (20)
#   LIVENESS_ATTEMPTS   polls of /api/health until it reports EXPECTED_SHA (20)
#   LIVENESS_INTERVAL   seconds between those polls (15)
#   WARM_HITS           requests per page, the first discarded (4)
#   HIT_PAUSE           seconds between hits on the same page (2)
#   MAX_TIME            curl timeout per request (30)
#   LABEL               name for the log lines ("target")
#
# Exit 0 = ready. Exit 1 = not ready, and the log says which check failed.
# =============================================================================

# No -e: every check reports its own verdict, and an aborted script would skip
# the summary the release gate is read from.
set -uo pipefail

BASE_URL="${BASE_URL:-}"
EXPECTED_TENANT_ID="${EXPECTED_TENANT_ID:-}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
HEALTH_KEY="${HEALTH_KEY:-}"
HOME_PATH="${HOME_PATH:-/se/sv/}"
TTFB_BUDGET_MS="${TTFB_BUDGET_MS:-4000}"
ROUNDS="${ROUNDS:-3}"
ROUND_PAUSE="${ROUND_PAUSE:-20}"
LIVENESS_ATTEMPTS="${LIVENESS_ATTEMPTS:-20}"
LIVENESS_INTERVAL="${LIVENESS_INTERVAL:-15}"
WARM_HITS="${WARM_HITS:-4}"
HIT_PAUSE="${HIT_PAUSE:-2}"
MAX_TIME="${MAX_TIME:-30}"
LABEL="${LABEL:-target}"

# A round ends in one of three states. SOFT is retried, HARD never is: a wrong
# build or a wrong tenant is a fact about the target, not a slow moment.
readonly READY=0
readonly SOFT=1
readonly HARD=2

SERVED_SHA=""
SERVED_TENANT=""
VERIFY_PATHS=""
PAGE_ROWS=""

say() { echo "$(date -u +%T) UTC - $*"; }
err() { echo "::error::$*"; }

# -----------------------------------------------------------------------------
# Input
# -----------------------------------------------------------------------------
missing=""
for name in BASE_URL EXPECTED_TENANT_ID EXPECTED_SHA HEALTH_KEY; do
  eval "value=\${$name}"
  if [[ -z "$value" ]]; then
    missing="${missing} ${name}"
  fi
done

if [[ -n "$missing" ]]; then
  err "Not set:${missing}. Readiness is never skipped, so the run stops here."
  exit 1
fi

# An unset repository variable reaches a caller that builds "https://$HOST" as a
# scheme with no host, which curl reports as a network error - misleading enough
# to be worth its own message.
if [[ ! "$BASE_URL" =~ ^https?://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]+)?$ ]]; then
  err "BASE_URL '${BASE_URL}' is not an origin. Expected https://host, with no path."
  exit 1
fi

# WARM_HITS below 2 would leave no warm hit to judge, and the median of nothing
# is an arithmetic error that this script - deliberately without -e - would carry
# on past, passing a page it never measured.
if ((WARM_HITS < 2)); then
  err "WARM_HITS is ${WARM_HITS}; at least 2 is needed, since the first hit is the discarded cold one."
  exit 1
fi

if ((ROUNDS < 1)); then
  err "ROUNDS is ${ROUNDS}; at least 1 round has to run."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  err "jq is required to read /api/config, /api/health and the sitemap."
  exit 1
fi

# -----------------------------------------------------------------------------
# Requests
# -----------------------------------------------------------------------------

# Echoes "<status> <ttfb in ms>", and "000 0" when curl itself gave up.
probe() {
  local out
  out=$(curl -sS -L -o /dev/null --max-time "$MAX_TIME" \
    -w '%{http_code} %{time_starttransfer}' "$1" 2>/dev/null) || out="000 0"
  awk -v pair="$out" 'BEGIN { split(pair, f, " "); printf "%s %d\n", f[1], f[2] * 1000 }'
}

# Echoes the body, then a last line with the status code.
fetch() {
  curl -sS -L --max-time "$MAX_TIME" -w '\n%{http_code}' "$1" 2>/dev/null ||
    printf '\n000'
}

# Median of the values given. With an even count the upper middle is taken,
# which is the pessimistic reading.
median() {
  printf '%s\n' "$@" | sort -n | awk -v i="$(($# / 2 + 1))" 'NR == i { print; exit }'
}

# -----------------------------------------------------------------------------
# Checks
# -----------------------------------------------------------------------------

# The restart that --action preview causes lands here, so this is a wait, not a
# verdict: /api/health answers in milliseconds on an instance whose pages are
# still cold, which is why nothing below trusts it.
#
# It waits for the *build*, not for a 200. The previous container keeps
# answering 200 while the new one is pulled and started - on 2026-09-10 the
# staging slot did so for two minutes after the image was set, and a wait that
# accepted the first 200 handed the checks below the old process, which had no
# health key in its environment and failed the build id check. A public health
# response here therefore means "not yet", and only the last attempt reads it
# as a key problem.
wait_for_liveness() {
  local i response code body sha public_answers=0 last=""
  for ((i = 1; i <= LIVENESS_ATTEMPTS; i++)); do
    response=$(fetch "${BASE_URL}/api/health?key=${HEALTH_KEY}")
    code=$(printf '%s' "$response" | tail -n 1)
    body=$(printf '%s' "$response" | sed '$d')

    if [[ "$code" != "200" ]]; then
      say "liveness: HTTP ${code} on attempt ${i}/${LIVENESS_ATTEMPTS}"
    else
      sha=$(printf '%s' "$body" | jq -r '.commitSha // empty' 2>/dev/null)
      if [[ -z "$sha" ]]; then
        public_answers=$((public_answers + 1))
        say "liveness: public health response (no commitSha) on attempt ${i}/${LIVENESS_ATTEMPTS}, waiting for ${EXPECTED_SHA}"
      elif [[ "$sha" == "$EXPECTED_SHA" ]]; then
        say "liveness: ${LABEL} serves ${sha} on attempt ${i}/${LIVENESS_ATTEMPTS}"
        return 0
      else
        last="$sha"
        say "liveness: ${LABEL} serves ${sha} on attempt ${i}/${LIVENESS_ATTEMPTS}, waiting for ${EXPECTED_SHA}"
      fi
    fi

    if ((i < LIVENESS_ATTEMPTS)); then
      sleep "$LIVENESS_INTERVAL"
    fi
  done

  if [[ -z "$last" && "$public_answers" -gt 0 ]]; then
    err "${LABEL} never reported a build in ${LIVENESS_ATTEMPTS} attempts: every 200 was the public health response. Either the new container never took over, or NUXT_HEALTH_CHECK_SECRET on the target does not match HEALTH_CHECK_SECRET here - the Bicep step of this workflow sets it, and a slot picks it up at that step or at --action preview."
  else
    err "${LABEL} never reported ${EXPECTED_SHA} after ${LIVENESS_ATTEMPTS} attempts; the last build it reported was ${last:-none}."
  fi
  return 1
}

check_identity() {
  local response code body tenant
  response=$(fetch "${BASE_URL}/api/config")
  code=$(printf '%s' "$response" | tail -n 1)
  body=$(printf '%s' "$response" | sed '$d')

  if [[ "$code" != "200" ]]; then
    say "identity: /api/config answered HTTP ${code}"
    return $SOFT
  fi

  tenant=$(printf '%s' "$body" | jq -r '.tenantId // empty' 2>/dev/null)
  if [[ -z "$tenant" ]]; then
    err "identity: /api/config on ${LABEL} answered 200 without a tenantId."
    return $HARD
  fi

  SERVED_TENANT="$tenant"
  # hostname is the tenant's production name on every alias, so tenantId is the
  # only field that identifies who answered.
  if [[ "$tenant" != "$EXPECTED_TENANT_ID" ]]; then
    err "identity: expected tenant '${EXPECTED_TENANT_ID}', ${LABEL} reports '${tenant}'."
    return $HARD
  fi

  say "identity: tenantId '${tenant}'"
  return $READY
}

check_build_id() {
  local response code body sha
  response=$(fetch "${BASE_URL}/api/health?key=${HEALTH_KEY}")
  code=$(printf '%s' "$response" | tail -n 1)
  body=$(printf '%s' "$response" | sed '$d')

  if [[ "$code" != "200" ]]; then
    say "build id: /api/health answered HTTP ${code}"
    return $SOFT
  fi

  sha=$(printf '%s' "$body" | jq -r '.commitSha // empty' 2>/dev/null)
  if [[ -z "$sha" ]]; then
    # Liveness already saw this origin report EXPECTED_SHA, so a public answer now is
    # a process without the key answering again - a restart in progress, not a wrong
    # build. Retried; if it never comes back, the rounds run out and the log says so.
    say "build id: public health response (no commitSha); a restart may be in progress"
    return $SOFT
  fi

  SERVED_SHA="$sha"
  if [[ "$sha" != "$EXPECTED_SHA" ]]; then
    err "build id: expected ${EXPECTED_SHA}, ${LABEL} serves ${sha}. Not retried; a wrong build does not become the right one."
    return $HARD
  fi

  say "build id: ${sha}"
  return $READY
}

# The sitemap is built from the tenant's own configuration and a live Geins
# lookup per market and language, so an empty or failing one is itself a
# reasonable sign of life - and it hands us a category path that exists right
# now instead of one that existed when this file was written.
discover_paths() {
  local response code body entries category
  response=$(fetch "${BASE_URL}/api/__sitemap__/urls")
  code=$(printf '%s' "$response" | tail -n 1)
  body=$(printf '%s' "$response" | sed '$d')

  if [[ "$code" != "200" ]]; then
    say "sitemap: /api/__sitemap__/urls answered HTTP ${code}"
    return $SOFT
  fi

  entries=$(printf '%s' "$body" | jq 'if type == "array" then length else 0 end' 2>/dev/null)
  if [[ -z "$entries" || "$entries" == "0" ]]; then
    err "sitemap: ${LABEL} answered 200 with no usable url list, so no page could be picked."
    return $SOFT
  fi

  # The prefix match assumes loc values are relative ("/se/sv/c/..."), which is
  # what the endpoint returns; absolute urls would never match and no page would
  # ever be picked.
  category=$(printf '%s' "$body" |
    jq -r --arg prefix "${HOME_PATH}c/" \
      'map(.loc) | map(select(startswith($prefix))) | first // empty' 2>/dev/null)

  if [[ -z "$category" ]]; then
    err "sitemap: ${entries} urls on ${LABEL}, none under '${HOME_PATH}c/'. A tenant with no category page is not something to pass over quietly."
    return $SOFT
  fi

  VERIFY_PATHS="${HOME_PATH} ${category}"
  say "sitemap: ${entries} urls; rendering ${HOME_PATH} and ${category}"
  return $READY
}

# Renders every discovered path WARM_HITS times and judges the median of the
# warm hits. The first hit is discarded on purpose: it is the cold render this
# whole exercise exists to move out of customers' path.
check_pages() {
  local path i result code ms warm mid verdict outcome
  PAGE_ROWS=""
  outcome=$READY

  # Unquoted on purpose: VERIFY_PATHS is a space-separated list.
  for path in $VERIFY_PATHS; do
    warm=""
    for ((i = 1; i <= WARM_HITS; i++)); do
      result=$(probe "${BASE_URL}${path}")
      code="${result%% *}"
      ms="${result##* }"

      if [[ "$code" != "200" ]]; then
        say "page ${path} hit ${i}/${WARM_HITS}: HTTP ${code} after ${ms} ms"
        err "page ${path} answered HTTP ${code} on ${LABEL}."
        PAGE_ROWS="${PAGE_ROWS}| \`${path}\` | - | - | HTTP ${code} |
"
        return $SOFT
      fi

      if ((i == 1)); then
        say "page ${path} hit ${i}/${WARM_HITS}: 200 in ${ms} ms (cold, discarded)"
      else
        say "page ${path} hit ${i}/${WARM_HITS}: 200 in ${ms} ms"
        warm="${warm} ${ms}"
      fi

      # Measured 2026-09-10: the same page medians about 2 s with a pause between
      # hits and about 4 s without one, on the same instance. Back-to-back
      # requests on one core measure this script's burst, not the page.
      if ((i < WARM_HITS)); then
        sleep "$HIT_PAUSE"
      fi
    done

    mid=$(median $warm)
    if ((mid > TTFB_BUDGET_MS)); then
      verdict="over ${TTFB_BUDGET_MS} ms"
      outcome=$SOFT
      say "page ${path}: median ${mid} ms of${warm} - ${verdict}"
    else
      verdict="ok"
      say "page ${path}: median ${mid} ms of${warm}"
    fi

    PAGE_ROWS="${PAGE_ROWS}| \`${path}\` |${warm} | ${mid} ms | ${verdict} |
"
  done

  if ((outcome != READY)); then
    err "one or more pages on ${LABEL} rendered slower than ${TTFB_BUDGET_MS} ms at the median."
  fi
  return $outcome
}

# Health comes last and counts for nothing but liveness. It passed 41 times in
# a row on 2026-09-10 while the site was unusable in a browser.
check_health_last() {
  local result code ms
  result=$(probe "${BASE_URL}/api/health")
  code="${result%% *}"
  ms="${result##* }"

  if [[ "$code" != "200" ]]; then
    say "health: HTTP ${code}"
    return $SOFT
  fi

  say "health: 200 in ${ms} ms"
  return $READY
}

run_round() {
  local rc
  check_identity
  rc=$?
  ((rc == READY)) || return $rc

  check_build_id
  rc=$?
  ((rc == READY)) || return $rc

  discover_paths
  rc=$?
  ((rc == READY)) || return $rc

  check_pages
  rc=$?
  ((rc == READY)) || return $rc

  check_health_last
  return $?
}

# -----------------------------------------------------------------------------
# Report
# -----------------------------------------------------------------------------

write_summary() {
  local verdict="$1"

  if [[ -z "${GITHUB_STEP_SUMMARY:-}" ]]; then
    return 0
  fi

  {
    echo "### ${verdict}: ${LABEL}"
    echo ""
    echo "| Property | Value |"
    echo "|----------|-------|"
    echo "| Origin | ${BASE_URL} |"
    echo "| Tenant | ${SERVED_TENANT:-not read} |"
    echo "| Expected build | \`${EXPECTED_SHA}\` |"
    echo "| Served build | \`${SERVED_SHA:-not read}\` |"
    echo "| Median TTFB budget | ${TTFB_BUDGET_MS} ms |"
    echo ""

    if [[ -n "$PAGE_ROWS" ]]; then
      echo "| Page | warm TTFB (ms) | median | verdict |"
      echo "|------|----------------|--------|---------|"
      printf '%s' "$PAGE_ROWS"
      echo ""
    fi
  } >>"$GITHUB_STEP_SUMMARY"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

say "verifying ${LABEL} at ${BASE_URL}"
say "expecting tenant '${EXPECTED_TENANT_ID}' on build ${EXPECTED_SHA}"

if ! wait_for_liveness; then
  write_summary "Not ready"
  exit 1
fi

for ((round = 1; round <= ROUNDS; round++)); do
  say "readiness round ${round}/${ROUNDS}"
  run_round
  status=$?

  if ((status == READY)); then
    say "${LABEL} is ready"
    write_summary "Ready"
    exit 0
  fi

  if ((status == HARD)); then
    write_summary "Not ready"
    exit 1
  fi

  if ((round < ROUNDS)); then
    say "round ${round} was not ready; pausing ${ROUND_PAUSE}s"
    sleep "$ROUND_PAUSE"
  fi
done

err "${LABEL} was not ready after ${ROUNDS} rounds."
write_summary "Not ready"
exit 1
