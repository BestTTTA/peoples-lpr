import "server-only";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import type { ExtraBox } from "./boxes";
import type { Plate, Report } from "./types";

// Reports live in Postgres, photos and plate crops in MinIO (S3 API).
// Both are the peoples_lpr database / peoples-lpr bucket on the spark server.

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// One pool per server process; survive dev hot reloads. (Bump the schema key
// when ready() gains tables, so a running dev server runs it again.)
const g = globalThis as unknown as { lprPool?: Pool; lprS3?: S3Client; lprSchemaV3?: Promise<void> };

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
  g.lprSchemaV3 ??= pool()
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
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS box jsonb;
       ALTER TABLE reports ADD COLUMN IF NOT EXISTS extra_boxes jsonb NOT NULL DEFAULT '[]';
       CREATE INDEX IF NOT EXISTS plates_lookup_idx ON plates (province, prefix, number);
       CREATE TABLE IF NOT EXISTS settings (
         key         text PRIMARY KEY,
         value       jsonb NOT NULL,
         updated_at  timestamptz NOT NULL DEFAULT now()
       );`,
    )
    .then(() => undefined)
    .catch((err) => {
      g.lprSchemaV3 = undefined; // retry on the next request
      throw err;
    });
  return g.lprSchemaV3;
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
  extra_boxes: ExtraBox[] | null;
  plates: (Plate & { position: number })[] | null;
};

export async function listReports(): Promise<Report[]> {
  await ready();
  const { rows } = await pool().query<Row>(
    `SELECT r.*,
            (SELECT json_agg(json_build_object(
                      'id', p.id, 'prefix', p.prefix, 'number', p.number, 'province', p.province,
                      'crop', p.crop, 'photo', p.photo, 'box', p.box, 'position', p.position) ORDER BY p.position)
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
    extraBoxes: r.extra_boxes ?? [],
    plates: (r.plates ?? []).map((p) => ({
      id: p.id,
      prefix: p.prefix,
      number: p.number,
      province: p.province,
      crop: p.crop,
      photo: p.photo,
      box: p.box ?? null,
    })),
  }));
}

export async function addReport(report: Report): Promise<void> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO reports (id, created_at, lat, lng, place, note, contact, photos, extra_boxes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        report.id,
        report.createdAt,
        report.lat,
        report.lng,
        report.place ?? "",
        report.note,
        report.contact,
        report.photos,
        JSON.stringify(report.extraBoxes ?? []),
      ],
    );
    for (const [i, p] of report.plates.entries())
      await client.query(
        `INSERT INTO plates (id, report_id, position, prefix, number, province, crop, photo, box)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [p.id, report.id, i, p.prefix, p.number, p.province, p.crop, p.photo, p.box ? JSON.stringify(p.box) : null],
      );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// One request per file: this MinIO release rejects the SDK's batch delete
// (DeleteObjects without Content-MD5, which current SDKs no longer send).
async function deleteFiles(names: string[]): Promise<void> {
  const results = await Promise.allSettled(
    names.map((Key) => s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key }))),
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) throw new Error(`${failed.length}/${names.length} file deletes failed: ${(failed[0] as PromiseRejectedResult).reason}`);
}

/** Move a report's pin (and its place name). False if there was no such report. */
export async function updateReportLocation(id: string, lat: number, lng: number, place: string): Promise<boolean> {
  await ready();
  const { rowCount } = await pool().query("UPDATE reports SET lat = $2, lng = $3, place = $4 WHERE id = $1", [
    id,
    lat,
    lng,
    place,
  ]);
  return (rowCount ?? 0) > 0;
}

/** Remove a report, its plates and all its files. False if there was no such report. */
export async function deleteReport(id: string): Promise<boolean> {
  await ready();
  const client = await pool().connect();
  let files: string[];
  try {
    await client.query("BEGIN");
    const r = await client.query<{ photos: string[] }>("SELECT photos FROM reports WHERE id = $1 FOR UPDATE", [id]);
    if (!r.rows.length) {
      await client.query("ROLLBACK");
      return false;
    }
    const p = await client.query<{ crop: string }>("SELECT crop FROM plates WHERE report_id = $1", [id]);
    await client.query("DELETE FROM reports WHERE id = $1", [id]); // plates go by ON DELETE CASCADE
    await client.query("COMMIT");
    files = [...r.rows[0].photos, ...p.rows.map((x) => x.crop)];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  // Rows first: a failed file delete leaves an orphan file, never a report with a missing photo.
  await deleteFiles(files).catch((err) => console.error("delete files", err));
  return true;
}

/**
 * Remove one plate from a report (a single wrong reading among many). Removing
 * the last plate removes the report. Returns what happened.
 */
export async function deletePlate(reportId: string, plateId: string): Promise<"plate" | "report" | "missing"> {
  await ready();
  const client = await pool().connect();
  let crop: string;
  try {
    await client.query("BEGIN");
    const del = await client.query<{ crop: string }>(
      "DELETE FROM plates WHERE id = $1 AND report_id = $2 RETURNING crop",
      [plateId, reportId],
    );
    if (!del.rows.length) {
      await client.query("ROLLBACK");
      return "missing";
    }
    crop = del.rows[0].crop;
    const left = await client.query("SELECT 1 FROM plates WHERE report_id = $1 LIMIT 1", [reportId]);
    await client.query("COMMIT");
    if (!left.rows.length) {
      await deleteReport(reportId);
      await deleteFiles([crop]).catch(() => {});
      return "report";
    }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await deleteFiles([crop]).catch((err) => console.error("delete files", err));
  return "plate";
}

export async function saveFile(name: string, data: Uint8Array, contentType = "image/jpeg"): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: name, Body: data, ContentType: contentType }));
}

export async function removeFile(name: string): Promise<void> {
  await deleteFiles([name]);
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

/** A saved setting (admin page), or null if never set. */
export async function getSetting<T>(key: string): Promise<T | null> {
  await ready();
  const { rows } = await pool().query<{ value: T }>("SELECT value FROM settings WHERE key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await ready();
  await pool().query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}
