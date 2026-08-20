#!/bin/sh
set -e

cd /var/www/html

echo "==> Caching Laravel config..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> Running database migrations..."
php artisan migrate --force

echo "==> Creating queue jobs table if missing..."
php artisan queue:table 2>/dev/null || true
php artisan migrate --force

echo "==> Starting services..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
