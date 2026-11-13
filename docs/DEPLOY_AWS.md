# Deploying ShopSmart to AWS (single EC2 host)

Release **v1.2.0** · Region **ap-southeast-2 (Asia Pacific, Sydney)** · Layout: **one EC2 instance** running Caddy (HTTPS), the Express API and PostgreSQL.
Why this layout: see `AWS_DECISION_RECORD.md`. Picture: `deployment-diagram-aws.png`.

> **Golden rules.** Fictional data only. Never paste the database password, the demo password, a Gemini key or the `.pem` key into Git, chat or a screenshot. Write down every resource you create in `AWS_RESOURCE_REGISTER.md`.

Placeholders used below:

| Placeholder | Meaning | Example |
| --- | --- | --- |
| `<PUBLIC_IP>` | the instance's public IPv4 address | `13.229.45.67` |
| `<SITE_HOST>` | the site's host name: the IP with dashes + `.sslip.io` | `13-229-45-67.sslip.io` |

`sslip.io` is a free public DNS name that points `13-229-45-67.sslip.io` back to `13.229.45.67`. It lets Caddy get a real HTTPS certificate without buying a domain.

---

## Step 0. Check the AWS account BEFORE creating anything

1. Sign in as the account owner. Make sure the root user has **MFA** turned on (top-right name → Security credentials → Multi-factor authentication).
2. Open **Billing and Cost Management**:
   - Write down: plan (**Free** or **Paid**), **credits remaining**, **credit/plan expiry date**.
   - Take a screenshot → blur the account ID and email → save as `docs/release-evidence/AWS-00-account-plan-credits.png`.
3. **Budgets → Create budget → "Zero spend budget"** (or a monthly cost budget of US$1) with your email. You get an email if anything starts costing money.
4. Use **one Region** for every resource below. The plan was Singapore (ap-southeast-1), but this account's Free plan *project* ("Lift Off Soon") is fixed to **Asia Pacific (Sydney) ap-southeast-2**, and its console shows no Region selector. So everything was created in **ap-southeast-2**. Check `region=` in the console address bar.

## Step 1. Launch the EC2 instance

EC2 → **Launch instance**:

| Setting | Value |
| --- | --- |
| Name | `shopsmart-demo` (add tags `Owner` = your name, `Purpose` = `PDC50 ShopSmart demo`, `RemoveBy` = date after grading) |
| AMI | **Ubuntu Server 24.04 LTS**, 64-bit (x86) |
| Instance type | the smallest type your plan lists as available/eligible (usually `t3.micro` or `t2.micro`). Do not pick a larger one. |
| Key pair | **Create new key pair** → `shopsmart-key`, RSA, `.pem`. Save it outside the project folder. Never commit it. |
| Network | default VPC, **Auto-assign public IP: Enable** |
| Security group | **Create** `shopsmart-web-sg` with exactly these inbound rules: |
| | • SSH, TCP 22, Source **My IP** |
| | • HTTP, TCP 80, Source Anywhere-IPv4 (only used to get the certificate and redirect to HTTPS) |
| | • HTTPS, TCP 443, Source Anywhere-IPv4 |
| | **Do NOT add 3000 (Express) or 5432 (PostgreSQL).** |
| Storage | 20 GiB gp3 (stay inside your plan) |

Launch. Copy the **Public IPv4 address** → that is `<PUBLIC_IP>`.
Screenshot the security group's inbound rules → `AWS-01-security-group.png`.

## Step 2. Connect with SSH (Windows PowerShell)

```powershell
cd C:\path\to\folder\with\key
icacls .\shopsmart-key.pem /inheritance:r
icacls .\shopsmart-key.pem /grant:r "$($env:USERNAME):(R)"
ssh -o ServerAliveInterval=60 -i .\shopsmart-key.pem ubuntu@<PUBLIC_IP>
```

The key downloads into `Downloads`. Move it first: `Move-Item "$HOME\Downloads\shopsmart-key.pem" "$HOME\.ssh\"`. `ServerAliveInterval=60` stops an idle SSH window from dropping (`Connection aborted`).

Type `yes` the first time. The prompt changes to `ubuntu@ip-…:~$`. **All the next steps run on the server.**

## Step 3. Install the software

```bash
sudo apt update && sudo DEBIAN_FRONTEND=noninteractive apt -y upgrade

# 2 GB swap file, so npm install and the Vite build do not run out of memory on a 1 GB instance
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node.js 22 LTS, Git, PostgreSQL 16
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs git postgresql

# Caddy (web server with automatic HTTPS), from Caddy's official package repository
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

node --version     # v22.x
psql --version     # 16.x
caddy version
```

