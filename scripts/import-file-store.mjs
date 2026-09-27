// One-off: move reports from the old flat-file store (data/reports.json + data/files/)
// into Postgres + MinIO. Safe to re-run: reports already in the database are skipped.
//
//   npm run tunnel                                   # in another terminal
//   node --env-file=.env.local scripts/import-file-store.mjs
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import pg from "pg";

const reports = JSON.parse(await readFile("data/reports.json", "utf8"));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});
const Bucket = process.env.S3_BUCKET;

async function upload(name) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key: name }));
    return; // already there
  } catch {}
  const Body = await readFile(`data/files/${name}`);
  await s3.send(new PutObjectCommand({ Bucket, Key: name, Body, ContentType: "image/jpeg" }));
}

await db.connect();
for (const r of reports) {
  const { rowCount } = await db.query("SELECT 1 FROM reports WHERE id = $1", [r.id]);
  if (rowCount) {
    console.log(`skip ${r.id} (already imported)`);
    continue;
  }
  for (const name of [...r.photos, ...r.plates.map((p) => p.crop)]) await upload(name);
  await db.query("BEGIN");
  await db.query(
    `INSERT INTO reports (id, created_at, lat, lng, place, note, contact, photos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [r.id, r.createdAt, r.lat, r.lng, r.place ?? "", r.note, r.contact, r.photos],
  );
  for (const [i, p] of r.plates.entries())
    await db.query(
      `INSERT INTO plates (id, report_id, position, prefix, number, province, crop, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [p.id, r.id, i, p.prefix, p.number, p.province, p.crop, p.photo],
    );
  await db.query("COMMIT");
  console.log(`imported ${r.id}: ${r.plates.length} plates, ${r.photos.length} photos`);
}
await db.end();
