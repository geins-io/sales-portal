#!/usr/bin/env bash
# Installs the system libraries the Playwright browsers need — the apt half of
# `playwright install --with-deps` — with bounded, retried attempts. The CI
# workflows run this, then a plain `playwright install` for the browsers.
#
# Why: apt on the hosted runners sometimes crawls or hangs, and that half is
# never cached. Measured 2026-10-07: the ~120 MB of packages normally arrive at
# ~10 MB/s, but some runners fetched them at 190–500 kB/s (4–11 min), and once
# `apt-get update` went silent for 14 min. Either ate the job's whole timeout.
# A step-level `timeout-minutes` only fails the step and Actions has no retry,
# so the attempts live here.
#
# Each attempt is bounded by `timeout`. A retry does not start from zero:
# fetched packages stay in /var/cache/apt/archives, and each attempt opens fresh
# connections. After a failed attempt, the apt-get/dpkg it left running are
# killed — Playwright runs apt through `sudo sh -c`, which a timeout can leave
# behind — and before a retry `dpkg --configure -a` repairs an install cut off
# mid-unpack.
#
# Usage: infra/scripts/install-playwright-deps.sh <browser>...
#   PLAYWRIGHT_DEPS_ATTEMPTS         attempts (default 3)
#   PLAYWRIGHT_DEPS_ATTEMPT_TIMEOUT  bound per attempt, as for timeout(1) (default 5m)
# The defaults are what the workflows' timeout-minutes are computed from.

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <browser>..." >&2
  exit 2
fi

ATTEMPTS="${PLAYWRIGHT_DEPS_ATTEMPTS:-3}"
ATTEMPT_TIMEOUT="${PLAYWRIGHT_DEPS_ATTEMPT_TIMEOUT:-5m}"

# Stops the apt-get/dpkg an interrupted attempt left behind, so the next attempt
# does not fail on its locks. The timeout's signal does not reach them: sudo
# starts the command in a process group of its own, and apt-get outlives it,
# reparented to init. By name rather than by lock holder (`fuser`), because
# apt-get makes itself non-dumpable and a container's root cannot see its open
# files. On a throwaway runner every apt-get and dpkg is this script's.
release_apt_locks() {
  sudo pkill -TERM -x 'apt-get|dpkg' || true
  sleep 2
  sudo pkill -KILL -x 'apt-get|dpkg' || true
}

for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  status=0
  timeout --kill-after=20s "$ATTEMPT_TIMEOUT" pnpm exec playwright install-deps "$@" || status=$?
  if ((status == 0)); then
    exit 0
  fi

  # 124: the bound hit; 137: it also took the SIGKILL from --kill-after.
  if ((status == 124 || status == 137)); then
    reason="timed out after $ATTEMPT_TIMEOUT"
  else
    reason="exited with $status"
  fi
  echo "::warning::Playwright system dependencies: attempt $attempt of $ATTEMPTS $reason"

  # After the last attempt too: a left-over apt-get would run on into the
  # job's later steps.
  release_apt_locks
  if ((attempt < ATTEMPTS)); then
    sudo dpkg --configure -a || echo "::warning::dpkg --configure -a exited non-zero; retrying anyway"
  fi
done

echo "::error::Playwright system dependencies: no attempt of $ATTEMPTS finished"
exit 1
