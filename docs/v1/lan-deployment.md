# LAN deployment runbook

## Outcome and boundaries

This runbook deploys GRD Dashboard to `debian-vm` at
`https://192.168.100.83`. Caddy, the API, PostgreSQL, migrations, and the optional
worker are declared in `docker-compose.lan.yml`. The frontend and API share one
HTTPS origin. Only ports 80 and 443 bind to the LAN address; PostgreSQL and API
port 3000 remain private.

Images are built and tested locally, saved to one archive, and copied to the host.
The populated environment file is also copied directly and must remain mode 600.
There is no registry, automatic deploy, public DNS, or automatic backup job.

## 1. Complete local acceptance

From the frontend repository:

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm test:acceptance
```

Do not deploy when this command fails. The container check creates a disposable
PostgreSQL volume, runs all migrations, verifies the HTTPS SPA/API boundary, checks
that the worker is absent, and inspects the final frontend image for source,
fixtures, backend code, and known secrets.

## 2. Create the release environment and images

Choose a monotonically increasing release such as `20261017-01`. The generator
copies only the carrier/runtime keys from `../grd-dashboard-be/.env`, including the
three Amazon SP-API production credentials and the two myUnishippers credentials,
generates new database and authentication secrets, refuses to overwrite an
existing file, and writes mode 600:

```sh
pnpm env:lan --release 20261017-01 --ip 192.168.100.83
docker build --tag grd-dashboard-be:20261017-01 ../grd-dashboard-be
docker build \
  --build-arg VITE_API_ORIGIN=https://192.168.100.83 \
  --build-arg VITE_GOOGLE_PLACES_API_KEY \
  --tag grd-dashboard-fe:20261017-01 \
  .
docker pull postgres:18.3-alpine
docker compose --env-file .env.lan -f docker-compose.lan.yml config --quiet
```

Never print, source in a shared shell, or commit `.env.lan`. Changing
`VITE_API_ORIGIN` or `VITE_GOOGLE_PLACES_API_KEY` requires rebuilding the frontend
image. Set `VITE_GOOGLE_PLACES_API_KEY` in the local frontend environment before
the build; the value is public browser configuration, but do not print it or commit it.

### Optional HTTP-only LAN mode

HTTPS is the default. If a trusted, isolated LAN cannot install the Caddy root
certificate, use the explicit insecure override below. It sends passwords and
session cookies in cleartext, switches the API to development cookie mode, and
must never be exposed outside that private network. Do not combine it with the
HTTPS environment file or Compose file.

```sh
pnpm env:lan --scheme http --release 20261017-02 --ip 192.168.100.83 --output .env.lan-http
docker build --tag grd-dashboard-be:20261017-02 ../grd-dashboard-be
docker build \
  --build-arg VITE_API_ORIGIN=http://192.168.100.83 \
  --build-arg VITE_GOOGLE_PLACES_API_KEY \
  --build-arg CADDYFILE=Caddyfile.http \
  --tag grd-dashboard-fe:http-20261017-02 \
  .
docker compose --env-file .env.lan-http \
  -f docker-compose.lan.yml -f docker-compose.lan-http.yml config --quiet
```

When reusing an existing PostgreSQL volume, preserve the current
`GRD_DB_PASSWORD` and `GRD_AUTH_SECRET` values in the remote environment. The
generator creates fresh random values for a fresh database; replacing the
database password while retaining an initialized volume prevents migrations and
the API from authenticating.

Transfer `.env.lan-http`, `docker-compose.lan.yml`, `docker-compose.lan-http.yml`,
and the image archive. On the host, use both Compose files for every command:

```sh
docker compose --env-file .env -f docker-compose.lan.yml \
  -f docker-compose.lan-http.yml up -d --wait frontend
curl --fail http://192.168.100.83/healthz
curl --fail http://192.168.100.83/api/v1/health/ready
```

The HTTP override publishes only port 80 and deliberately does not generate or
require a CA certificate. Switch back to the default HTTPS stack before sharing
the service beyond a trusted isolated LAN.

## 3. Package and transfer

```sh
docker save \
  grd-dashboard-be:20261017-01 \
  grd-dashboard-fe:20261017-01 \
  postgres:18.3-alpine \
  | gzip > /tmp/grd-dashboard-20261017-01.tar.gz
sha256sum /tmp/grd-dashboard-20261017-01.tar.gz

