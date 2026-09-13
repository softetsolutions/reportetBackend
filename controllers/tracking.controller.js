import mongoose from "mongoose";
import TrackingSession from "../models/TrackingSession.js";
import LocationPing from "../models/LocationPing.js";
import LiveLocation from "../models/LiveLocation.js";
import Trip from "../models/Trip.js";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";
import { getDistance } from "geolib";
import { todayKey, isValidDateKey } from "../utils/trackingDate.js";
import {
  normalizeActivity,
  buildTripAnalysis,
} from "../utils/tripTimeline.js";

const STALE_MS = 5 * 60 * 1000;
const JITTER_THRESHOLD_METERS = 5;

const sseClients = new Map();

const addClient = (organizationId, res, employeeId = null) => {
  const key = organizationId.toString();
  if (!sseClients.has(key)) sseClients.set(key, new Set());
  const entry = { res, employeeId: employeeId?.toString() || null };
  sseClients.get(key).add(entry);
  return entry;
};

const removeClient = (organizationId, entry) => {
  sseClients.get(organizationId.toString())?.delete(entry);
};

const sseWrite = (res, event, data) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

const broadcastLiveLocation = (organizationId, employeeId, event, data) => {
  const clients = sseClients.get(organizationId.toString());
  if (!clients) return;
  for (const { res, employeeId: scopedTo } of clients) {
    if (!scopedTo || scopedTo === employeeId.toString()) {
      sseWrite(res, event, data);
    }
  }
};

const isValidCoord = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const getTrackingFlags = async (organizationId, employeeId) => {
  const [org, employee] = await Promise.all([
    Organization.findById(organizationId).select("liveTrackingEnabled").lean(),
    Employee.findById(employeeId).select("liveTrackingEnabled").lean(),
  ]);
  const orgLiveTrackingEnabled = !!org?.liveTrackingEnabled;
  const employeeLiveTrackingEnabled = !!employee?.liveTrackingEnabled;
  return {
    orgLiveTrackingEnabled,
    employeeLiveTrackingEnabled,
    liveTrackingEnabled: orgLiveTrackingEnabled && employeeLiveTrackingEnabled,
  };
};

const assertEmployeeTrackingAllowed = async (organizationId, employeeId) => {
  const flags = await getTrackingFlags(organizationId, employeeId);
  if (!flags.orgLiveTrackingEnabled) {
    return {
      ok: false,
      status: 403,
      message: "Live tracking is not open yet. Wait for admin.",
      flags,
    };
  }
  if (!flags.employeeLiveTrackingEnabled) {
    return {
      ok: false,
      status: 403,
      message: "Live tracking is disabled for this employee.",
      flags,
    };
  }
  return { ok: true, flags };
};

export const startTracking = async (req, res) => {
  try {
    if (!req.employee) {
      return res
        .status(403)
        .json({ message: "Only MR devices can start tracking" });
    }
    const employeeId = req.employee._id;
    const organizationId = req.employee.organizationId;
    const { latitude, longitude } = req.body || {};

    if (!isValidCoord(latitude, longitude)) {
      return res
        .status(400)
        .json({ message: "latitude and longitude are required" });
    }

    const allowed = await assertEmployeeTrackingAllowed(
      organizationId,
      employeeId,
    );
    if (!allowed.ok) {
      return res.status(allowed.status).json({ message: allowed.message });
    }

    const date = todayKey();
    const now = new Date();
    const coords = [Number(longitude), Number(latitude)];

    const existing = await TrackingSession.findOne({ employeeId, date });
    if (existing) {
      if (existing.status === "active") {
        return res
          .status(200)
          .json({ message: "Session already active", session: existing });
      }
      return res
        .status(409)
        .json({ message: "Today's tracking is already marked done" });
    }

    const session = await TrackingSession.create({
      employeeId,
      organizationId,
      date,
      status: "active",
      startTime: now,
      startLocation: { type: "Point", coordinates: coords },
      lastPingAt: now,
    });

    await Trip.create({
      sessionId: session._id,
      employeeId,
      organizationId,
      date,
      status: "active",
      startTime: now,
      startLocation: { type: "Point", coordinates: coords },
    });

    await LiveLocation.findOneAndUpdate(
      { employeeId },
      {
        organizationId,
        sessionId: session._id,
        location: { type: "Point", coordinates: coords },
        isOnline: true,
        lastPingAt: now,
      },
      { upsert: true },
    );

    broadcastLiveLocation(organizationId, employeeId, "mr:started", {
      employeeId,
      sessionId: session._id,
      coordinates: coords,
      timestamp: now,
    });

    res.status(201).json({ message: "Tracking started", session });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "Tracking already started for today" });
    }
    console.error("startTracking error:", err);
    res.status(500).json({ message: "Failed to start tracking" });
  }
};

