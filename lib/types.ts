import type { ExtraBox, StoredBox } from "./boxes";

export type PlateText = {
  prefix: string;
  number: string;
  province: string;
  raw?: string;
};

export type PlateStatus = "ACTIVE" | "OWNER_RECEIVED" | "NOT_FOUND_AT_LOCATION";

export type Plate = {
  id: string;
  /** Leading part: optional digit + 1–2 Thai letters, e.g. "กพ", "3ฒน". */
  prefix: string;
  /** Trailing 1–4 digits. */
  number: string;
  province: string;
  /** Cropped plate image file name under /api/files. */
  crop: string;
  /** Index into Report.photos of the photo this crop came from. */
  photo: number;
  /** Where in that photo (training data); null for reports from before it was kept. */
  box?: StoredBox | null;
  /** Raw OCR output before the finder reviewed or edited it; absent for manual/older reports. */
  aiDetected?: PlateText | null;
  /** The finder-reviewed value first stored with the report, before any later public correction. */
  original?: PlateText;
  /** Set when prefix/number/province above comes from a later correction. */
  correctedAt?: string | null;
  /** Availability after an admin-reviewed update request. */
  status?: PlateStatus;
};

export type Report = {
  id: string;
  createdAt: string;
  lat: number;
  lng: number;
  /** Reverse-geocoded place name for the pin; "" if lookup failed. */
  place?: string;
  /** Where the plates are now / how to collect them. */
  note: string;
  contact: string;
  photos: string[];
  plates: Plate[];
  /** AI boxes the finder deleted and plates boxed but left out (training data). */
  extraBoxes?: ExtraBox[];
};

/** What the public map and dashboard get: plate text, but no photos and no contact. */
export type PublicReport = {
  id: string;
  createdAt: string;
  lat: number;
  lng: number;
  place: string;
  plates: { prefix: string; number: string; province: string }[];
};

export type SearchHit = {
  report: Pick<Report, "id" | "createdAt" | "lat" | "lng" | "place" | "note" | "contact" | "photos">;
  plate: Plate;
};

export type OcrResult = {
  plate_number: string;
  province: string;
  plate_confidence: number;
  province_confidence: number;
};

/** Owner's "ฝากตามหา" that matches a plate on a finder's new report. The
 * finder sees this once, on their success screen, so the owner can be
 * contacted directly. Not public. */
export type WatchMatch = {
  id: string;
  name: string;
  phone: string;
  prefix: string;
  number: string;
  province: string;
  /** When the owner filed the request, so the finder can tell a fresh one from a stale one. */
  since: string;
  /** Which plate in the just-submitted report this match is for. */
  plateIndex: number;
};
