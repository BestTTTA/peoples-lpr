import "server-only";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import type { ExtraBox } from "./boxes";
import type { Plate, PlateStatus, PlateText, Report } from "./types";

// Reports live in Postgres, photos and plate crops in MinIO (S3 API).
// Both are the peoples_lpr database / peoples-lpr bucket on the spark server.

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// One pool per server process; survive dev hot reloads. (Bump the schema key
// when ready() gains tables, so a running dev server runs it again.)
const g = globalThis as unknown as { lprPool?: Pool; lprS3?: S3Client; lprSchemaV8?: Promise<void> };

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
  g.lprSchemaV8 ??= pool()
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
       );
       CREATE TABLE IF NOT EXISTS watches (
         id          uuid PRIMARY KEY,
         token_hash  text NOT NULL,
         name        text NOT NULL,
         phone       text NOT NULL,
         prefix      text NOT NULL,
         number      text NOT NULL,
         province    text NOT NULL,
         consent_at  timestamptz NOT NULL,
         created_at  timestamptz NOT NULL DEFAULT now()
       );
       CREATE INDEX IF NOT EXISTS watches_lookup_idx ON watches (province, prefix, number);
       ALTER TABLE watches ADD COLUMN IF NOT EXISTS management_code_hash text;
       ALTER TABLE watches ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
       ALTER TABLE watches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
       ALTER TABLE watches ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
       ALTER TABLE watches ADD COLUMN IF NOT EXISTS request_id uuid;
       DO $$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conname = 'watches_status_check' AND conrelid = 'watches'::regclass
         ) THEN
           ALTER TABLE watches ADD CONSTRAINT watches_status_check CHECK (status IN ('ACTIVE', 'CANCELLED'));
         END IF;
       END $$;
       DROP INDEX IF EXISTS watches_active_management_code_uniq;
       CREATE UNIQUE INDEX IF NOT EXISTS watches_active_plate_management_code_uniq
         ON watches (province, prefix, number, management_code_hash)
         WHERE status = 'ACTIVE' AND management_code_hash IS NOT NULL;
       CREATE UNIQUE INDEX IF NOT EXISTS watches_request_id_uniq
         ON watches (request_id) WHERE request_id IS NOT NULL;
       CREATE INDEX IF NOT EXISTS watches_active_lookup_idx
         ON watches (province, prefix, number) WHERE status = 'ACTIVE';
       CREATE TABLE IF NOT EXISTS watch_code_reset_requests (
         id                           uuid PRIMARY KEY,
         watch_id                     uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
         request_id                   uuid NOT NULL UNIQUE,
         requester_name               text NOT NULL,
         requester_phone              text NOT NULL,
         current_management_code_hash text NOT NULL,
         requested_code_hash          text NOT NULL,
         review_status                text NOT NULL DEFAULT 'PENDING'
           CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
         created_at                   timestamptz NOT NULL DEFAULT now(),
         reviewed_at                  timestamptz,
         reviewed_by                  text,
         admin_note                   text NOT NULL DEFAULT ''
       );
       CREATE UNIQUE INDEX IF NOT EXISTS watch_code_reset_pending_uniq
         ON watch_code_reset_requests (watch_id) WHERE review_status = 'PENDING';
       CREATE INDEX IF NOT EXISTS watch_code_reset_review_idx
         ON watch_code_reset_requests (review_status, created_at DESC);
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS ai_prefix text;
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS ai_number text;
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS ai_province text;
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS ai_raw_plate text;
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS corrected_prefix text;
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS corrected_number text;
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS corrected_province text;
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS corrected_at timestamptz;
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
       ALTER TABLE plates ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;
       DO $$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conname = 'plates_status_check' AND conrelid = 'plates'::regclass
         ) THEN
           ALTER TABLE plates ADD CONSTRAINT plates_status_check
             CHECK (status IN ('ACTIVE', 'OWNER_RECEIVED', 'NOT_FOUND_AT_LOCATION'));
         END IF;
       END $$;
       CREATE TABLE IF NOT EXISTS plate_feedback (
         id            uuid PRIMARY KEY,
         plate_id      uuid NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
         feedback_type text NOT NULL CHECK (feedback_type IN ('OWNER_RECEIVED', 'NOT_FOUND_AT_LOCATION')),
         request_id    uuid NOT NULL UNIQUE,
         created_at    timestamptz NOT NULL DEFAULT now()
       );
       ALTER TABLE plate_feedback ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'PENDING';
       ALTER TABLE plate_feedback ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
       ALTER TABLE plate_feedback ADD COLUMN IF NOT EXISTS reviewed_by text;
       ALTER TABLE plate_feedback ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT '';
       DO $$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conname = 'plate_feedback_review_status_check' AND conrelid = 'plate_feedback'::regclass
         ) THEN
           ALTER TABLE plate_feedback ADD CONSTRAINT plate_feedback_review_status_check
             CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED'));
         END IF;
       END $$;
       CREATE INDEX IF NOT EXISTS plate_feedback_plate_idx ON plate_feedback (plate_id, created_at DESC);
       CREATE INDEX IF NOT EXISTS plate_feedback_review_idx ON plate_feedback (review_status, created_at DESC);
       CREATE TABLE IF NOT EXISTS plate_correction_requests (
         id                 uuid PRIMARY KEY,
         plate_id           uuid NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
         current_prefix     text NOT NULL,
         current_number     text NOT NULL,
         current_province   text NOT NULL,
         requested_prefix   text NOT NULL,
         requested_number   text NOT NULL,
         requested_province text NOT NULL,
         request_id         uuid NOT NULL UNIQUE,
         review_status      text NOT NULL DEFAULT 'PENDING'
           CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
         created_at         timestamptz NOT NULL DEFAULT now(),
         reviewed_at        timestamptz,
         reviewed_by        text,
         admin_note         text NOT NULL DEFAULT ''
       );
       CREATE INDEX IF NOT EXISTS plate_correction_review_idx
         ON plate_correction_requests (review_status, created_at DESC);`,
    )
    .then(() => undefined)
    .catch((err) => {
      g.lprSchemaV8 = undefined; // retry on the next request
      throw err;
    });
  return g.lprSchemaV8;
}

type StoredPlateRow = Plate & {
  position: number;
  originalPrefix: string;
  originalNumber: string;
  originalProvince: string;
  aiPrefix: string | null;
  aiNumber: string | null;
  aiProvince: string | null;
  aiRawPlate: string | null;
  correctedAt: string | null;
  status: PlateStatus;
};

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
  plates: StoredPlateRow[] | null;
};

export async function listReports(includeInactive = false): Promise<Report[]> {
  await ready();
  const { rows } = await pool().query<Row>(
    `SELECT r.*,
            (SELECT json_agg(json_build_object(
                      'id', p.id,
                      'prefix', COALESCE(p.corrected_prefix, p.prefix),
                      'number', COALESCE(p.corrected_number, p.number),
                      'province', COALESCE(p.corrected_province, p.province),
                      'originalPrefix', p.prefix, 'originalNumber', p.number, 'originalProvince', p.province,
                      'aiPrefix', p.ai_prefix, 'aiNumber', p.ai_number, 'aiProvince', p.ai_province,
                      'aiRawPlate', p.ai_raw_plate,
                      'correctedAt', p.corrected_at,
                      'status', p.status,
                      'crop', p.crop, 'photo', p.photo, 'box', p.box, 'position', p.position) ORDER BY p.position)
               FROM plates p
              WHERE p.report_id = r.id AND ($1 OR p.status = 'ACTIVE')) AS plates
       FROM reports r
      WHERE $1 OR EXISTS (SELECT 1 FROM plates p WHERE p.report_id = r.id AND p.status = 'ACTIVE')
      ORDER BY r.created_at DESC`,
    [includeInactive],
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
      original: { prefix: p.originalPrefix, number: p.originalNumber, province: p.originalProvince },
      aiDetected:
        p.aiPrefix !== null || p.aiNumber !== null || p.aiProvince !== null || p.aiRawPlate !== null
          ? { prefix: p.aiPrefix ?? "", number: p.aiNumber ?? "", province: p.aiProvince ?? "", raw: p.aiRawPlate ?? undefined }
          : null,
      correctedAt: p.correctedAt,
      status: p.status,
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
        `INSERT INTO plates
           (id, report_id, position, prefix, number, province, crop, photo, box, ai_prefix, ai_number, ai_province, ai_raw_plate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          p.id,
          report.id,
          i,
          p.prefix,
          p.number,
          p.province,
          p.crop,
          p.photo,
          p.box ? JSON.stringify(p.box) : null,
          p.aiDetected?.prefix ?? null,
          p.aiDetected?.number ?? null,
          p.aiDetected?.province ?? null,
          p.aiDetected?.raw ?? null,
        ],
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

