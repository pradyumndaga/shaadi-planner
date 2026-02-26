# Hosting Shaadi Planner on Linux Mint (Internet Access)

This guide provides step-by-step instructions to take your Wedding Planner application, currently running on your laptop, and deploy it gracefully on **Linux Mint** so you can access it from anywhere in the world securely over the internet.

We will use **Cloudflare Tunnels**. This is the safest, most robust way to expose a local service to the internet. It requires **no port forwarding**, prevents DDOS attacks automatically, and provides free SSL (HTTPS).

> **Prerequisite:** You need a domain name (like `yourdomain.com` or the `rupaiq.in` domain we discussed earlier) managed through Cloudflare.

---

## Part 1: Install Node.js & Dependencies on Linux Mint

Linux Mint is based on Ubuntu/Debian, so we use the standard `apt` package manager.

1. **Open your terminal** and install the latest LTS version of Node.js (v20):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

2. **Clone/Copy your project directory** to your Linux Mint machine if it isn't there already.

---

## Part 2: Setup and Build the Application

### 1. Backend API
Open a terminal in the `backend` folder of your project:
```bash
cd /path/to/shaadi-planner/backend
npm install

# Create the SQLite database file
npx prisma generate
npx prisma db push

# Test that it runs
node src/server.js
# You should see: "Server is running on port 5001"
# Press Ctrl+C to stop it for now.
```

### 2. Frontend UI
Open a terminal in the `ui` folder of your project:
```bash
cd /path/to/shaadi-planner/ui

# Ensure your .env.production file points to your future internet domain
# Example: VITE_API_URL=https://api.yourdomain.com
nano .env.production 

npm install
npm run build
```

---

## Part 3: Keep the App Running in the Background

We'll use **PM2**, a production process manager for Node.js, to keep your backend and frontend running continuously, even if you close the terminal, and to automatically restart them if your laptop reboots.

```bash
# Install PM2 globally
sudo npm install -g pm2 serve

# Start the Backend
cd /path/to/shaadi-planner/backend
pm2 start src/server.js --name shaadi-api

# Start the Frontend (serving the built 'dist' folder on port 3000)
cd /path/to/shaadi-planner/ui
pm2 serve dist 3000 --name shaadi-ui --spa

# Save the processes so they resurrect on reboot
pm2 save
pm2 startup
# *Note: The 'pm2 startup' command will output a specific 'sudo env PATH...' command. 
# Copy and paste that outputted command into your terminal to finalize the auto-start.*
```

Now, your app is running locally on your laptop:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`

---

## Part 4: Connect to the Internet using Cloudflare Tunnels

### 1. Install Cloudflared
Since Linux Mint runs on standard Intel/AMD processors (amd64), run:
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### 2. Authenticate with your Cloudflare Account
```bash
cloudflared tunnel login
```
*This will output a URL. Click it or copy it into your browser, log in to Cloudflare, and authorize your domain (e.g., `rupaiq.in`).*

### 3. Create the Tunnel
```bash
cloudflared tunnel create shaadi
```
*It will print a Tunnel ID (a long string like `a1b2c3d4-xxxx-xxxx...`). **Copy this ID**.*
e4064315-9adf-40b0-8312-fd0bc40b40f4
### 4. Create the Configuration File
```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Paste the following into the file, replacing `<YOUR_TUNNEL_ID>` with the ID from the previous step, and `yourdomain.com` with your actual domain:

```yaml
tunnel: e4064315-9adf-40b0-8312-fd0bc40b40f4
credentials-file: /home/pradyumn/.cloudflared/e4064315-9adf-40b0-8312-fd0bc40b40f4.json

ingress:
  - hostname: shaadi.rupaiq.in
    service: http://localhost:3000
  - hostname: api.rupaiq.in
    service: http://localhost:5001
  - service: http_status:404
```
*(Make sure to change `USERNAME` in the path to your actual Linux Mint username).*
Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### 5. Route your DNS via Cloudflare
Tell Cloudflare to point these subdomains to your laptop's tunnel:
```bash
cloudflared tunnel route dns shaadi shaadi.yourdomain.com
cloudflared tunnel route dns shaadi api.yourdomain.com
```

### 6. Install as a System Service
To ensure the tunnel connects automatically whenever your laptop is on and connected to the internet:
```bash
sudo mkdir -p /etc/cloudflared/
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

## 🎉 You're Done!

You can now open your phone (disconnected from WiFi) or any computer in the world and navigate to:
**`https://shaadi.yourdomain.com`**

Your Wedding Planner is securely hosted! 

**Maintenance Tips:**
- **Lid Closed:** If you close your laptop lid, Linux Mint usually goes to sleep, which drops the internet and server. You can change your Power Management settings in Linux Mint to "Do nothing when lid is closed" if you intend to leave it running like a server.
- **Updates:** To update the app with new code: `git pull`, then `cd ui && npm run build`, and then `pm2 restart all`.
