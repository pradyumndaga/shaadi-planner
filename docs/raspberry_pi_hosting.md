# Hosting Shaadi Planner on Raspberry Pi + rupaiq.in

This guide sets up your app at:
- **Frontend**: `https://shaadi.rupaiq.in`
- **Backend API**: `https://api.rupaiq.in`

> [!IMPORTANT]
> This guide uses **Cloudflare Tunnels** — the safest and simplest way to expose a Pi to the internet. No port forwarding needed. Free SSL included. You just need `rupaiq.in` to be managed through Cloudflare DNS.

---

## Part 1: Prepare Your Domain (One-time)

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Make sure `rupaiq.in` is added as a site in Cloudflare. If not, follow the instructions to change your nameservers.
3. No need to create DNS records manually — the tunnel will handle it.

---

## Part 2: Set Up Your Raspberry Pi

### Install Node.js (v18+)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Clone / Transfer Your Project
```bash
# Option A — if you have it on GitHub:
git clone https://github.com/YOUR_USERNAME/shaadi-planner.git

# Option B — copy from Mac via SCP:
scp -r /Users/pradyumn/Documents/shaadi-planner pi@<PI_IP>:~/
```

### Install & Run Backend
```bash
cd ~/shaadi-planner/backend
npm install

# Create the required .env file (not included in git)
echo 'DATABASE_URL="file:./dev.db"' > .env

npx prisma generate
npx prisma db push     # creates the SQLite database
node src/server.js     # test it works; you should see "Server is running on port 5001"
```

### Build & Serve Frontend
```bash
cd ~/shaadi-planner/ui
npm install
npm run build          # uses .env.production → VITE_API_URL=https://api.rupaiq.in

sudo npm install -g serve
serve -s dist -l 3000  # test it works on port 3000
```

---

## Part 3: Install PM2 (Keep Apps Running Forever)

```bash
sudo npm install -g pm2

# Start the backend
pm2 start ~/shaadi-planner/backend/src/server.js --name shaadi-api

# Start the frontend static server
pm2 serve ~/shaadi-planner/ui/dist 3000 --name shaadi-ui --spa

# Save and enable auto-start on reboot
pm2 save
pm2 startup systemd   # run the command it prints as sudo
```

---

## Part 4: Set Up Cloudflare Tunnel

### Install cloudflared
```bash
# On Raspberry Pi (64-bit OS):
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared-linux-arm64.deb

# For 32-bit Pi OS, replace arm64 with arm
```

### Authenticate
```bash
cloudflared tunnel login
# This opens a browser link — open it on your Mac, log in to Cloudflare, and authorize rupaiq.in
```

### Create the Tunnel
```bash
cloudflared tunnel create shaadi
# Note the tunnel ID it prints — you'll need it below
```

### Create the Config File
```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Paste this (replace `<TUNNEL_ID>` with your actual ID):
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/pi/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: shaadi.rupaiq.in
    service: http://localhost:3000
  - hostname: api.rupaiq.in
    service: http://localhost:5001
  - service: http_status:404
```

### Create DNS Records via Tunnel
```bash
cloudflared tunnel route dns shaadi shaadi.rupaiq.in
cloudflared tunnel route dns shaadi api.rupaiq.in
```

### Test It
```bash
cloudflared tunnel run shaadi
# Visit https://shaadi.rupaiq.in in your browser to verify it works
```

### Run as a System Service (Auto-start)
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

## Part 5: Keeping It Updated

When you update the code on your Mac, push to Git and pull on the Pi:
```bash
git pull
cd backend && npm install && npx prisma db push
cd ../ui && npm install && npm run build
pm2 restart all
```

---

## Summary

| What | URL |
|---|---|
| Wedding Planner App | `https://shaadi.rupaiq.in` |
| Backend API | `https://api.rupaiq.in` |
| Local Dev | `http://localhost:5173` (as usual) |

> [!TIP]
> If your Pi's IP changes on your local network, the tunnel still works because it connects outward to Cloudflare, not inward from the internet.
