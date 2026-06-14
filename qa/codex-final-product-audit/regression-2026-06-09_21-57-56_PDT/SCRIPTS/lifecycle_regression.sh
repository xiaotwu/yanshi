#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/xiaotwu/Code/yanshi"
REG_DIR="$ROOT/qa/codex-final-product-audit/regression-2026-06-09_21-57-56_PDT"
LOGS="$REG_DIR/LOGS"
APP="$ROOT/apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app"
SIDECAR="$APP/Contents/Resources/resources/yanshi-runtime-sidecar"
DATA_DIR="$HOME/Library/Application Support/com.yanshi.desktop"
ADOPT_DATA_DIR="$REG_DIR/adopted-runtime-data"
BASE="http://127.0.0.1:8765"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  log "FAIL: $*"
  exit 1
}

write_processes() {
  local name="$1"
  ps -ax -o pid=,ppid=,stat=,command= \
    | awk '/\/yanshi-(runtime|desktop)|Yanshi\.app\/Contents\/MacOS\/yanshi-desktop/ && !/awk/ {print}' \
    > "$LOGS/${name}-processes.txt"
  lsof -nP -iTCP:8765 -sTCP:LISTEN > "$LOGS/${name}-port-8765.txt" 2>&1 || true
}

wait_health() {
  local name="$1"
  for _ in $(seq 1 80); do
    if curl -fsS "$BASE/health" > "$LOGS/${name}-health.json" 2> "$LOGS/${name}-health.err"; then
      cat "$LOGS/${name}-health.json"
      return 0
    fi
    sleep 0.25
  done
  return 1
}

create_and_wait_run() {
  local name="$1"
  local run_json="$LOGS/${name}-create-run.json"
  local runs_json="$LOGS/${name}-runs.json"
  curl -fsS -X POST "$BASE/runs" \
    -H 'Content-Type: application/json' \
    -d '{"task":"List workspace files","permissionMode":"default"}' \
    > "$run_json"
  local run_id
  run_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$run_json")"
  for _ in $(seq 1 80); do
    curl -fsS "$BASE/runs" > "$runs_json"
    local status
    status="$(python3 -c 'import json,sys; rid=sys.argv[1]; runs=json.load(open(sys.argv[2])); print(next(r["status"] for r in runs if r["id"]==rid))' "$run_id" "$runs_json")"
    if [[ "$status" == "completed" ]]; then
      printf '%s completed\n' "$run_id" > "$LOGS/${name}-run-status.txt"
      return 0
    fi
    if [[ "$status" == "failed" || "$status" == "pending_approval" ]]; then
      printf '%s %s\n' "$run_id" "$status" > "$LOGS/${name}-run-status.txt"
      return 1
    fi
    sleep 0.25
  done
  printf '%s timeout\n' "$run_id" > "$LOGS/${name}-run-status.txt"
  return 1
}

quit_app_and_expect_no_port() {
  local name="$1"
  osascript -e 'tell application "Yanshi" to quit' > "$LOGS/${name}-quit.out" 2> "$LOGS/${name}-quit.err" || true
  for _ in $(seq 1 40); do
    if ! lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
      write_processes "$name-after-quit"
      return 0
    fi
    sleep 0.25
  done
  write_processes "$name-after-quit"
  return 1
}

ensure_clean_start() {
  osascript -e 'tell application "Yanshi" to quit' >/dev/null 2>&1 || true
  pkill -TERM -f '/yanshi-runtime-sidecar' >/dev/null 2>&1 || true
  pkill -TERM -f 'Yanshi.app/Contents/MacOS/yanshi-desktop' >/dev/null 2>&1 || true
  sleep 1
  pkill -KILL -f '/yanshi-runtime-sidecar' >/dev/null 2>&1 || true
  pkill -KILL -f 'Yanshi.app/Contents/MacOS/yanshi-desktop' >/dev/null 2>&1 || true
  sleep 1
  write_processes "00-clean-start"
  if lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
    fail "port 8765 is not clean at start"
  fi
}

ensure_clean_start

log "clean packaged launch"
open -n "$APP"
wait_health "10-clean-launch" || fail "clean packaged launch did not become healthy"
write_processes "10-clean-launch"
create_and_wait_run "10-clean-launch" || fail "clean launch run did not complete"
quit_app_and_expect_no_port "10-clean-launch" || fail "clean launch quit left port 8765 occupied"

log "repeated packaged launch"
open -n "$APP"
wait_health "20-relaunch" || fail "relaunch did not become healthy"
write_processes "20-relaunch"
create_and_wait_run "20-relaunch" || fail "relaunch run did not complete"
quit_app_and_expect_no_port "20-relaunch" || fail "relaunch quit left port 8765 occupied"

log "adopt healthy external runtime"
rm -rf "$ADOPT_DATA_DIR"
mkdir -p "$ADOPT_DATA_DIR"
"$SIDECAR" --host 127.0.0.1 --port 8765 --data-dir "$ADOPT_DATA_DIR" \
  > "$LOGS/30-adopt-external-runtime.out" 2> "$LOGS/30-adopt-external-runtime.err" &
external_pid=$!
printf '%s\n' "$external_pid" > "$LOGS/30-adopt-external-runtime.pid"
wait_health "30-adopt-external-runtime" || fail "external runtime did not become healthy"
write_processes "30-before-app-adopt"
open -n "$APP"
sleep 3
write_processes "30-after-app-adopt"
create_and_wait_run "30-after-app-adopt" || fail "adopted-runtime run did not complete"
osascript -e 'tell application "Yanshi" to quit' > "$LOGS/30-adopt-quit.out" 2> "$LOGS/30-adopt-quit.err" || true
sleep 2
write_processes "30-after-adopt-app-quit"
if ! curl -fsS "$BASE/health" > "$LOGS/30-adopt-survives-health.json"; then
  fail "adopted external runtime did not survive app quit"
fi
kill -TERM "$external_pid" >/dev/null 2>&1 || true
sleep 2
pkill -KILL -f "$ADOPT_DATA_DIR" >/dev/null 2>&1 || true
write_processes "30-after-external-runtime-cleanup"
if lsof -nP -iTCP:8765 -sTCP:LISTEN >/dev/null 2>&1; then
  fail "port 8765 still occupied after adopted runtime cleanup"
fi

log "unhealthy port conflict"
python3 -m http.server 8765 --bind 127.0.0.1 \
  > "$LOGS/40-unhealthy-port-server.out" 2> "$LOGS/40-unhealthy-port-server.err" &
conflict_pid=$!
printf '%s\n' "$conflict_pid" > "$LOGS/40-unhealthy-port-server.pid"
sleep 1
write_processes "40-before-conflict-app"
open -n "$APP"
sleep 4
write_processes "40-after-conflict-app"
if ! ps -p "$conflict_pid" >/dev/null 2>&1; then
  fail "unhealthy conflict server was killed by app"
fi
if pgrep -af '/yanshi-runtime-sidecar' | grep -v "$ADOPT_DATA_DIR" > "$LOGS/40-conflict-sidecar-matches.txt"; then
  fail "app spawned sidecar despite unhealthy port conflict"
fi
osascript -e 'tell application "Yanshi" to quit' > "$LOGS/40-conflict-quit.out" 2> "$LOGS/40-conflict-quit.err" || true
kill -TERM "$conflict_pid" >/dev/null 2>&1 || true
sleep 1
write_processes "40-after-conflict-cleanup"

log "PASS lifecycle regression"
