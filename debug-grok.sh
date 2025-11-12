#!/bin/bash
# Diagnostic script for debugging grok-cli streaming UI bobbing issue
# Usage: ./debug-grok.sh "your prompt here"

if [ -z "$1" ]; then
  echo "Usage: $0 \"<prompt>\""
  echo "Example: $0 \"analyze this entire codebase\""
  exit 1
fi

echo "========================================="
echo "Grok CLI Diagnostic Monitor"
echo "========================================="
echo "Prompt: $1"
echo "Start time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo ""

# Start grok in background, redirect stderr to a log file for debug output
LOG_FILE="grok-debug-$(date +%s).log"
echo "Debug output will be saved to: $LOG_FILE"
echo ""

# Start grok and capture its PID
grok "$1" 2>"$LOG_FILE" &
GROK_PID=$!

# Check if process started successfully
sleep 2
if ! kill -0 $GROK_PID 2>/dev/null; then
  echo "❌ Failed to start grok process"
  exit 1
fi

echo "✓ Grok process started (PID: $GROK_PID)"
echo ""
echo "Monitoring... (Press Ctrl+C to stop)"
echo "========================================="
printf "%-10s %-15s %-15s %-15s\n" "TIME" "MEMORY (MB)" "CPU (%)" "STATUS"
echo "========================================="

# Counter for elapsed time
START_TIME=$SECONDS
WARNED_15MIN=false

# Monitor the process
while kill -0 $GROK_PID 2>/dev/null; do
  ELAPSED=$((SECONDS - START_TIME))

  # Get memory usage in MB
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    MEM=$(ps -o rss= -p $GROK_PID 2>/dev/null | awk '{print $1/1024}')
    CPU=$(ps -o %cpu= -p $GROK_PID 2>/dev/null)
  else
    # Linux
    MEM=$(ps -o rss= -p $GROK_PID 2>/dev/null | awk '{print $1/1024}')
    CPU=$(ps -o %cpu= -p $GROK_PID 2>/dev/null)
  fi

  # Handle case where ps command fails
  if [ -z "$MEM" ]; then
    MEM="N/A"
    CPU="N/A"
  fi

  # Format elapsed time
  HOURS=$((ELAPSED / 3600))
  MINUTES=$(( (ELAPSED % 3600) / 60 ))
  SECS=$((ELAPSED % 60))
  TIME_STR=$(printf "%02d:%02d:%02d" $HOURS $MINUTES $SECS)

  # Determine status
  STATUS="Running"
  if [ $ELAPSED -ge 900 ] && [ "$WARNED_15MIN" = false ]; then
    STATUS="⚠️  15min+"
    WARNED_15MIN=true
    echo ""
    echo "⚠️  ⚠️  ⚠️  REACHED 15-MINUTE MARK - WATCH FOR UI BOBBING! ⚠️  ⚠️  ⚠️"
    echo ""
  elif [ $ELAPSED -ge 900 ]; then
    STATUS="⚠️  Watch"
  fi

  printf "%-10s %-15s %-15s %-15s\n" "$TIME_STR" "$MEM" "$CPU" "$STATUS"

  # Check debug log for interesting patterns every 30 seconds
  if [ $((ELAPSED % 30)) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
    # Count debug messages in last interval
    DEBUG_HISTORY=$(grep "\[DEBUG\] Chat history size:" "$LOG_FILE" 2>/dev/null | tail -1)
    DEBUG_MEMORY=$(grep "\[DEBUG\] Memory:" "$LOG_FILE" 2>/dev/null | tail -1)

    if [ -n "$DEBUG_HISTORY" ]; then
      echo "  └─ $DEBUG_HISTORY"
    fi
    if [ -n "$DEBUG_MEMORY" ]; then
      echo "  └─ $DEBUG_MEMORY"
    fi
  fi

  sleep 10
done

echo ""
echo "========================================="
echo "Process ended at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Total duration: $TIME_STR"
echo "========================================="
echo ""
echo "📊 Debug log summary:"
echo "--------------------"

# Analyze the log file
if [ -f "$LOG_FILE" ]; then
  HISTORY_LINES=$(grep "\[DEBUG\] Chat history size:" "$LOG_FILE" | wc -l)
  MAX_HISTORY=$(grep "\[DEBUG\] Chat history size:" "$LOG_FILE" | sed 's/.*: \([0-9]*\) entries/\1/' | sort -n | tail -1)
  MAX_MEMORY=$(grep "\[DEBUG\] Memory:" "$LOG_FILE" | sed 's/.*: \([0-9.]*\) MB/\1/' | sort -n | tail -1)
  RENDER_COUNT=$(grep "\[DEBUG\] Rendering" "$LOG_FILE" | wc -l)

  echo "History size checks: $HISTORY_LINES"
  echo "Max history size: $MAX_HISTORY entries"
  echo "Max memory usage: $MAX_MEMORY MB"
  echo "Render events: $RENDER_COUNT"
  echo ""
  echo "Full debug log saved to: $LOG_FILE"
else
  echo "No debug log generated"
fi

echo ""
echo "To analyze the log further, run:"
echo "  grep DEBUG $LOG_FILE"
