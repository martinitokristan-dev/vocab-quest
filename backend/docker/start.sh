#!/bin/sh
set -e

cd /var/www/html

echo "==> Caching Laravel config and routes..."
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

echo "==> Running database migrations..."
php artisan migrate --force || true

echo "==> Starting Nginx, PHP-FPM, and Queue Worker..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf &

# Self-warm-up: hit the /api/ping endpoint after a brief pause so PHP-FPM
# workers are fully bootstrapped before the first real student request.
# This eliminates the "first request after cold-start" delay.
(
  sleep 8
  echo "==> Warming up PHP-FPM workers..."
  curl -sf http://127.0.0.1:8080/api/ping > /dev/null 2>&1 || true
  curl -sf http://127.0.0.1:8080/api/ping > /dev/null 2>&1 || true
  echo "==> PHP-FPM warm-up complete."
) &

# Re-attach to supervisord (it was sent to background so we could warm up)
wait
