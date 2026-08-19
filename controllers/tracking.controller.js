import mongoose from "mongoose";
import TrackingSession from "../models/TrackingSession.js";
import LocationPing from "../models/LocationPing.js";
import LiveLocation from "../models/LiveLocation.js";
import Trip from "../models/Trip.js";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";
import { getDistance } from "geolib";
import { getPlaceNamesForPoints, cacheKey } from "../utils/Reversegeocode.js";

const STALE_MS = 5 * 60 * 1000;
const JITTER_THRESHOLD_METERS = 5;
const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

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

    if (latitude == null || longitude == null) {
      return res
        .status(400)
        .json({ message: "latitude and longitude are required" });
    }

    const org = await Organization.findById(organizationId)
      .select("liveTrackingEnabled")
      .lean();
    if (!org?.liveTrackingEnabled) {
      return res
        .status(403)
        .json({ message: "Live tracking is not open yet. Wait for admin." });
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
      latitude != null && longitude != null
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
    for (const p of points) {
      if (p.latitude == null || p.longitude == null) continue;
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
        timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      });
    }
    if (!docs.length) {
      return res
        .status(400)
        .json({ message: "No valid coordinates in payload" });
    }
    docs.sort((a, b) => a.timestamp - b.timestamp);

    await LocationPing.insertMany(docs, { ordered: false }).catch((err) => {
      console.error("capturePing insertMany partial failure:", err.message);
    });

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
      timestamp: latest.timestamp,
    });

    res.status(201).json({ success: true, accepted: docs.length });
  } catch (err) {
    console.error("capturePing error:", err);
    res.status(500).json({ message: "Failed to save location" });
  }
};
export const getTodayTrip = async (req, res) => {
  try {
    let organizationId, employeeId;

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
      return res.json({ status: "not_started", trip: null });
    }
    res.json({ status: trip.status, trip });
  } catch (err) {
    console.error("getTodayTrip error:", err);
    res.status(500).json({ message: "Failed to fetch today's trip" });
  }
};

export const getTripByDate = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const { employeeId, date } = req.query;

    if (!employeeId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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

    const points = await LocationPing.find({ sessionId: trip.sessionId })
      .sort({ timestamp: 1 })
      .select("location speed heading timestamp -_id")
      .lean();

    const path = points.map((p) => ({
      lat: p.location.coordinates[1],
      lng: p.location.coordinates[0],
      speed: p.speed,
      heading: p.heading,
      timestamp: p.timestamp,
    }));

    const placeNameMap = await getPlaceNamesForPoints(path);
    const pathWithNames = path.map((p) => ({
      ...p,
      placeName: placeNameMap.get(cacheKey(p.lat, p.lng)) || null,
    }));

    res.json({
      employee: {
        id: employee._id,
        name:
          employee.displayName || `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
      },
      date,
      trip,
      path: pathWithNames,
    });
  } catch (err) {
    console.error("getTripByDate error:", err);
    res.status(500).json({ message: "Failed to fetch trip" });
  }
};
export const getLiveLocations = async (req, res) => {
  try {
    const organizationId = req.organization._id;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disables nginx buffering if you're behind it
    });
    res.flushHeaders();

    // send an initial snapshot immediately on connect
    const sendSnapshot = async () => {
      const staleThreshold = new Date(Date.now() - STALE_MS);
      await LiveLocation.updateMany(
        { organizationId, isOnline: true, lastPingAt: { $lt: staleThreshold } },
        { isOnline: false },
      );

      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

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
    res.flushHeaders();

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
// trackingController.js

// Admin enables tracking for ONE employee
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
    ).select("liveTrackingEnabled liveTrackingEnabledAt firstName lastName");

    if (!employee) {
      return res
        .status(404)
        .json({ message: "Employee not found in this organization" });
    }

    req.io?.to(`org:${organizationId}`).emit("tracking:employee-enabled", {
      employeeId,
    });

    res.json({ message: "Live tracking enabled for employee", employee });
  } catch (err) {
    console.error("enableEmployeeTracking error:", err);
    res.status(500).json({ message: "Failed to enable live tracking" });
  }
};

// Admin disables tracking for ONE employee
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
    ).select("liveTrackingEnabled firstName lastName");

    if (!employee) {
      return res
        .status(404)
        .json({ message: "Employee not found in this organization" });
    }

    req.io?.to(`org:${organizationId}`).emit("tracking:employee-disabled", {
      employeeId,
    });

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

    const org = await Organization.findById(organizationId)
      .select("liveTrackingEnabled")
      .lean();

    const date = todayKey();
    const session = await TrackingSession.findOne({ employeeId, date }).lean();

    res.json({
      liveTrackingEnabled: !!org?.liveTrackingEnabled,
      sessionStatus: session?.status || "not_started",
    });
  } catch (err) {
    console.error("getTrackingStatus error:", err);
    res.status(500).json({ message: "Failed to fetch tracking status" });
  }
};