// --- "ฝากตามหา" (watches): owners register a plate + phone, and get a match
// notification only when a finder reports that exact plate. Nothing from this
// table is served publicly — the only readers are the match query at submit
// time and the owner-side DELETE guarded by their token.

export type WatchInput = {
  name: string;
  phone: string;
  prefix: string;
  number: string;
  province: string;
};

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type WatchMatch = {
  id: string;
  name: string;
  phone: string;
  prefix: string;
  number: string;
  province: string;
  since: string;
  plateIndex: number; // position in the input plates list this watch matches
};

export async function addWatchRecord(
  id: string,
  tokenHash: string,
  managementCodeHash: string,
  requestId: string,
  input: WatchInput,
  consentAt: string,
): Promise<void> {
  await ready();
  await pool().query(
    `INSERT INTO watches
       (id, token_hash, management_code_hash, request_id, name, phone, prefix, number, province, consent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, tokenHash, managementCodeHash, requestId, input.name, input.phone, input.prefix, input.number, input.province, consentAt],
  );
}

export async function removeWatchRecord(id: string, tokenHash: string): Promise<boolean> {
  await ready();
  const { rowCount } = await pool().query(
    `UPDATE watches
        SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
      WHERE id = $1 AND token_hash = $2 AND status = 'ACTIVE'`,
    [id, tokenHash],
  );
  return (rowCount ?? 0) > 0;
}

export type ManagedWatch = WatchInput & { id: string; createdAt: string };

export async function getManagedWatch(lookup: Pick<WatchInput, "prefix" | "number" | "province">, codeHash: string): Promise<ManagedWatch | null> {
  await ready();
  const { rows } = await pool().query<{
    id: string;
    name: string;
    phone: string;
    prefix: string;
    number: string;
    province: string;
    created_at: Date;
  }>(
    `SELECT id, name, phone, prefix, number, province, created_at
       FROM watches
      WHERE prefix = $1 AND number = $2 AND province = $3
        AND management_code_hash = $4 AND status = 'ACTIVE'
      LIMIT 1`,
    [lookup.prefix, lookup.number, lookup.province, codeHash],
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        phone: row.phone,
        prefix: row.prefix,
        number: row.number,
        province: row.province,
        createdAt: row.created_at.toISOString(),
      }
    : null;
}

export async function updateManagedWatch(
  lookup: Pick<WatchInput, "prefix" | "number" | "province">,
  codeHash: string,
  input: WatchInput,
): Promise<ManagedWatch | null> {
  await ready();
  const { rows } = await pool().query<{
    id: string;
    name: string;
    phone: string;
    prefix: string;
    number: string;
    province: string;
    created_at: Date;
  }>(
    `UPDATE watches
        SET name = $5, phone = $6, prefix = $7, number = $8, province = $9, updated_at = now()
      WHERE prefix = $1 AND number = $2 AND province = $3
        AND management_code_hash = $4 AND status = 'ACTIVE'
      RETURNING id, name, phone, prefix, number, province, created_at`,
    [lookup.prefix, lookup.number, lookup.province, codeHash, input.name, input.phone, input.prefix, input.number, input.province],
  );
  const row = rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        phone: row.phone,
        prefix: row.prefix,
        number: row.number,
        province: row.province,
        createdAt: row.created_at.toISOString(),
      }
    : null;
}

export async function cancelManagedWatch(
  lookup: Pick<WatchInput, "prefix" | "number" | "province">,
  codeHash: string,
): Promise<boolean> {
  await ready();
  const { rowCount } = await pool().query(
    `UPDATE watches
        SET status = 'CANCELLED', cancelled_at = now(), updated_at = now()
      WHERE prefix = $1 AND number = $2 AND province = $3
        AND management_code_hash = $4 AND status = 'ACTIVE'`,
    [lookup.prefix, lookup.number, lookup.province, codeHash],
  );
  return (rowCount ?? 0) > 0;
}

export type SubmitWatchCodeResetResult = "missing" | "pending" | "saved";

export async function addWatchCodeResetRequest(
  id: string,
  requestId: string,
  lookup: Pick<WatchInput, "prefix" | "number" | "province">,
  requesterName: string,
  requesterPhone: string,
  requestedCodeHash: string,
): Promise<SubmitWatchCodeResetResult> {
  await ready();
  const match = await pool().query<{ id: string; management_code_hash: string }>(
    `SELECT id, management_code_hash
       FROM watches
      WHERE prefix = $1 AND number = $2 AND province = $3
        AND phone = $4 AND status = 'ACTIVE' AND management_code_hash IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [lookup.prefix, lookup.number, lookup.province, requesterPhone],
  );
  const watch = match.rows[0];
  if (!watch) return "missing";

  const { rows } = await pool().query<{ id: string }>(
    `INSERT INTO watch_code_reset_requests
       (id, watch_id, request_id, requester_name, requester_phone,
        current_management_code_hash, requested_code_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [id, watch.id, requestId, requesterName, requesterPhone, watch.management_code_hash, requestedCodeHash],
  );
  if (rows.length) return "saved";
  const existing = await pool().query(
    `SELECT 1 FROM watch_code_reset_requests
      WHERE watch_id = $1 AND review_status = 'PENDING'`,
    [watch.id],
  );
  return existing.rows.length ? "pending" : "saved";
}

export type WatchCodeResetRequest = {
  id: string;
  watchId: string;
  name: string;
  phone: string;
  requesterName: string;
  requesterPhone: string;
  prefix: string;
  number: string;
  province: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string;
};

export async function listWatchCodeResetRequests(status: ReviewStatus): Promise<{
  requests: WatchCodeResetRequest[];
  stats: { pending: number; approved: number; rejected: number };
}> {
  await ready();
  const { rows } = await pool().query<{
    id: string;
    watch_id: string;
    name: string;
    phone: string;
    requester_name: string;
    requester_phone: string;
    prefix: string;
    number: string;
    province: string;
    review_status: ReviewStatus;
    created_at: Date;
    reviewed_at: Date | null;
    admin_note: string;
  }>(
    `SELECT r.id, r.watch_id, w.name, w.phone, r.requester_name, r.requester_phone,
            w.prefix, w.number, w.province, r.review_status, r.created_at,
            r.reviewed_at, r.admin_note
       FROM watch_code_reset_requests r
       JOIN watches w ON w.id = r.watch_id
      WHERE r.review_status = $1
      ORDER BY r.created_at DESC
      LIMIT 200`,
    [status],
  );
  const stats = await pool().query<{ pending: number; approved: number; rejected: number }>(
    `SELECT
       count(*) FILTER (WHERE review_status = 'PENDING')::int AS pending,
       count(*) FILTER (WHERE review_status = 'APPROVED')::int AS approved,
       count(*) FILTER (WHERE review_status = 'REJECTED')::int AS rejected
       FROM watch_code_reset_requests`,
  );
  return {
    requests: rows.map((row) => ({
      id: row.id,
      watchId: row.watch_id,
      name: row.name,
      phone: row.phone,
      requesterName: row.requester_name,
      requesterPhone: row.requester_phone,
      prefix: row.prefix,
      number: row.number,
      province: row.province,
      reviewStatus: row.review_status,
      createdAt: row.created_at.toISOString(),
      reviewedAt: row.reviewed_at?.toISOString() ?? null,
      adminNote: row.admin_note,
    })),
    stats: stats.rows[0] ?? { pending: 0, approved: 0, rejected: 0 },
  };
}

export type ReviewWatchCodeResetResult = "missing" | "already-reviewed" | "stale" | "ok";

export async function reviewWatchCodeResetRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
  adminNote: string,
): Promise<ReviewWatchCodeResetResult> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      watch_id: string;
      review_status: ReviewStatus;
      current_management_code_hash: string;
      requested_code_hash: string;
      watch_status: string;
      live_management_code_hash: string | null;
    }>(
      `SELECT r.watch_id, r.review_status, r.current_management_code_hash,
              r.requested_code_hash, w.status AS watch_status,
              w.management_code_hash AS live_management_code_hash
         FROM watch_code_reset_requests r
         JOIN watches w ON w.id = r.watch_id
        WHERE r.id = $1
        FOR UPDATE OF r, w`,
      [id],
    );
    const request = rows[0];
    if (!request) {
      await client.query("ROLLBACK");
      return "missing";
    }
    if (request.review_status !== "PENDING") {
      await client.query("ROLLBACK");
      return "already-reviewed";
    }
    if (decision === "APPROVED") {
      if (
        request.watch_status !== "ACTIVE" ||
        request.live_management_code_hash !== request.current_management_code_hash
      ) {
        await client.query("ROLLBACK");
        return "stale";
      }
      await client.query(
        `UPDATE watches
            SET management_code_hash = $2, updated_at = now()
          WHERE id = $1`,
        [request.watch_id, request.requested_code_hash],
      );
    }
    await client.query(
      `UPDATE watch_code_reset_requests
          SET review_status = $2, reviewed_at = now(), reviewed_by = 'admin', admin_note = $3
        WHERE id = $1`,
      [id, decision, adminNote],
    );
    await client.query("COMMIT");
    return "ok";
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Watches matching any plate in the list, strict prefix+number+province. */
export async function listWatchMatches(
  plates: { prefix: string; number: string; province: string }[],
): Promise<WatchMatch[]> {
  if (plates.length === 0) return [];
  await ready();
  const { rows } = await pool().query<{
    id: string;
    name: string;
    phone: string;
    prefix: string;
    number: string;
    province: string;
    created_at: Date;
  }>(
    `SELECT id, name, phone, prefix, number, province, created_at
       FROM watches
      WHERE status = 'ACTIVE'
        AND (province, prefix, number) IN (${plates.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(", ")})`,
    plates.flatMap((p) => [p.province, p.prefix, p.number]),
  );
  return rows.map((r) => {
    const idx = plates.findIndex(
      (p) => p.prefix === r.prefix && p.number === r.number && p.province === r.province,
    );
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      prefix: r.prefix,
      number: r.number,
      province: r.province,
      since: r.created_at.toISOString(),
      plateIndex: idx,
    };
  });
}

export type PlateFeedbackType = "OWNER_RECEIVED" | "NOT_FOUND_AT_LOCATION";

/** Queue anonymous feedback idempotently for admin review. */
export async function addPlateFeedback(
  id: string,
  plateId: string,
  feedbackType: PlateFeedbackType,
  requestId: string,
): Promise<boolean> {
  await ready();
  const { rows } = await pool().query<{ plate_id: string }>(
    `INSERT INTO plate_feedback (id, plate_id, feedback_type, request_id)
     SELECT $1, id, $3, $4 FROM plates WHERE id = $2 AND status = 'ACTIVE'
     ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
     RETURNING plate_id`,
    [id, plateId, feedbackType, requestId],
  );
  return rows[0]?.plate_id === plateId;
}

export type SubmitCorrectionResult = "missing" | "conflict" | "saved";

/** Queue a correction only when the submitted current value still matches the plate. */
export async function addPlateCorrectionRequest(
  id: string,
  plateId: string,
  expected: PlateText,
  requested: PlateText,
  requestId: string,
): Promise<SubmitCorrectionResult> {
  await ready();
  const { rows } = await pool().query<{ plate_id: string }>(
    `INSERT INTO plate_correction_requests
       (id, plate_id, current_prefix, current_number, current_province,
        requested_prefix, requested_number, requested_province, request_id)
     SELECT $1, id, $3, $4, $5, $6, $7, $8, $9
       FROM plates
      WHERE id = $2 AND status = 'ACTIVE'
        AND COALESCE(corrected_prefix, prefix) = $3
        AND COALESCE(corrected_number, number) = $4
        AND COALESCE(corrected_province, province) = $5
     ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
     RETURNING plate_id`,
    [id, plateId, expected.prefix, expected.number, expected.province, requested.prefix, requested.number, requested.province, requestId],
  );
  if (rows[0]?.plate_id === plateId) return "saved";
  const exists = await pool().query("SELECT 1 FROM plates WHERE id = $1", [plateId]);
  if (!exists.rows.length) return "missing";
  return "conflict";
}

export type PlateRequestKind = "FEEDBACK" | "CORRECTION";

export type PlateReviewRequest = {
  id: string;
  kind: PlateRequestKind;
  plateId: string;
  crop: string;
  place: string;
  current: PlateText;
  original: PlateText;
  aiDetected: PlateText | null;
  requested: PlateText | null;
  feedbackType: PlateFeedbackType | null;
  reviewStatus: ReviewStatus;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string;
};

type ReviewRow = {
  id: string;
  kind: PlateRequestKind;
  plate_id: string;
  crop: string;
  place: string;
  current_prefix: string;
  current_number: string;
  current_province: string;
  original_prefix: string;
  original_number: string;
  original_province: string;
  ai_prefix: string | null;
  ai_number: string | null;
  ai_province: string | null;
  ai_raw_plate: string | null;
  requested_prefix: string | null;
  requested_number: string | null;
  requested_province: string | null;
  feedback_type: PlateFeedbackType | null;
  review_status: ReviewStatus;
  created_at: Date;
  reviewed_at: Date | null;
  admin_note: string;
};

const mapReviewRow = (row: ReviewRow): PlateReviewRequest => ({
  id: row.id,
  kind: row.kind,
  plateId: row.plate_id,
  crop: row.crop,
  place: row.place,
  current: { prefix: row.current_prefix, number: row.current_number, province: row.current_province },
  original: { prefix: row.original_prefix, number: row.original_number, province: row.original_province },
  aiDetected:
    row.ai_prefix !== null || row.ai_number !== null || row.ai_province !== null || row.ai_raw_plate !== null
      ? {
          prefix: row.ai_prefix ?? "",
          number: row.ai_number ?? "",
          province: row.ai_province ?? "",
          raw: row.ai_raw_plate ?? undefined,
        }
      : null,
  requested:
    row.requested_prefix !== null && row.requested_number !== null && row.requested_province !== null
      ? { prefix: row.requested_prefix, number: row.requested_number, province: row.requested_province }
      : null,
  feedbackType: row.feedback_type,
  reviewStatus: row.review_status,
  createdAt: row.created_at.toISOString(),
  reviewedAt: row.reviewed_at?.toISOString() ?? null,
  adminNote: row.admin_note,
});

export type PlateRequestStats = {
  pending: number;
  approved: number;
  rejected: number;
  ownerReceived: number;
  notFoundAtLocation: number;
};

export async function listPlateReviewRequests(status: ReviewStatus): Promise<{ requests: PlateReviewRequest[]; stats: PlateRequestStats }> {
  await ready();
  const { rows } = await pool().query<ReviewRow>(
    `SELECT f.id, 'FEEDBACK'::text AS kind, f.plate_id, p.crop, r.place,
            COALESCE(p.corrected_prefix, p.prefix) AS current_prefix,
            COALESCE(p.corrected_number, p.number) AS current_number,
            COALESCE(p.corrected_province, p.province) AS current_province,
            p.prefix AS original_prefix, p.number AS original_number, p.province AS original_province,
            p.ai_prefix, p.ai_number, p.ai_province, p.ai_raw_plate,
            NULL::text AS requested_prefix, NULL::text AS requested_number, NULL::text AS requested_province,
            f.feedback_type, f.review_status, f.created_at, f.reviewed_at, f.admin_note
       FROM plate_feedback f
       JOIN plates p ON p.id = f.plate_id
       JOIN reports r ON r.id = p.report_id
      WHERE f.review_status = $1
      UNION ALL
     SELECT c.id, 'CORRECTION'::text AS kind, c.plate_id, p.crop, r.place,
            COALESCE(p.corrected_prefix, p.prefix), COALESCE(p.corrected_number, p.number),
            COALESCE(p.corrected_province, p.province),
            p.prefix, p.number, p.province, p.ai_prefix, p.ai_number, p.ai_province, p.ai_raw_plate,
            c.requested_prefix, c.requested_number, c.requested_province,
            NULL::text, c.review_status, c.created_at, c.reviewed_at, c.admin_note
       FROM plate_correction_requests c
       JOIN plates p ON p.id = c.plate_id
       JOIN reports r ON r.id = p.report_id
      WHERE c.review_status = $1
      ORDER BY created_at DESC
      LIMIT 200`,
    [status],
  );
  const statsResult = await pool().query<PlateRequestStats>(
    `SELECT
       ((SELECT count(*) FROM plate_feedback WHERE review_status = 'PENDING') +
        (SELECT count(*) FROM plate_correction_requests WHERE review_status = 'PENDING'))::int AS pending,
       ((SELECT count(*) FROM plate_feedback WHERE review_status = 'APPROVED') +
        (SELECT count(*) FROM plate_correction_requests WHERE review_status = 'APPROVED'))::int AS approved,
       ((SELECT count(*) FROM plate_feedback WHERE review_status = 'REJECTED') +
        (SELECT count(*) FROM plate_correction_requests WHERE review_status = 'REJECTED'))::int AS rejected,
       (SELECT count(*)::int FROM plates WHERE status = 'OWNER_RECEIVED') AS "ownerReceived",
       (SELECT count(*)::int FROM plates WHERE status = 'NOT_FOUND_AT_LOCATION') AS "notFoundAtLocation"`,
  );
  return { requests: rows.map(mapReviewRow), stats: statsResult.rows[0] };
}

export type ReviewDecision = "APPROVED" | "REJECTED";
export type ReviewPlateRequestResult = "missing" | "already-reviewed" | "stale" | "ok";

export async function reviewPlateRequest(
  kind: PlateRequestKind,
  id: string,
  decision: ReviewDecision,
  adminNote: string,
): Promise<ReviewPlateRequestResult> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    if (kind === "FEEDBACK") {
      const { rows } = await client.query<{
        review_status: ReviewStatus;
        feedback_type: PlateFeedbackType;
        plate_id: string;
        plate_status: PlateStatus;
      }>(
        `SELECT f.review_status, f.feedback_type, f.plate_id, p.status AS plate_status
           FROM plate_feedback f JOIN plates p ON p.id = f.plate_id
          WHERE f.id = $1 FOR UPDATE OF f, p`,
        [id],
      );
      const request = rows[0];
      if (!request) {
        await client.query("ROLLBACK");
        return "missing";
      }
      if (request.review_status !== "PENDING") {
        await client.query("ROLLBACK");
        return "already-reviewed";
      }
      if (decision === "APPROVED") {
        if (request.plate_status !== "ACTIVE" && request.plate_status !== request.feedback_type) {
          await client.query("ROLLBACK");
          return "stale";
        }
        await client.query("UPDATE plates SET status = $2, status_updated_at = now() WHERE id = $1", [
          request.plate_id,
          request.feedback_type,
        ]);
      }
      await client.query(
        `UPDATE plate_feedback
            SET review_status = $2, reviewed_at = now(), reviewed_by = 'admin', admin_note = $3
          WHERE id = $1`,
        [id, decision, adminNote],
      );
    } else {
      const { rows } = await client.query<{
        review_status: ReviewStatus;
        plate_id: string;
        current_prefix: string;
        current_number: string;
        current_province: string;
        requested_prefix: string;
        requested_number: string;
        requested_province: string;
        live_prefix: string;
        live_number: string;
        live_province: string;
        plate_status: PlateStatus;
      }>(
        `SELECT c.*, COALESCE(p.corrected_prefix, p.prefix) AS live_prefix,
                COALESCE(p.corrected_number, p.number) AS live_number,
                COALESCE(p.corrected_province, p.province) AS live_province,
                p.status AS plate_status
           FROM plate_correction_requests c JOIN plates p ON p.id = c.plate_id
          WHERE c.id = $1 FOR UPDATE OF c, p`,
        [id],
      );
      const request = rows[0];
      if (!request) {
        await client.query("ROLLBACK");
        return "missing";
      }
      if (request.review_status !== "PENDING") {
        await client.query("ROLLBACK");
        return "already-reviewed";
      }
      if (decision === "APPROVED") {
        if (
          request.plate_status !== "ACTIVE" ||
          request.live_prefix !== request.current_prefix ||
          request.live_number !== request.current_number ||
          request.live_province !== request.current_province
        ) {
          await client.query("ROLLBACK");
          return "stale";
        }
        await client.query(
          `UPDATE plates
              SET corrected_prefix = $2, corrected_number = $3, corrected_province = $4, corrected_at = now()
            WHERE id = $1`,
          [request.plate_id, request.requested_prefix, request.requested_number, request.requested_province],
        );
      }
      await client.query(
        `UPDATE plate_correction_requests
            SET review_status = $2, reviewed_at = now(), reviewed_by = 'admin', admin_note = $3
          WHERE id = $1`,
        [id, decision, adminNote],
      );
    }
    await client.query("COMMIT");
    return "ok";
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