export const endTracking = async (req, res) => {
  try {
    if (!req.employee) {
      return res
        .status(403)
        .json({ message: "Only MR devices can end tracking" });
    }
    const employeeId = req.employee._id;
    const organizationId = req.employee.organizationId;
    const { latitude, longitude } = req.body || {};

    const date = todayKey();
    const session = await TrackingSession.findOne({
      employeeId,
      date,
      status: "active",
    });
    if (!session) {
      return res
        .status(404)
        .json({ message: "No active tracking session found for today" });
    }

    const now = new Date();
    const coords =
      latitude != null && longitude != null && isValidCoord(latitude, longitude)
        ? [Number(longitude), Number(latitude)]
        : undefined;

    session.status = "completed";
    session.endTime = now;
    if (coords) session.endLocation = { type: "Point", coordinates: coords };
    await session.save();

    const tripUpdate = {
      status: "completed",
      endTime: now,
      durationSeconds: Math.max(
        0,
        Math.round((now - session.startTime) / 1000),
      ),
    };
    if (coords) tripUpdate.endLocation = { type: "Point", coordinates: coords };

    const trip = await Trip.findOneAndUpdate(
      { sessionId: session._id },
      { $set: tripUpdate },
      { new: true },
    );

    await LiveLocation.findOneAndUpdate(
      { employeeId },
      { isOnline: false, sessionId: null },
    );

    broadcastLiveLocation(organizationId, employeeId, "mr:ended", {
      employeeId,
      sessionId: session._id,
      timestamp: now,
    });

    res.json({ message: "Tracking ended, trip saved", trip });
  } catch (err) {
    console.error("endTracking error:", err);
    res.status(500).json({ message: "Failed to end tracking" });
  }
};

export const capturePing = async (req, res) => {
  try {
    if (!req.employee) {
      return res
        .status(403)
        .json({ message: "Only MR devices can send location" });
    }
    const employeeId = req.employee._id;
    const organizationId = req.employee.organizationId;

    const allowed = await assertEmployeeTrackingAllowed(
      organizationId,
      employeeId,
    );
    if (!allowed.ok) {
      return res.status(allowed.status).json({ message: allowed.message });
    }

    const body = req.body || {};
    const points = Array.isArray(body.points) ? body.points : [body];
    if (!points.length || points.length > 200) {
      return res.status(400).json({ message: "Provide 1-200 points" });
    }

    const date = todayKey();
    const session = await TrackingSession.findOne({
      employeeId,
      date,
      status: "active",
    }).lean();
    if (!session) {
      return res
        .status(409)
        .json({ message: "No active tracking session. Start your day first." });
    }

    const docs = [];
    let rejected = 0;
    for (const p of points) {
      if (!isValidCoord(p.latitude, p.longitude)) {
        rejected += 1;
        continue;
      }
      docs.push({
        sessionId: session._id,
        employeeId,
        organizationId,
        location: {
          type: "Point",
          coordinates: [Number(p.longitude), Number(p.latitude)],
        },
        accuracy: p.accuracy,
        speed: p.speed,
        heading: p.heading,
        battery: p.battery,
        activity: normalizeActivity(p.activity, p.speed),
        timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      });
    }
    if (!docs.length) {
      return res
        .status(400)
        .json({ message: "No valid coordinates in payload" });
    }
    docs.sort((a, b) => a.timestamp - b.timestamp);

    try {
      await LocationPing.insertMany(docs, { ordered: false });
    } catch (err) {
      console.error("capturePing insertMany partial failure:", err.message);
      const inserted = err?.insertedDocs?.length;
      if (!inserted && err?.writeErrors && docs.length === err.writeErrors.length) {
        return res.status(500).json({ message: "Failed to save location" });
      }
    }

    const lastKnown = await LiveLocation.findOne({ employeeId }).lean();
    let cursor = lastKnown?.location?.coordinates || null;
    let distanceDelta = 0;
    for (const d of docs) {
      if (cursor) {
        const meters = getDistance(
          { latitude: cursor[1], longitude: cursor[0] },
          {
            latitude: d.location.coordinates[1],
            longitude: d.location.coordinates[0],
          },
        );
        if (meters >= JITTER_THRESHOLD_METERS) distanceDelta += meters;
      }
      cursor = d.location.coordinates;
    }

    const latest = docs[docs.length - 1];

    await LiveLocation.updateOne(
      { employeeId },
      {
        organizationId,
        sessionId: session._id,
        location: latest.location,
        accuracy: latest.accuracy,
        speed: latest.speed,
        heading: latest.heading,
        isOnline: true,
        lastPingAt: latest.timestamp,
      },
      { upsert: true },
    );

    await Promise.all([
      Trip.updateOne(
        { sessionId: session._id },
        {
          $inc: { totalDistanceMeters: distanceDelta, pingCount: docs.length },
          $set: { endTime: latest.timestamp, endLocation: latest.location },
        },
      ),
      TrackingSession.updateOne(
        { _id: session._id },
        { $set: { lastPingAt: latest.timestamp } },
      ),
    ]);

    broadcastLiveLocation(organizationId, employeeId, "mr:location", {
      employeeId,
      sessionId: session._id,
      coordinates: latest.location.coordinates,
      speed: latest.speed,
      heading: latest.heading,
      activity: latest.activity,
      timestamp: latest.timestamp,
    });

    res.status(201).json({
      success: true,
      accepted: docs.length,
      rejected,
    });
  } catch (err) {
    console.error("capturePing error:", err);
    res.status(500).json({ message: "Failed to save location" });
  }
};

