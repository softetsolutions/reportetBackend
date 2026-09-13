import { getPlaceNamesForPoints, cacheKey } from "./Reversegeocode.js";

const ACTIVITIES = new Set(["still", "walking", "driving", "unknown"]);
export const STOP_MIN_SECONDS = 180;

export const normalizeActivity = (activity, speed) => {
  if (activity && ACTIVITIES.has(String(activity).toLowerCase())) {
    return String(activity).toLowerCase();
  }
  if (speed == null || Number.isNaN(Number(speed))) return "unknown";
  const s = Number(speed);
  if (s < 0.5) return "still";
  if (s < 2) return "walking";
  return "driving";
};

const titleForSegment = (activity, durationSeconds) => {
  if (activity === "still") {
    const mins = Math.max(1, Math.round(durationSeconds / 60));
    return `Stop (Still) for ${mins} min${mins === 1 ? "" : "s"}`;
  }
  if (activity === "walking") {
    const mins = Math.max(1, Math.round(durationSeconds / 60));
    return `Walking for ${mins} min${mins === 1 ? "" : "s"}`;
  }
  if (activity === "driving") return "Continued Journey";
  return "Moving";
};

const precisionLabel = (accuracyMeters) => {
  if (accuracyMeters == null) return null;
  if (accuracyMeters <= 10) return `High (±${Math.round(accuracyMeters)}m)`;
  if (accuracyMeters <= 30) return `Medium (±${Math.round(accuracyMeters)}m)`;
  return `Low (±${Math.round(accuracyMeters)}m)`;
};

/**
 * Build path + timeline + markers from ordered LocationPing lean docs
 * (location GeoJSON, speed, accuracy, activity, timestamp).
 */
export async function buildTripAnalysis({ points, trip, session }) {
  const path = points.map((p) => {
    const [lng, lat] = p.location.coordinates;
    const activity = normalizeActivity(p.activity, p.speed);
    return {
      lat,
      lng,
      timestamp: p.timestamp,
      activity,
      speed: p.speed ?? null,
      accuracy: p.accuracy ?? null,
    };
  });

  const segments = [];
  for (const p of path) {
    const last = segments[segments.length - 1];
    if (last && last.activity === p.activity) {
      last.points.push(p);
      last.endTime = p.timestamp;
    } else {
      segments.push({
        activity: p.activity,
        points: [p],
        startTime: p.timestamp,
        endTime: p.timestamp,
      });
    }
  }

  const enriched = segments.map((seg) => {
    const durationSeconds = Math.max(
      0,
      Math.round((new Date(seg.endTime) - new Date(seg.startTime)) / 1000),
    );
    const speeds = seg.points
      .map((p) => p.speed)
      .filter((s) => s != null && !Number.isNaN(Number(s)));
    const avgSpeedMs = speeds.length
      ? speeds.reduce((a, b) => a + Number(b), 0) / speeds.length
      : null;
    const first = seg.points[0];
    return {
      ...seg,
      durationSeconds,
      lat: first.lat,
      lng: first.lng,
      avgSpeedKmh:
        avgSpeedMs == null ? null : Math.round(avgSpeedMs * 3.6 * 10) / 10,
      accuracyMeters: first.accuracy,
    };
  });

  // strip accuracy from public path payload
  const publicPath = path.map(({ accuracy, ...rest }) => rest);

  const geocodeTargets = [];
  const startCoords =
    session?.startLocation?.coordinates ||
    trip?.startLocation?.coordinates ||
    (path[0] ? [path[0].lng, path[0].lat] : null);
  const endCoords =
    session?.endLocation?.coordinates ||
    trip?.endLocation?.coordinates ||
    (path.length ? [path[path.length - 1].lng, path[path.length - 1].lat] : null);

  if (startCoords) {
    geocodeTargets.push({ lat: startCoords[1], lng: startCoords[0], key: "start" });
  }
  if (endCoords) {
    geocodeTargets.push({ lat: endCoords[1], lng: endCoords[0], key: "end" });
  }

  const stopSegs = enriched.filter(
    (s) => s.activity === "still" && s.durationSeconds >= STOP_MIN_SECONDS,
  );
  for (const s of stopSegs) {
    geocodeTargets.push({ lat: s.lat, lng: s.lng });
  }
  for (const s of enriched) {
    geocodeTargets.push({ lat: s.lat, lng: s.lng });
  }

  const placeMap = await getPlaceNamesForPoints(
    geocodeTargets.map(({ lat, lng }) => ({ lat, lng })),
  );
  const placeOf = (lat, lng) => placeMap.get(cacheKey(lat, lng)) || null;

  const timeline = [];

  if (trip?.startTime || session?.startTime) {
    const startTime = trip?.startTime || session?.startTime;
    const lat = startCoords ? startCoords[1] : null;
    const lng = startCoords ? startCoords[0] : null;
    timeline.push({
      type: "started",
      activity: enriched[0]?.activity || "unknown",
      title: "Trip Started",
      placeName: lat != null ? placeOf(lat, lng) : null,
      startTime,
      endTime: null,
      durationSeconds: null,
      lat,
      lng,
      meta: {},
    });
  }

  for (const seg of enriched) {
    // Skip tiny unknown noise under 30s unless it's the only segment
    if (seg.durationSeconds < 30 && enriched.length > 1 && seg.activity === "unknown") {
      continue;
    }
    timeline.push({
      type: "segment",
      activity: seg.activity,
      title: titleForSegment(seg.activity, seg.durationSeconds),
      placeName: placeOf(seg.lat, seg.lng),
      startTime: seg.startTime,
      endTime: seg.endTime,
      durationSeconds: seg.durationSeconds,
      lat: seg.lat,
      lng: seg.lng,
      meta: {
        avgSpeedKmh: seg.avgSpeedKmh,
        accuracyMeters: seg.accuracyMeters,
        precisionLabel: precisionLabel(seg.accuracyMeters),
      },
    });
  }

  if (trip?.status === "completed" || session?.status === "completed") {
    const endTime = trip?.endTime || session?.endTime;
    const lat = endCoords ? endCoords[1] : null;
    const lng = endCoords ? endCoords[0] : null;
    timeline.push({
      type: "completed",
      activity: null,
      title: "Trip Completed",
      placeName: lat != null ? placeOf(lat, lng) : null,
      startTime: endTime,
      endTime: null,
      durationSeconds: null,
      lat,
      lng,
      meta: {},
    });
  }

  const markers = {
    start: startCoords
      ? {
          lat: startCoords[1],
          lng: startCoords[0],
          placeName: placeOf(startCoords[1], startCoords[0]),
        }
      : null,
    end: endCoords
      ? {
          lat: endCoords[1],
          lng: endCoords[0],
          placeName: placeOf(endCoords[1], endCoords[0]),
        }
      : null,
    stops: stopSegs.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      placeName: placeOf(s.lat, s.lng),
      durationSeconds: s.durationSeconds,
    })),
  };

  return { path: publicPath, timeline, markers };
}

export { precisionLabel };
