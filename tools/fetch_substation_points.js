// tools/fetch_substation_points.js
import fs from "fs";
import https from "https";
import path from "path";

const BBOX = "20.0,118.0,50.0,156.0";

const QUERY = `
[out:json][timeout:180];
(
  node["power"="substation"](${BBOX});
  way["power"="substation"](${BBOX});
  node["landuse"="substation"](${BBOX});
  way["landuse"="substation"](${BBOX});
  node["building"="transformer_substation"](${BBOX});
  way["building"="transformer_substation"](${BBOX});
);
out center;
`;

const OVERPASS_ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",       // #1 安定
  "https://overpass-api.osm.ch/api/interpreter",         // #2 高速
  "https://lz4.overpass-api.de/api/interpreter"          // #3 代替
];

const OUTPUT_PATH = path.resolve("data/power/osm/substations_points.geojson");

function fetchOverpass(endpoint, query) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 200000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (body.startsWith("<?xml") || body.startsWith("<!DOCTYPE")) {
            return reject(new Error("XML response (likely Overpass error)"));
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(query);
    req.end();
  });
}

async function main() {
  console.log("[fetch_substation_points] START");

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Trying: ${endpoint}`);
      const data = await fetchOverpass(endpoint, QUERY);

      const features = [];
      for (const el of data.elements) {
        let lon = null;
        let lat = null;

        if (el.type === "node") {
          lon = el.lon;
          lat = el.lat;
        } else if (el.type === "way" && el.center) {
          lon = el.center.lon;
          lat = el.center.lat;
        }
        if (lon == null || lat == null) continue;

        features.push({
          type: "Feature",
          properties: { ...el.tags, id: el.id },
          geometry: { type: "Point", coordinates: [lon, lat] },
        });
      }

      const fc = { type: "FeatureCollection", features };
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fc, null, 2));

      console.log(
        `[fetch_substation_points] SUCCESS via ${endpoint} → ${features.length} features`
      );
      return; // 完全成功 → 終了
    } catch (err) {
      console.error(`Failed at ${endpoint}: ${err.message}`);
    }
  }

  console.error("[fetch_substation_points] All endpoints failed.");
}

main();
