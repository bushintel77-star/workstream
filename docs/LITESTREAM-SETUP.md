# Litestream backup setup

Workstream still stores production state in `/repo/apps/api/data/store.json` on the Fly volume. Use Litestream only as a disaster-recovery replica until the SQLite/Postgres migration lands.

## Cloudflare R2

1. Create a bucket named `workstream-dr` in Cloudflare R2.
2. Go to R2 → Manage R2 API tokens → Create API token.
3. Grant Object Read & Write for the `workstream-dr` bucket.
4. Copy the Access Key ID, Secret Access Key, and S3 endpoint.

```bash
flyctl secrets set \
  LITESTREAM_BUCKET="workstream-dr" \
  LITESTREAM_REGION="auto" \
  LITESTREAM_S3_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com" \
  LITESTREAM_ACCESS_KEY_ID="PASTE_HERE" \
  LITESTREAM_SECRET_ACCESS_KEY="PASTE_HERE" \
  -a construct-api
```

## Backblaze B2

1. Create a private bucket named `workstream-dr`.
2. Create an application key with read/write access to that bucket.
3. Use the S3-compatible endpoint for the bucket region.

```bash
flyctl secrets set \
  LITESTREAM_BUCKET="workstream-dr" \
  LITESTREAM_REGION="us-west-004" \
  LITESTREAM_S3_ENDPOINT="https://s3.us-west-004.backblazeb2.com" \
  LITESTREAM_ACCESS_KEY_ID="PASTE_HERE" \
  LITESTREAM_SECRET_ACCESS_KEY="PASTE_HERE" \
  -a construct-api
```

## Fly sidecar config

Add this process to `apps/api/fly.toml` only after the secrets above exist:

```toml
[processes]
  app = "node dist/server.js"
  worker = "node dist/worker.js"
  litestream = "litestream replicate -config /repo/docs/litestream.example.yml"
```

Then scale one sidecar beside the single API machine:

```bash
flyctl scale count app=1 worker=1 litestream=1 -a construct-api
```

## Verify restore metadata

```bash
flyctl ssh console -a construct-api -C \
  "litestream replicas -config /repo/docs/litestream.example.yml"
```

Expect one replica for `/repo/apps/api/data/store.json`. If it is empty, check the bucket credentials and Fly logs before relying on the backup.

