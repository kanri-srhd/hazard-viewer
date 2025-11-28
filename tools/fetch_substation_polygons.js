// tools/fetch_substation_polygons.js
// Fetch OSM substation AREA polygons (way + relation) for Japan.
// Output: data/power/osm/substation_polygons.geojson

import fs from "fs";
import https from "https";
import path from "path";

const BBOX = "20.0,118.0,50.0,156.0";

// OIM級の包括クエリ
const QUERY = `
[out:json][timeout:180];
(
  way["power"="substation"](${BBOX});
  relation["power"="substation"](${BBOX});

  way["substation"](${BBOX});
  relation["substation"](${BBOX});

  way["landuse"="power"](${BBOX});
  relation["landuse"="power"](${BBOX});

  way["landuse"="industrial"]["operator"](${BBOX});
  relation["landuse"="industrial"]["operator"](${BBOX});

  way["building"="transformer"](${BBOX});
  way["building"="transformer_substation"](${BBOX});
  relation["building"="transformer"](${BBOX});
  relation["building"="transformer_substation"](${BBOX});

  way["site"="power"](${BBOX});
  relation["site"="power"](${BBOX});
);
out geom;
`;

const OUTFILE = path.resolve("data/power/osm/substation_polygons.geojson");
const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.osm.ch/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter"
];

// ------ fetch ------
function fetchOverpass(endpoint, query) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 200000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (body.startsWith("<?xml") || body.startsWith("<!DOCTYPE")) {
            return reject(new Error("XML response"));
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(query);
    req.end();
  });
}

// ------ convert ------
function convert(osm) {
  const features = [];

  for (const el of osm.elements) {
    if (!["way", "relation"].includes(el.type)) continue;
    if (!el.geometry) continue;

    let geometry;

    if (el.type === "way") {
      const coords = el.geometry.map((p) => [p.lon, p.lat]);
      geometry = { type: "Polygon", coordinates: [coords] };
    } else if (el.type === "relation") {
      const outers = [];
      for (const m of el.members || []) {
        if (m.role !== "outer" || !m.geometry) continue;
        const coords = m.geometry.map((p) => [p.lon, p.lat]);
        outers.push([coords]);
      }
      if (outers.length === 1)
        geometry = { type: "Polygon", coordinates: outers[0] };
      else if (outers.length >= 2)
        geometry = { type: "MultiPolygon", coordinates: outers };
      else continue;
    }

    features.push({
      type: "Feature",
      properties: { ...el.tags, id: el.id },
      geometry,
    });
  }

  return { type: "FeatureCollection", features };
}

// ------ main ------
async function main() {
  console.log("[fetch_substation_polygons] START");

  for (const ep of ENDPOINTS) {
    try {
      console.log("Try:", ep);
      const osm = await fetchOverpass(ep, QUERY);
      const geo = convert(osm);

      fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
      fs.writeFileSync(OUTFILE, JSON.stringify(geo, null, 2));

      console.log(
        `[fetch_substation_polygons] SUCCESS via ${ep}, polygons=${geo.features.length}`
      );
      return;
    } catch (e) {
      console.error(`FAILED at ${ep}:`, e.message);
    }
  }

  console.error("[fetch_substation_polygons] All endpoints failed.");
}

main();