ssh -F /home/jeff/.ssh/config debian-vm \
  'install -d -m 700 /home/jeff/app/grd-dashboard'
scp -F /home/jeff/.ssh/config \
  /tmp/grd-dashboard-20261017-01.tar.gz \
  docker-compose.lan.yml \
  debian-vm:/home/jeff/app/grd-dashboard/
scp -F /home/jeff/.ssh/config \
  .env.lan \
  debian-vm:/home/jeff/app/grd-dashboard/.env
ssh -F /home/jeff/.ssh/config debian-vm \
  'chmod 600 /home/jeff/app/grd-dashboard/.env'
```

Compare the archive checksum on both machines before loading it.

## 4. First start without the worker

On `debian-vm`:

```sh
cd /home/jeff/app/grd-dashboard
gzip --decompress --stdout grd-dashboard-20261017-01.tar.gz | docker load
docker compose --env-file .env -f docker-compose.lan.yml config --quiet
docker compose --env-file .env -f docker-compose.lan.yml up -d --wait frontend
docker compose --env-file .env -f docker-compose.lan.yml ps
curl --fail --insecure https://192.168.100.83/healthz
curl --fail --insecure https://192.168.100.83/api/v1/health/ready
```

`migrate` must finish successfully; `db`, `api`, and `frontend` must be healthy;
and `worker` must not appear. The first deployment uses a fresh named PostgreSQL
volume and does not import the Raspberry Pi SQLite database.

## 5. Trust Caddy and bootstrap the Admin

Export the LAN CA certificate without exposing any private key:

```sh
docker compose --env-file .env -f docker-compose.lan.yml \
  cp frontend:/data/caddy/pki/authorities/local/root.crt ./grd-dashboard-root.crt
```

Copy `grd-dashboard-root.crt` to each approved LAN client and install it in that
client's trust store. Verify its fingerprint out of band before trusting it. Then
open `https://192.168.100.83` without bypassing a browser warning. The root
certificate fingerprint for release `20261017-01` is
`EE:34:4F:79:10:76:3A:F5:17:AC:22:F1:9A:21:AF:D7:9F:3C:75:8D:44:09:49:34:0C:32:14:3A:83:1E:BB:33`.

For Debian/Ubuntu clients, install it into the system trust store and restart
the browser:

```sh
sudo install -m 0644 grd-dashboard-root.crt \
  /usr/local/share/ca-certificates/grd-dashboard-root.crt
sudo update-ca-certificates
```

Firefox may use its own certificate store. Import the file under Settings →
Privacy & Security → Certificates → View Certificates → Authorities, enable
trust for websites, and restart Firefox. On Windows, import the file into
Trusted Root Certification Authorities; on macOS, add it to the System keychain
and mark it trusted for SSL. A client can verify the installation with:

```sh
curl --fail --cacert grd-dashboard-root.crt https://192.168.100.83/healthz
```

Create the first Admin interactively; the CLI does not accept password arguments:

```sh
docker compose --env-file .env -f docker-compose.lan.yml \
  exec api node dist/auth-cli.js bootstrap
```

Sign in, replace the issued password as prompted, and review all three carrier
records. Disable any carrier that is not ready. Do not put credentials in shell
history, documentation, screenshots, or logs.

## 6. Start exactly one worker

After carrier settings and provider credentials are confirmed:

```sh
docker compose --env-file .env -f docker-compose.lan.yml \
  --profile worker up -d worker
docker compose --env-file .env -f docker-compose.lan.yml ps
```

The Compose model declares one worker replica. Do not run a second worker process
or a second copy of this Compose project.

## Operations

Inspect health and logs:

```sh
docker compose --env-file .env -f docker-compose.lan.yml ps
docker compose --env-file .env -f docker-compose.lan.yml logs --tail 200 api frontend worker
curl --fail https://192.168.100.83/healthz
curl --fail https://192.168.100.83/api/v1/health/ready
```

Create a manual, mode-600 database backup before every upgrade and after material
configuration changes:

```sh
install -d -m 700 backups
umask 077
docker compose --env-file .env -f docker-compose.lan.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/grd-dashboard-$(date +%Y%m%d-%H%M%S).dump"
```

Copy backups off the VM and periodically prove restoration into a disposable
database. Compose volume deletion is never part of a normal upgrade. Application
rollback means loading a previously retained archive and restoring its image tags
in `.env`; a database rollback requires a compatible migration plan or a tested
backup restore, not merely an older application image.