export const getTodayTrip = async (req, res) => {
  try {
    let organizationId;
    let employeeId;

    if (req.organization) {
      organizationId = req.organization._id;
      employeeId = req.query.employeeId;
      if (!employeeId) {
        return res.status(400).json({ message: "employeeId is required" });
      }
    } else if (req.employee) {
      organizationId = req.employee.organizationId;
      employeeId = req.employee._id;
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const date = todayKey();
    const trip = await Trip.findOne({
      employeeId,
      organizationId,
      date,
    }).lean();
    if (!trip) {
      return res.json({ status: "not_started", date, trip: null });
    }
    res.json({ status: trip.status, date, trip });
  } catch (err) {
    console.error("getTodayTrip error:", err);
    res.status(500).json({ message: "Failed to fetch today's trip" });
  }
};

export const listTrips = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { employeeId, from, to } = req.query;

    if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Valid employeeId is required" });
    }
    if (from && !isValidDateKey(from)) {
      return res.status(400).json({ message: "from must be YYYY-MM-DD" });
    }
    if (to && !isValidDateKey(to)) {
      return res.status(400).json({ message: "to must be YYYY-MM-DD" });
    }

    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId,
    }).lean();
    if (!employee) {
      return res
        .status(404)
        .json({ message: "Employee not found in this organization" });
    }

    const filter = { employeeId, organizationId };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    const trips = await Trip.find(filter)
      .sort({ date: -1 })
      .select(
        "date status totalDistanceMeters durationSeconds startTime endTime",
      )
      .lean();

    res.json({
      trips: trips.map((t) => ({
        date: t.date,
        status: t.status,
        totalDistanceMeters: t.totalDistanceMeters || 0,
        durationSeconds: t.durationSeconds || 0,
        tripId: t._id,
        startTime: t.startTime,
        endTime: t.endTime,
      })),
    });
  } catch (err) {
    console.error("listTrips error:", err);
    res.status(500).json({ message: "Failed to list trips" });
  }
};