## Step 4. Create the database (private to this machine)

```bash
DB_PASSWORD=$(openssl rand -hex 24)      # long random password; stays in this terminal only
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -c "CREATE USER shopsmart_user WITH PASSWORD '$DB_PASSWORD';" \
  -c "CREATE DATABASE shopsmart OWNER shopsmart_user;"

sudo ss -tlnp | grep 5432                # must show 127.0.0.1:5432 (local only), never 0.0.0.0
```

**Do not close this terminal until Step 6**, because `$DB_PASSWORD` is only stored in it.

## Step 5. Get the code and build the frontend

```bash
sudo mkdir -p /opt/shopsmart && sudo chown ubuntu:ubuntu /opt/shopsmart
git clone https://github.com/leeprinceemmanuel-design/ShopSmart-Starter-lee.git /opt/shopsmart
cd /opt/shopsmart
git checkout v1.2.0                      # the release tag (created after the PR is merged)
git rev-parse --short HEAD               # write this code version in the release note

npm ci --include=dev
npm run db:generate
# Same address for site and API, so the bundle only needs the relative path /api
VITE_API_URL=/api npm run build --workspace frontend

# Nothing secret or local may be inside the browser bundle:
grep -rlE "localhost:3000|postgresql://|GEMINI|AIza" frontend/dist && echo "STOP: fix before going on" || echo "OK: bundle is clean"
```

## Step 6. Server-only settings (secrets)

```bash
sudo useradd --system --home /var/lib/shopsmart --create-home --shell /usr/sbin/nologin shopsmart
SITE_HOST="$(curl -s https://checkip.amazonaws.com | tr . -).sslip.io"
echo "Site address: https://$SITE_HOST"

sudo mkdir -p /etc/shopsmart
sudo tee /etc/shopsmart/api.env > /dev/null <<EOF
DATABASE_URL="postgresql://shopsmart_user:${DB_PASSWORD}@127.0.0.1:5432/shopsmart?schema=public"
HOST=127.0.0.1
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://${SITE_HOST}
TRUST_PROXY=1
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
GEMINI_TIMEOUT_MS=8000
EOF
sudo chown root:shopsmart /etc/shopsmart/api.env
sudo chmod 640 /etc/shopsmart/api.env     # only root and the API's user can read it
unset DB_PASSWORD
```

Optional live AI: `sudo nano /etc/shopsmart/api.env`, paste a **separate** Gemini key after `GEMINI_API_KEY=`, save, then `sudo systemctl restart shopsmart-api`. Without a key the assistant uses rule-based catalog answers and the page shows a notice saying so.

## Step 7. Start the API as a service

```bash
cd /opt/shopsmart
sudo cp deploy/shopsmart-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shopsmart-api
sudo systemctl status shopsmart-api --no-pager
sudo journalctl -u shopsmart-api -n 30 --no-pager
```

In the log, look for: `All migrations have been successfully applied.` (or `No pending migrations`), `Database was empty. Added 6 sample products.` and `ShopSmart API running at http://127.0.0.1:3000`.

```bash
curl -s http://127.0.0.1:3000/api/health/ready      # {"status":"ok","database":"ok"}

# Migration history (evidence for the deployment plan): both 0_init and 1_add_users_sessions_order_owner applied
sudo -u shopsmart bash -c 'set -a; source /etc/shopsmart/api.env; set +a; cd /opt/shopsmart/backend && /opt/shopsmart/node_modules/.bin/prisma migrate status' > ~/aws-migrate-status.txt 2>&1; tail -2 ~/aws-migrate-status.txt
```

Save it in your home folder, not `/tmp`, because `/tmp` is emptied when the server reboots. Copy it to your PC later with `scp` (Step 10). It contains no secrets.

Create the two **fictional** test customers (Ana and Ben). The password is printed **once**. Save it privately (not in Git, not in a screenshot):

```bash
sudo -u shopsmart bash -c 'set -a; source /etc/shopsmart/api.env; set +a; cd /opt/shopsmart/backend && node prisma/create-demo-customers.js'
```

## Step 8. Turn on HTTPS with Caddy

```bash
cd /opt/shopsmart
sed "s/SHOPSMART_HOST/${SITE_HOST}/" deploy/Caddyfile | sudo tee /etc/caddy/Caddyfile > /dev/null
sudo caddy validate --config /etc/caddy/Caddyfile
# validate runs as root and creates the access log owned by root. Give the folder back to Caddy
# AFTER validating, or the reload fails with "open /var/log/caddy/shopsmart-access.log: permission denied".
sudo mkdir -p /var/log/caddy && sudo chown -R caddy:caddy /var/log/caddy
sudo systemctl restart caddy
sudo journalctl -u caddy -n 40 --no-pager | grep -iE "certificate obtained|error"
```

