#!/usr/bin/env bash
# One-time bootstrap for a fresh OCI Ubuntu (22.04/24.04, aarch64) VM. Run as a sudo-capable user.
# Installs Docker Engine + Compose plugin from Docker's apt repository and prepares directories.
# It does not open any inbound port: public traffic arrives only through Cloudflare Tunnel.
set -euo pipefail

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git unattended-upgrades
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

sudo mkdir -p /srv/zugrio/backups
sudo chown -R "$USER":"$USER" /srv/zugrio
chmod 700 /srv/zugrio/backups

echo "Docker installed. Log out and back in (docker group), then follow docs/runbooks/PRIVATE_ALPHA_OCI_DEPLOYMENT.md."
