// MapLibre v6 loads its web worker from a URL next to its own module, which
// the bundler can't see. Serve the worker (and the chunk it imports) from
// /public instead; lib/maps.ts points MapLibre at it with setWorkerUrl().
import { copyFileSync, mkdirSync } from "node:fs";

const src = "node_modules/maplibre-gl/dist";
const dest = "public/maplibre";
mkdirSync(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`${src}/${f}`, `${dest}/${f}`);
