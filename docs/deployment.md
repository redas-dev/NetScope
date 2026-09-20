# Deploy NetScope to Ubuntu or Debian

This setup runs the API and PostgreSQL with Docker Compose and exposes the API through **Nginx installed on the Ubuntu/Debian host** at `https://api.example.com`. Certbot manages HTTPS certificates. After setup, a push to `main` runs the integration tests in GitHub Actions and deploys that exact commit if they pass. Pull requests only run tests.

The production files are prepared in this repository. They have not been deployed to your server. Replace the example hostname and IP with your own values.

## 1. Prepare the server and domain

Install Docker Engine with the Compose plugin using the official instructions for [Ubuntu](https://docs.docker.com/engine/install/ubuntu/) or [Debian](https://docs.docker.com/engine/install/debian/). You do not need Docker Desktop, .NET or Node.js on the server; .NET builds inside Docker.

Install the remaining command-line tools:

```bash
sudo apt update
sudo apt install -y git curl openssl util-linux
sudo systemctl enable --now docker
```

Create a dedicated deployment account and project directory:

```bash
sudo adduser --disabled-password --gecos '' deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/netscope
sudo chown deploy:deploy /opt/netscope
sudo -iu deploy
docker compose version
```

The `deploy` account needs Docker access; Docker group membership effectively grants administrative access to this host. Keep its SSH keys private.

Point an **A record** such as `api.example.com` to the server's public IPv4 address. Only add an AAAA record if the server also has working public IPv6. Allow inbound TCP **80 and 443**, plus your existing SSH port, in your server/provider firewall. For a home server, forward 80 and 443 from the router as well. This workflow requires the SSH address to be reachable from GitHub-hosted runners.

Nginx owns host ports 80/443 and proxies requests to `127.0.0.1:5220`. Certbot's Nginx plugin obtains the certificate after DNS points to this server; HTTP validation requires public port 80. See [Certbot's Nginx instructions](https://certbot.eff.org/instructions?os=snap&ws=nginx). The setup script below uses the Ubuntu/Debian packages and their `certbot.timer` for renewal. Existing Nginx sites can coexist under other hostnames. If another web server occupies 80/443, resolve that conflict before running the setup script.

## 2. Allow the server to read the GitHub repository

As the server's `deploy` user, create a **read-only repository key**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N '' -C 'netscope-server-repository'
cat ~/.ssh/id_ed25519.pub
```

If this user already has that key, use its existing key or choose another filename and configure `~/.ssh/config`; do not overwrite it.

On GitHub, open `redas-dev/NetScope` → **Settings → Deploy keys → Add deploy key**. Paste the public key. Leave **Allow write access** unchecked. Connect once from the server:

```bash
ssh -T git@github.com
```

Verify GitHub's host-key fingerprint against [GitHub's published fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints) before accepting it. GitHub's successful authentication message says it does not provide shell access; that is expected.

Commit and push the production files from your development computer first. Then, on the server:

```bash
git clone git@github.com:redas-dev/NetScope.git /opt/netscope
cd /opt/netscope
git switch main
```

This key lets **the server read GitHub**. The separate key in step 5 lets **GitHub Actions connect to the server**.

## 3. Create server secrets and start NetScope

Inside `/opt/netscope`:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32
openssl rand -hex 48
nano .env.production
```

Set `DOMAIN` to your real hostname (without `https://` or a path). Set `POSTGRES_PASSWORD` to the first generated value and `JWT_KEY` to the second. The hex password avoids special-character escaping in the database connection string. These values stay on the server and are ignored by Git. Do not regenerate them during updates.

Run the initial deployment:

```bash
bash scripts/deploy.sh "$(git rev-parse HEAD)"
```

The script builds the API image, starts PostgreSQL, takes a database backup, starts the API, and checks API/database health. EF migrations apply automatically when the API starts. The initial database is empty: Production mode never creates the public demo accounts.

### Configure Nginx and HTTPS once

From an account with sudo access (your server administrator account, not necessarily `deploy`):

```bash
cd /opt/netscope
sudo bash scripts/setup-nginx.sh api.example.com you@example.com
sudo certbot renew --dry-run
```

Use the same hostname as `DOMAIN` in `.env.production` and your certificate contact email. The script installs Nginx and Certbot, creates `/etc/nginx/sites-available/netscope`, enables the site, validates the configuration, and obtains a Let's Encrypt certificate. Certbot modifies the site to enable HTTPS and redirect HTTP to HTTPS. Its systemd timer handles renewal, and the Nginx plugin reloads renewed certificates.

The script preserves an existing NetScope site for the same domain, including Certbot's HTTPS configuration, so it can be rerun after fixing a failed certificate request. It refuses to overwrite a site for another domain. It does not modify other virtual hosts. Inspect `sudo systemctl status certbot.timer` to confirm renewal is scheduled.

If migrating from the earlier Caddy setup, first deploy this version: `deploy.sh` removes the old Compose `proxy` container using `--remove-orphans`, freeing ports 80/443. Then run `setup-nginx.sh`. The old Caddy volumes are left on disk; PostgreSQL's volume remains the same. HTTPS will be briefly unavailable between removing Caddy and configuring Nginx.

Verify:

```bash
curl --fail http://127.0.0.1:5220/health
curl --fail https://api.example.com/health
```

The first checks the API/database. The second also checks public DNS, networking and TLS. The deployment workflow uses the internal check, so verify the public URL during initial setup.

Only host Nginx is publicly exposed. The API's diagnostic HTTP port binds to `127.0.0.1`; PostgreSQL has no published port. Nginx replaces client-supplied forwarding headers and forwards the original HTTPS scheme; forwarded-header handling is enabled only in the production Compose configuration. See [Nginx proxy header documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## 4. Create your first administrator

Register your account through `POST https://api.example.com/api/auth/register` using Postman and your own email/password. Registration always creates a User account.

On the server, promote that exact account once, replacing `you@example.com` with the lowercase registered email:

```bash
docker compose --env-file .env.production -f compose.production.yaml exec -T db \
  psql -U netscope -d netscope -v ON_ERROR_STOP=1 <<'SQL'
UPDATE "Users" SET "Role" = 'Admin'
WHERE "Email" = 'you@example.com'
RETURNING "Id", "Email", "Role";
SQL
```

Confirm one row was updated. Log in again to obtain a new JWT containing the Admin role; the previous User token will no longer authenticate. Create real locations, devices and clients through the API. The local demo collection expects demo accounts and should be run locally or in CI, not against this production database.

## 5. Enable deployment after a push

Generate a **different** SSH key on your development computer for GitHub Actions, for example:

```bash
ssh-keygen -t ed25519 -f netscope-actions -N '' -C 'netscope-github-actions'
```

Keep these key files outside the repository. Add the public key from `netscope-actions.pub` to `/home/deploy/.ssh/authorized_keys` on the server. A key line may be prefixed with `restrict ` to disable forwarding and interactive terminal allocation while allowing the deployment command. Set `.ssh` permissions to 700 and `authorized_keys` to 600, owned by `deploy`.

In GitHub → **Settings → Secrets and variables → Actions → Secrets**, add:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Public server hostname or IPv4 address; no protocol |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PORT` | SSH port, usually `22`; optional, defaults to 22 |
| `DEPLOY_SSH_KEY` | Entire private `netscope-actions` key, including BEGIN/END lines |
| `DEPLOY_KNOWN_HOSTS` | Verified server SSH host-key entry, as explained below |

Obtain your server's public SSH host key through your trusted server session or hosting console:

```bash
cat /etc/ssh/ssh_host_ed25519_key.pub
```

For port 22, the `DEPLOY_KNOWN_HOSTS` value is one line:

```text
YOUR_DEPLOY_HOST ssh-ed25519 AAAAC3...the-complete-public-key...
```

Use exactly the hostname/IP stored in `DEPLOY_HOST`. For a custom SSH port, the first field must be `[YOUR_DEPLOY_HOST]:PORT`. This is the **server host key**, not either of your login/deploy keys. The workflow validates it; it does not disable host verification.

Under the same settings, open **Variables** and add:

```text
DEPLOY_ENABLED = true
```

Deployment is disabled until this variable is set. GitHub's [secrets and deployment controls](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments) can also be extended with approval gates if desired.

Push your next change to `main`:

```bash
git add .
git commit -m "Update API"
git push origin main
```

The pipeline is:

```text
push to main → build + PostgreSQL integration tests
             → SSH to your server
             → fetch and check out the tested commit
             → build image + back up database
             → replace API container + apply migrations
             → health check
```

Failed tests prevent deployment. Deployment jobs are serialized, and commits superseded by a newer `main` commit are skipped. Follow progress and failures in the repository's **Actions** tab. A successful deployment prints the deployed commit and backup filename. There can be a short interruption while the single API container restarts; this is not a zero-downtime setup.

Nginx runs continuously on the host while the API is updated. The Actions deployment account does not need sudo access to Nginx. API updates need no Nginx restart because the upstream stays at `127.0.0.1:5220`. The committed Nginx file is an installation template: later changes to that template must be applied manually to the server site while preserving the HTTPS directives Certbot added, followed by `sudo nginx -t && sudo systemctl reload nginx`.

## Manual updates and operations

To deploy manually from the server:

```bash
cd /opt/netscope
git fetch origin main
bash scripts/deploy.sh "$(git rev-parse origin/main)"
```

The server checkout stays detached at the deployed commit. Do not edit tracked source files on the server: the deployment script refuses to overwrite local edits. Change code locally, push it, and keep server-specific settings in `.env.production`.

Useful commands from `/opt/netscope`:

```bash
# Show running services and recent API logs
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail=100 api

# Show reverse proxy status and errors (administrator account)
sudo nginx -t
sudo systemctl status nginx
sudo tail -n 100 /var/log/nginx/error.log
sudo systemctl status certbot.timer

# Show the last successfully deployed commit
cat .local/deployed-commit
```

PostgreSQL records live in the named `netscope-production_postgres-data` volume, independently of the API container. Normal deployments preserve them. **Do not use `docker compose down -v`** unless you deliberately want to remove the database. Nginx configuration is stored under `/etc/nginx` and certificates under `/etc/letsencrypt` on the host; neither depends on container replacement. Changing `POSTGRES_PASSWORD` in the env file alone does not change the password of an existing database.

Every deployment writes a compressed PostgreSQL backup under `backups/`. These contain application data: keep the directory private, periodically copy backups off the server, and manage retention according to available disk space. They remain on the same server until you arrange off-server storage. Database migrations must be reviewed before pushing changes that delete or transform data.

If a deployment fails, inspect the Actions output and API logs, fix the issue, then push a new commit. Older API images remain tagged by commit SHA. There is no automatic rollback because a new database migration may be incompatible with the previous API. If rollback is needed, coordinate the older image and schema restoration; restoring a backup loses writes made after that backup.

The composition follows [Docker's single-server production deployment approach](https://docs.docker.com/compose/how-tos/production/). Keep the Docker host and base images updated separately from application pushes.