Open `https://<SITE_HOST>` in a browser. The padlock should show a valid certificate.

**If the certificate fails** (the log says `rateLimited` or `NXDOMAIN`):
- Plan B: use `nip.io` instead, which has the same idea with dots: `SITE_HOST=<PUBLIC_IP>.nip.io`, then redo Step 8 and change `FRONTEND_URL` in `/etc/shopsmart/api.env` (`sudo systemctl restart shopsmart-api`).
- Plan C: put Amazon CloudFront in front of the instance (CloudFront gives an `https://…cloudfront.net` address). Ask before doing this: it is more settings.
- Plan D (allowed by the guide): present a tested **local** release and explain what must change before going online. **Never** ask testers to sign in over plain HTTP.

## Step 9. Verify the hosted version

On **your own PC**, in the project folder (Node 22 is already installed):

```powershell
$env:DEMO_PASSWORD="<the demo password from Step 7>"   # the real SERVER password, not this text
node deploy/smoke-test.mjs https://<SITE_HOST> --out docs/release-evidence/aws-smoke-test.json
Remove-Item Env:DEMO_PASSWORD
```

Every line must say `PASS`. The script checks the home page, a direct React route, `/api/health`, `/api/health/ready`, HTTPS redirect, CORS, products, guest/owner/other-customer order access, invalid and excess quantity, stock, assistant grounding and "no match", and sign-out. The sign-in limit is 10 attempts per 15 minutes, so wait if you run it more than 3 times in a row.

Then do the **browser checks** in a fresh Incognito window and take the screenshots listed in `AWS_VERIFICATION.md`.

## Step 10. Restart test and logs

```bash
sudo reboot
```

Wait 1–2 minutes, then from your PC (inside the project folder) run the smoke test again with `--out docs/release-evidence/aws-smoke-after-reboot.json`.
Sign in as Ana in the browser: **My Orders still shows the order from Step 9** (data survived the restart).

Back on the server:

```bash
sudo journalctl -u shopsmart-api -b --no-pager | tail -20      # started automatically after boot
# Logs must not contain secrets:
sudo journalctl -u shopsmart-api --no-pager | grep -iE "postgresql://|password=|AIza|GEMINI_API_KEY" && echo "SECRET FOUND IN LOG" || echo "OK: no secrets in API log"
```

Save the log and copy both evidence files to your PC:

```bash
sudo journalctl -u shopsmart-api -b --no-pager | tail -20 > ~/aws-api-log-after-reboot.txt
```
```powershell
scp -i $HOME\.ssh\shopsmart-key.pem "ubuntu@<PUBLIC_IP>:~/aws-*.txt" docs/release-evidence/
```
Read them before committing. They hold request lines only (method, path, status, time).

## Step 11. Updating the code later

```bash
cd /opt/shopsmart
sudo bash deploy/backup-db.sh                 # copy of the database before any change
git fetch --tags && git checkout <new-tag>
npm ci --include=dev && npm run db:generate
VITE_API_URL=/api npm run build --workspace frontend
sudo systemctl restart shopsmart-api          # runs "prisma migrate deploy" before starting
```

**Never** run `npm run db:migrate` (`prisma migrate dev`) or `npm run db:seed` on the server. `db:seed` deletes every order.

## Step 12. Clean up after grading (stops credit use)

1. EC2 → Instances → `shopsmart-demo` → **Terminate**. (Check that the root volume has "Delete on termination = Yes"; then the disk and the database are deleted with it.)
2. EC2 → Security Groups → delete `shopsmart-web-sg`. Key Pairs → delete `shopsmart-key`, and delete the `.pem` file.
3. Check EC2 → **Volumes**, **Snapshots** and **Elastic IPs** have nothing left from ShopSmart in ap-southeast-2. Leave the SAM10 `libralink-server` resources alone; they belong to another project.
4. Delete the Gemini staging key if you made one.
5. A day later, open Billing and confirm nothing is still using credits. Update `AWS_RESOURCE_REGISTER.md` with the removal date.

**Public IP note:** a *reboot* keeps the same public IP. A *stop then start* gives a new one, which changes `<SITE_HOST>`. If that happens, redo Step 8 with the new host and update `FRONTEND_URL`. No rebuild is needed, because the bundle only contains `/api`.