export const getTripByDate = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { employeeId, date } = req.query;

    if (!employeeId || !date || !isValidDateKey(date)) {
      return res
        .status(400)
        .json({ message: "employeeId and date (YYYY-MM-DD) are required" });
    }
    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const employee = await Employee.findOne(
      { _id: employeeId, organizationId },
      "firstName lastName displayName employeeId",
    ).lean();
    if (!employee) {
      return res
        .status(404)
        .json({ message: "Employee not found in this organization" });
    }

    const trip = await Trip.findOne({
      employeeId,
      organizationId,
      date,
    }).lean();
    if (!trip) {
      return res
        .status(404)
        .json({ message: "No trip recorded for this date" });
    }

    const session = await TrackingSession.findById(trip.sessionId).lean();

    const points = await LocationPing.find({ sessionId: trip.sessionId })
      .sort({ timestamp: 1 })
      .select("location speed heading accuracy activity timestamp -_id")
      .lean();

    const { path, timeline, markers } = await buildTripAnalysis({
      points,
      trip,
      session,
    });

    res.json({
      employee: {
        id: employee._id,
        name:
          employee.displayName || `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
      },
      date,
      trip: {
        id: trip._id,
        status: trip.status,
        totalDistanceMeters: trip.totalDistanceMeters || 0,
        durationSeconds: trip.durationSeconds || 0,
        startTime: trip.startTime,
        endTime: trip.endTime,
      },
      path,
      timeline,
      markers,
    });
  } catch (err) {
    console.error("getTripByDate error:", err);
    res.status(500).json({ message: "Failed to fetch trip" });
  }
};

export const getTripRaw = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { employeeId, date } = req.query;

    if (!employeeId || !date || !isValidDateKey(date)) {
      return res
        .status(400)
        .json({ message: "employeeId and date (YYYY-MM-DD) are required" });
    }
    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const trip = await Trip.findOne({
      employeeId,
      organizationId,
      date,
    }).lean();
    if (!trip) {
      return res
        .status(404)
        .json({ message: "No trip recorded for this date" });
    }

    const points = await LocationPing.find({ sessionId: trip.sessionId })
      .sort({ timestamp: 1 })
      .select("location speed heading accuracy activity battery timestamp -_id")
      .lean();

    res.json({
      date,
      points: points.map((p) => ({
        lat: p.location.coordinates[1],
        lng: p.location.coordinates[0],
        speed: p.speed ?? null,
        heading: p.heading ?? null,
        accuracy: p.accuracy ?? null,
        activity: normalizeActivity(p.activity, p.speed),
        battery: p.battery ?? null,
        timestamp: p.timestamp,
      })),
    });
  } catch (err) {
    console.error("getTripRaw error:", err);
    res.status(500).json({ message: "Failed to fetch raw GPS" });
  }
};

export const getLiveLocations = async (req, res) => {
  try {
    const organizationId = req.organization._id;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    const sendSnapshot = async () => {
      const staleThreshold = new Date(Date.now() - STALE_MS);
      await LiveLocation.updateMany(
        { organizationId, isOnline: true, lastPingAt: { $lt: staleThreshold } },
        { isOnline: false },
      );

      const startOfToday = new Date(`${todayKey()}T00:00:00+05:30`);

      const locations = await LiveLocation.find({
        organizationId,
        $or: [{ isOnline: true }, { lastPingAt: { $gte: startOfToday } }],
      })
        .populate(
          "employeeId",
          "firstName lastName displayName employeeId role",
        )
        .lean();

      sseWrite(res, "snapshot", locations);
    };
    await sendSnapshot();

    const refreshInterval = setInterval(sendSnapshot, STALE_MS / 2);
    const heartbeat = setInterval(() => res.write(":\n\n"), 25000);

    const entry = addClient(organizationId, res);

    req.on("close", () => {
      clearInterval(refreshInterval);
      clearInterval(heartbeat);
      removeClient(organizationId, entry);
    });
  } catch (err) {
    console.error("getLiveLocations error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to fetch live locations" });
    } else {
      res.end();
    }
  }
};

export const getLiveLocationByEmployee = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { employeeId } = req.params;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    const sendSnapshot = async () => {
      const location = await LiveLocation.findOne({
        employeeId,
        organizationId,
      })
        .populate("employeeId", "firstName lastName displayName employeeId")
        .lean();

      if (!location || !location.sessionId) {
        sseWrite(res, "not_tracking", { employeeId });
      } else {
        sseWrite(res, "snapshot", location);
      }
    };
    await sendSnapshot();

    const refreshInterval = setInterval(sendSnapshot, STALE_MS / 2);
    const heartbeat = setInterval(() => res.write(":\n\n"), 25000);

    const entry = addClient(organizationId, res, employeeId);

    req.on("close", () => {
      clearInterval(refreshInterval);
      clearInterval(heartbeat);
      removeClient(organizationId, entry);
    });
  } catch (err) {
    console.error("getLiveLocationByEmployee error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to fetch live location" });
    } else {
      res.end();
    }
  }
};

export const listTrackingEmployees = async (req, res) => {
  try {
    const organizationId = req.organization._id;

    const org = await Organization.findById(organizationId)
      .select("liveTrackingEnabled")
      .lean();

    const employees = await Employee.find({ organizationId, isActive: true })
      .select(
        "firstName lastName displayName employeeId role liveTrackingEnabled",
      )
      .lean();

    const lives = await LiveLocation.find({
      organizationId,
      employeeId: { $in: employees.map((e) => e._id) },
    })
      .select("employeeId isOnline lastPingAt")
      .lean();

    const liveByEmp = new Map(lives.map((l) => [l.employeeId.toString(), l]));

    res.json({
      orgLiveTrackingEnabled: !!org?.liveTrackingEnabled,
      employees: employees.map((e) => {
        const live = liveByEmp.get(e._id.toString());
        return {
          id: e._id,
          employeeId: e.employeeId,
          name: e.displayName || `${e.firstName} ${e.lastName}`,
          role: e.role,
          liveTrackingEnabled: !!e.liveTrackingEnabled,
          isOnline: !!live?.isOnline,
          lastPingAt: live?.lastPingAt || null,
        };
      }),
    });
  } catch (err) {
    console.error("listTrackingEmployees error:", err);
    res.status(500).json({ message: "Failed to list tracking employees" });
  }
};

export const enableOrgTracking = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const org = await Organization.findByIdAndUpdate(
      organizationId,
      {
        liveTrackingEnabled: true,
        liveTrackingEnabledAt: new Date(),
      },
      { new: true },
    ).select("liveTrackingEnabled liveTrackingEnabledAt");

    res.json({
      message: "Live tracking enabled for organization",
      liveTrackingEnabled: !!org.liveTrackingEnabled,
      liveTrackingEnabledAt: org.liveTrackingEnabledAt,
    });
  } catch (err) {
    console.error("enableOrgTracking error:", err);
    res.status(500).json({ message: "Failed to enable org live tracking" });
  }
};

export const disableOrgTracking = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const org = await Organization.findByIdAndUpdate(
      organizationId,
      { liveTrackingEnabled: false },
      { new: true },
    ).select("liveTrackingEnabled");

    await LiveLocation.updateMany(
      { organizationId, isOnline: true },
      { isOnline: false },
    );

    res.json({
      message: "Live tracking disabled for organization",
      liveTrackingEnabled: !!org.liveTrackingEnabled,
    });
  } catch (err) {
    console.error("disableOrgTracking error:", err);
    res.status(500).json({ message: "Failed to disable org live tracking" });
  }
};

export const enableEmployeeTracking = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { employeeId } = req.params;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: employeeId, organizationId },
      { liveTrackingEnabled: true, liveTrackingEnabledAt: new Date() },
      { new: true },
    ).select("liveTrackingEnabled liveTrackingEnabledAt firstName lastName employeeId");

    if (!employee) {
      return res
        .status(404)
        .json({ message: "Employee not found in this organization" });
    }

    res.json({ message: "Live tracking enabled for employee", employee });
  } catch (err) {
    console.error("enableEmployeeTracking error:", err);
    res.status(500).json({ message: "Failed to enable live tracking" });
  }
};

export const disableEmployeeTracking = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { employeeId } = req.params;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const employee = await Employee.findOneAndUpdate(
      { _id: employeeId, organizationId },
      { liveTrackingEnabled: false },
      { new: true },
    ).select("liveTrackingEnabled firstName lastName employeeId");

    if (!employee) {
      return res
        .status(404)
        .json({ message: "Employee not found in this organization" });
    }

    await LiveLocation.findOneAndUpdate(
      { employeeId, organizationId },
      { isOnline: false },
    );

    res.json({ message: "Live tracking disabled for employee", employee });
  } catch (err) {
    console.error("disableEmployeeTracking error:", err);
    res.status(500).json({ message: "Failed to disable live tracking" });
  }
};

export const getTrackingStatus = async (req, res) => {
  try {
    if (!req.employee) {
      return res
        .status(403)
        .json({ message: "Only MR devices can check tracking status" });
    }
    const organizationId = req.employee.organizationId;
    const employeeId = req.employee._id;

    const flags = await getTrackingFlags(organizationId, employeeId);
    const date = todayKey();
    const session = await TrackingSession.findOne({ employeeId, date }).lean();

    res.json({
      liveTrackingEnabled: flags.liveTrackingEnabled,
      orgLiveTrackingEnabled: flags.orgLiveTrackingEnabled,
      employeeLiveTrackingEnabled: flags.employeeLiveTrackingEnabled,
      sessionStatus: session?.status || "not_started",
      date,
    });
  } catch (err) {
    console.error("getTrackingStatus error:", err);
    res.status(500).json({ message: "Failed to fetch tracking status" });
  }
};
