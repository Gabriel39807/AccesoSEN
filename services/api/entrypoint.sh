#!/bin/sh
set -eu

echo "Running migrations..."
python manage.py migrate --noinput

echo "Starting API..."
exec "$@"
