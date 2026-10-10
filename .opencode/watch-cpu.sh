#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS="$DIR"
mkdir -p "$RESULTS"

MONITOR_LOG="$RESULTS/cpu-monitor-$(date +%Y%m%d-%H%M%S).csv"
ALERT_LOG="$RESULTS/cpu-monitor-$(date +%Y%m%d-%H%M%S)-alerts.log"

echo "timestamp,opencode_cpu%,opencode_mem%,http_cpu%,total_cpu%" > "$MONITOR_LOG"

echo "================================================================="
echo "  OpenCode CPU Monitor"
echo "  Log: $MONITOR_LOG"
echo "  Alerts: $ALERT_LOG"
echo "================================================================="
echo ""
echo "  Monitoring CPU every 2s..."
echo ""

find_opencode_pid() {
  pgrep -x opencode 2>/dev/null | head -1 || echo ""
}

HIGH_CPU_COUNT=0
STALL_THRESHOLD=20
HIGH_CPU_THRESHOLD=20
INTERVAL=2

cleanup() {
  echo ""
  echo "=== Summary ==="
  HIGH=$(grep -c "STALL" "$ALERT_LOG" 2>/dev/null || echo 0)
  if [ "$HIGH" -gt 0 ]; then
    echo "  ⚠️  $HIGH stall-like patterns detected"
  else
    echo "  No stall patterns detected"
  fi
  echo "  CSV: $MONITOR_LOG"
  exit 0
}
trap cleanup INT TERM

while true; do
  NOW=$(date +%H:%M:%S)
  OPENCODE_PID=$(find_opencode_pid)

  if [ -z "$OPENCODE_PID" ]; then
    echo "$NOW,0,0,0,0" >> "$MONITOR_LOG"
    HIGH_CPU_COUNT=0
    sleep "$INTERVAL"
    continue
  fi

  if PS_OUTPUT=$(ps -p "$OPENCODE_PID" -o %cpu=,%mem= 2>/dev/null); then
    OPENCODE_CPU=$(echo "$PS_OUTPUT" | awk '{print $1}')
    OPENCODE_MEM=$(echo "$PS_OUTPUT" | awk '{print $2}')
  else
    OPENCODE_CPU=0
    OPENCODE_MEM=0
  fi

  HTTP_CPU=$(ps --no-headers -C "node,http" -o %cpu= 2>/dev/null | awk '{s+=$1} END{print s+0}')
  TOTAL_CPU=$(ps --no-headers -C opencode,node -o %cpu= 2>/dev/null | awk '{s+=$1} END{print s+0}')

  echo "$NOW,$OPENCODE_CPU,$OPENCODE_MEM,$HTTP_CPU,$TOTAL_CPU" >> "$MONITOR_LOG"

  HIGH_CPU=$(echo "$OPENCODE_CPU > $HIGH_CPU_THRESHOLD" | bc -l 2>/dev/null || echo 0)
  if [ "$HIGH_CPU" -eq 1 ]; then
    HIGH_CPU_COUNT=$((HIGH_CPU_COUNT + 1))
    if [ "$HIGH_CPU_COUNT" -ge "$STALL_THRESHOLD" ]; then
      echo "[$NOW] ⚠️ STALL-LIKE: opencode CPU ${OPENCODE_CPU}% sustained ${STALL_THRESHOLD}samples" >> "$ALERT_LOG"
      >&2 echo "[$NOW] ⚠️ STALL: CPU ${OPENCODE_CPU}% for ${STALL_THRESHOLD}samples"
      HIGH_CPU_COUNT=0
    fi
  else
    HIGH_CPU_COUNT=0
  fi

  if [ $(( $(date +%s) % 10 )) -eq 0 ]; then
    echo "  [${NOW}] PID=${OPENCODE_PID} CPU=${OPENCODE_CPU}% MEM=${OPENCODE_MEM}% http=${HTTP_CPU}%"
  fi

  sleep "$INTERVAL"
done
