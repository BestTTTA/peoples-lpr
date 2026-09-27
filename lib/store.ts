import "server-only";
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import type { Plate, Report } from "./types";

// Reports live in Postgres, photos and plate crops in MinIO (S3 API).
// Both are the peoples_lpr database / peoples-lpr bucket on the spark server.

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// One pool per server process; survive dev hot reloads.
const g = globalThis as unknown as { lprPool?: Pool; lprS3?: S3Client; lprSchema?: Promise<void> };

function pool(): Pool {
  g.lprPool ??= new Pool({ connectionString: env("DATABASE_URL"), max: 5 });
  return g.lprPool;
}

function s3(): S3Client {
  g.lprS3 ??= new S3Client({
    endpoint: env("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true, // MinIO serves buckets as paths, not subdomains
    credentials: { accessKeyId: env("S3_ACCESS_KEY"), secretAccessKey: env("S3_SECRET_KEY") },
  });
  return g.lprS3;
}

const bucket = () => env("S3_BUCKET");

/** Idempotent schema setup, run once per process before the first query. */
function ready(): Promise<void> {
  g.lprSchema ??= pool()
    .query(
      `CREATE TABLE IF NOT EXISTS reports (
         id          uuid PRIMARY KEY,
         created_at  timestamptz NOT NULL,
         lat         double precision NOT NULL,
         lng         double precision NOT NULL,
         place       text NOT NULL DEFAULT '',
         note        text NOT NULL DEFAULT '',
         contact     text NOT NULL DEFAULT '',
         photos      text[] NOT NULL
       );
       CREATE TABLE IF NOT EXISTS plates (
         id         uuid PRIMARY KEY,
         report_id  uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
         position   int  NOT NULL,
         prefix     text NOT NULL,
         number     text NOT NULL,
         province   text NOT NULL,
         crop       text NOT NULL,
         photo      int  NOT NULL
       );
       CREATE INDEX IF NOT EXISTS plates_report_idx ON plates (report_id);
       CREATE INDEX IF NOT EXISTS plates_lookup_idx ON plates (province, prefix, number);`,
    )
    .then(() => undefined)
    .catch((err) => {
      g.lprSchema = undefined; // retry on the next request
      throw err;
    });
  return g.lprSchema;
}

type Row = {
  id: string;
  created_at: Date;
  lat: number;
  lng: number;
  place: string;
  note: string;
  contact: string;
  photos: string[];
  plates: (Plate & { position: number })[] | null;
};

export async function listReports(): Promise<Report[]> {
  await ready();
  const { rows } = await pool().query<Row>(
    `SELECT r.*,
            (SELECT json_agg(json_build_object(
                      'id', p.id, 'prefix', p.prefix, 'number', p.number, 'province', p.province,
                      'crop', p.crop, 'photo', p.photo, 'position', p.position) ORDER BY p.position)
               FROM plates p WHERE p.report_id = r.id) AS plates
       FROM reports r
      ORDER BY r.created_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at.toISOString(),
    lat: r.lat,
    lng: r.lng,
    place: r.place,
    note: r.note,
    contact: r.contact,
    photos: r.photos,
    plates: (r.plates ?? []).map((p) => ({
      id: p.id,
      prefix: p.prefix,
      number: p.number,
      province: p.province,
      crop: p.crop,
      photo: p.photo,
    })),
  }));
}

export async function addReport(report: Report): Promise<void> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO reports (id, created_at, lat, lng, place, note, contact, photos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [report.id, report.createdAt, report.lat, report.lng, report.place ?? "", report.note, report.contact, report.photos],
    );
    for (const [i, p] of report.plates.entries())
      await client.query(
        `INSERT INTO plates (id, report_id, position, prefix, number, province, crop, photo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [p.id, report.id, i, p.prefix, p.number, p.province, p.crop, p.photo],
      );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function saveFile(name: string, data: Uint8Array): Promise<void> {
  await s3().send(
    new PutObjectCommand({ Bucket: bucket(), Key: name, Body: data, ContentType: "image/jpeg" }),
  );
}

/** Image bytes for /api/files, or null if there is no such object. */
export async function getFile(name: string): Promise<Uint8Array | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: name }));
    return res.Body ? await res.Body.transformToByteArray() : null;
  } catch (err) {
    if (err instanceof NoSuchKey) return null;
    throw err;
  }
}
