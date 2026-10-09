import mongoose from "mongoose";
import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";

const toObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

export const normalizeIdList = (ids) => {
  if (!Array.isArray(ids)) return { error: "ids must be an array" };
  const normalized = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = String(raw || "").trim();
    if (!id) continue;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { error: `invalid id: ${id}` };
    }
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return { ids: normalized };
};

export const loadEmployeeTerritory = async (employee) => {
  const organizationId = employee.organizationId;
  const hqIds = employee.assignedHeadQuarters || [];

  if (!hqIds.length) {
    return {
      organizationId,
      areas: [],
      areaIdSet: new Set(),
      doctors: [],
      doctorById: new Map(),
    };
  }

  const areas = await Area.find({
    organizationId,
    headQuarterId: { $in: hqIds },
  })
    .select("_id name headQuarterId")
    .lean();

  const areaIdSet = new Set(areas.map((a) => String(a._id)));
  const areaObjectIds = areas.map((a) => a._id);

  const doctors = areaObjectIds.length
    ? await Doctor.find({
        organizationId,
        areaId: { $in: areaObjectIds },
      })
        .select("_id name areaId")
        .lean()
    : [];

  const doctorById = new Map(doctors.map((d) => [String(d._id), d]));

  return {
    organizationId,
    areas,
    areaIdSet,
    doctors,
    doctorById,
  };
};

export const validateDayPlanPayload = async ({
  employee,
  areaIds,
  doctorIds,
}) => {
  const areaNorm = normalizeIdList(areaIds);
  if (areaNorm.error) return { error: areaNorm.error };
  const doctorNorm = normalizeIdList(doctorIds);
  if (doctorNorm.error) return { error: doctorNorm.error };

  const normalizedAreaIds = areaNorm.ids;
  const normalizedDoctorIds = doctorNorm.ids;

  if (!normalizedAreaIds.length && !normalizedDoctorIds.length) {
    return { areaIds: [], doctorIds: [], clear: true };
  }

  if (!normalizedAreaIds.length || !normalizedDoctorIds.length) {
    return {
      error: "Both areaIds and doctorIds are required to plan a working day",
    };
  }

  const territory = await loadEmployeeTerritory(employee);
  for (const areaId of normalizedAreaIds) {
    if (!territory.areaIdSet.has(areaId)) {
      return { error: `Area ${areaId} is not in your assigned territory` };
    }
  }

  for (const doctorId of normalizedDoctorIds) {
    const doctor = territory.doctorById.get(doctorId);
    if (!doctor) {
      return { error: `Doctor ${doctorId} is not in your assigned territory` };
    }
    if (!normalizedAreaIds.includes(String(doctor.areaId))) {
      return {
        error: `Doctor ${doctorId} does not belong to any selected area`,
      };
    }
  }

  return {
    areaIds: normalizedAreaIds.map((id) => toObjectId(id)),
    doctorIds: normalizedDoctorIds.map((id) => toObjectId(id)),
    clear: false,
  };
};
