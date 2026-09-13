const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_TOKEN) {
  console.warn(
    "[reverseGeocode] MAPBOX_ACCESS_TOKEN is not set — place names will fall back to raw coordinates.",
  );
}

const cacheKey = (lat, lng) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

const placeNameCache = new Map();

async function fetchPlaceName(lat, lng) {
  if (!MAPBOX_TOKEN) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=poi,address,neighborhood,locality,place`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(
        `[reverseGeocode] Mapbox request failed: ${resp.status} ${resp.statusText}`,
      );
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    const data = await resp.json();
    const feature = data?.features?.[0];
    return (
      feature?.place_name ||
      feature?.text ||
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    );
  } catch (err) {
    console.error("[reverseGeocode] lookup error:", err.message);
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export async function getPlaceName(lat, lng) {
  const key = cacheKey(lat, lng);
  if (placeNameCache.has(key)) {
    const cached = placeNameCache.get(key);
    return cached instanceof Promise ? cached : cached;
  }
  const promise = fetchPlaceName(lat, lng);
  placeNameCache.set(key, promise);
  const resolved = await promise;
  placeNameCache.set(key, resolved);
  return resolved;
}

export async function getPlaceNamesForPoints(points, concurrency = 5) {
  const unique = new Map();
  for (const p of points) {
    const key = cacheKey(p.lat, p.lng);
    if (!unique.has(key)) unique.set(key, p);
  }
  const entries = Array.from(unique.entries());
  const results = new Map();

  let idx = 0;
  const worker = async () => {
    while (idx < entries.length) {
      const [key, p] = entries[idx++];
      const name = await getPlaceName(p.lat, p.lng);
      results.set(key, name);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, entries.length) }, worker),
  );

  return results;
}

export { cacheKey };
