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
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
