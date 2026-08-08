# Litestream backup setup

Workstream still persists to `/repo/apps/api/data/store.json` on a single API
instance. Litestream replicates SQLite WAL files, not arbitrary JSON snapshots,
so this is a SQLite-ready disaster-recovery configuration for the planned
SQLite migration. Do not enable the sidecar until the API writes
`/repo/apps/api/data/workstream.sqlite`.

## Cloudflare R2

1. Open Cloudflare Dashboard → R2 → Create bucket.
2. Bucket name: `workstream-dr`.
3. Create an R2 API token with object read/write access to that bucket.
4. Copy:
   - Account ID
   - Access key ID
   - Secret access key
   - S3 endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

Set on the API Railway service (`api-production-a8ff1`):

```
LITESTREAM_BUCKET=workstream-dr
LITESTREAM_S3_ENDPOINT=https://PASTE_ACCOUNT_ID.r2.cloudflarestorage.com
LITESTREAM_S3_REGION=auto
LITESTREAM_ACCESS_KEY_ID=PASTE_R2_ACCESS_KEY_ID
LITESTREAM_SECRET_ACCESS_KEY=PASTE_R2_SECRET_ACCESS_KEY
```

## Backblaze B2

1. Open Backblaze → B2 Cloud Storage → Create bucket.
2. Bucket name: `workstream-dr`.
3. Create an application key scoped to the bucket with read/write access.
4. Copy:
   - Key ID
   - Application key
   - S3 endpoint for the bucket region, for example `https://s3.us-west-004.backblazeb2.com`
   - Region, for example `us-west-004`

Set on the API Railway service:

```
LITESTREAM_BUCKET=workstream-dr
LITESTREAM_S3_ENDPOINT=https://s3.PASTE_REGION.backblazeb2.com
LITESTREAM_S3_REGION=PASTE_REGION
LITESTREAM_ACCESS_KEY_ID=PASTE_B2_KEY_ID
LITESTREAM_SECRET_ACCESS_KEY=PASTE_B2_APPLICATION_KEY
```

## Railway backup process wiring

Copy `docs/litestream.example.yml` into the API image as
`/etc/litestream.yml`, install the Litestream binary in `apps/api/Dockerfile`,
then run a backup process that runs beside the API after SQLite is live. On
Railway, run Litestream as a separate service (or as a worker process within
the API service) sharing the API image, with entrypoint:

```
litestream replicate -config /etc/litestream.yml
```

Verify replication by tailing the backup service logs in the Railway dashboard
and expecting Litestream replication messages. A one-off restore probe:

```bash
litestream restore -config docs/litestream.example.yml -if-replica-exists /tmp/workstream.sqlite
```

Do not scale the API above one instance while JSON snapshot persistence is
active. Keep the API service replica count at 1 until the SQLite migration
lands.
