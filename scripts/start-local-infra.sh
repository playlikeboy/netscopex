#!/usr/bin/env bash
set -euo pipefail

PG_DATA_DIR="/tmp/netscopex-pgdata"
PG_PORT=54332
PG_LOG="/tmp/netscopex-pg.log"

echo "=== Starting NetScope X Local Infrastructure ==="

# Check if PostgreSQL is already running on port 54332
if pg_isready -h 127.0.0.1 -p $PG_PORT -U postgres > /dev/null 2>&1; then
  echo "PostgreSQL is already running on port $PG_PORT"
else
  if [ ! -d "$PG_DATA_DIR" ]; then
    echo "Initializing PostgreSQL data directory at $PG_DATA_DIR..."
    initdb -D "$PG_DATA_DIR" -U postgres -A trust --no-locale -E UTF8 > /dev/null
  fi

  echo "Starting PostgreSQL daemon with pg_ctl on port $PG_PORT..."
  setsid pg_ctl -D "$PG_DATA_DIR" -o "-p $PG_PORT -k /tmp" -l "$PG_LOG" start

  # Wait for postgres to be ready
  for i in {1..15}; do
    if pg_isready -h 127.0.0.1 -p $PG_PORT -U postgres > /dev/null 2>&1; then
      echo "PostgreSQL is ready and accepting connections."
      break
    fi
    sleep 0.5
  done
fi

# Ensure netscopex database exists
psql -h 127.0.0.1 -p $PG_PORT -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'netscopex'" | grep -q 1 || \
  psql -h 127.0.0.1 -p $PG_PORT -U postgres -c "CREATE DATABASE netscopex;"

echo "Database 'netscopex' is ready."
