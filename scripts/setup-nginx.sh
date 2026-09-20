#!/usr/bin/env bash
set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo 'Run with sudo: sudo bash scripts/setup-nginx.sh api.example.com admin@example.com' >&2
  exit 1
fi
domain="${1:-}"
email="${2:-}"
# Allow only a DNS hostname, so substitution cannot introduce Nginx directives.
if [[ ${#domain} -gt 253 || ! "$domain" =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$ ]]; then
  echo 'Provide a public DNS hostname without a scheme, port or path.' >&2
  exit 1
fi
if [[ ! "$email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ || "$email" == -* ]]; then
  echo 'Provide a valid certificate contact email.' >&2
  exit 1
fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site=/etc/nginx/sites-available/netscope
enabled=/etc/nginx/sites-enabled/netscope

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

if [[ -e "$site" ]]; then
  if ! grep -Fq "server_name $domain;" "$site"; then
    echo "$site already exists for another domain. Review it manually; it was not overwritten." >&2
    exit 1
  fi
  echo "Reusing $site, including any existing HTTPS configuration."
else
  sed "s/__DOMAIN__/$domain/g" "$root/deploy/nginx.conf.template" > "$site"
  chmod 644 "$site"
fi
if [[ -e "$enabled" || -L "$enabled" ]]; then
  [[ -L "$enabled" && "$(readlink -f "$enabled")" == "$site" ]] || {
    echo "$enabled already exists and points elsewhere. Review it manually." >&2; exit 1;
  }
else
  ln -s "$site" "$enabled"
fi
nginx -t
systemctl enable --now nginx
systemctl reload nginx

certbot --nginx --non-interactive --agree-tos --redirect --keep-until-expiring \
  --email "$email" -d "$domain"
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
echo "Nginx is configured for https://$domain. Run: sudo certbot renew --dry-run"
