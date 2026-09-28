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
