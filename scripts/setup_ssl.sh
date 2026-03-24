#!/bin/bash

# Configuration
DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: sudo ./setup_ssl.sh <your-domain.com> <your-email>"
    exit 1
fi

echo "--- Installing Certbot ---"
apt-get update
apt-get install -y certbot

echo "--- Stopping Nginx Container ---"
docker-compose stop nginx

echo "--- Obtaining SSL Certificate for $DOMAIN ---"
certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

echo "--- Creating SSL Directory ---"
mkdir -p ./nginx/ssl

echo "--- Copying Certificates ---"
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./nginx/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./nginx/ssl/

echo "--- Updating Nginx Config for HTTPS ---"
# Note: This will overwrite the default.conf with a secure version
cat <<EOF > ./nginx/conf.d/default.conf
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

echo "--- Updating Docker Compose to mount SSL ---"
# We need to add the mount in docker-compose.yml
# This part is best done manually or via a careful replacement

echo "--- DONE ---"
echo "Next steps:"
echo "1. Add volume to nginx service in docker-compose.yml:"
echo "   - ./nginx/ssl:/etc/nginx/ssl:ro"
echo "2. Add port 443 to nginx service:"
echo "   - \"443:443\""
echo "3. Run: docker-compose up -d --build"
