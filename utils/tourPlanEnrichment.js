import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";

const collectIdsFromDayPlans = (dayPlansMap) => {
  const areaIds = new Set();
  const doctorIds = new Set();

  for (const plan of Object.values(dayPlansMap || {})) {
    for (const id of plan?.areaIds || []) areaIds.add(String(id));
    for (const id of plan?.doctorIds || []) doctorIds.add(String(id));
  }

  return { areaIds: [...areaIds], doctorIds: [...doctorIds] };
};

export const enrichDayPlans = async (organizationId, dayPlansMap) => {
  const { areaIds, doctorIds } = collectIdsFromDayPlans(dayPlansMap);

  const [areas, doctors] = await Promise.all([
    areaIds.length
      ? Area.find({ _id: { $in: areaIds }, organizationId })
          .select("_id name headQuarterId")
          .populate("headQuarterId", "headQuarterName")
          .lean()
      : [],
    doctorIds.length
      ? Doctor.find({ _id: { $in: doctorIds }, organizationId })
          .select("_id name specialty areaId")
          .lean()
      : [],
  ]);

  const areaById = new Map(areas.map((a) => [String(a._id), a]));
  const doctorById = new Map(doctors.map((d) => [String(d._id), d]));

  const enrichedMap = {};
  const days = [];

  for (const date of Object.keys(dayPlansMap || {}).sort()) {
    const plan = dayPlansMap[date];
    const enrichedAreas = (plan.areaIds || []).map((id) => {
      const area = areaById.get(String(id));
      if (!area) {
        return { areaId: String(id), name: null, headQuarterName: null, displayLabel: null };
      }
      const hqName = area.headQuarterId?.headQuarterName ?? null;
      return {
        areaId: String(area._id),
        name: area.name,
        headQuarterName: hqName,
        displayLabel: hqName ? `${area.name} (${hqName})` : area.name,
      };
    });

    const enrichedDoctors = (plan.doctorIds || []).map((id) => {
      const doctor = doctorById.get(String(id));
      if (!doctor) {
        return { doctorId: String(id), name: null, specialty: null, areaId: null };
      }
      return {
        doctorId: String(doctor._id),
        name: doctor.name,
        specialty: doctor.specialty ?? null,
        areaId: doctor.areaId ? String(doctor.areaId) : null,
      };
    });

    const entry = {
      date,
      areaIds: (plan.areaIds || []).map(String),
      doctorIds: (plan.doctorIds || []).map(String),
      areas: enrichedAreas,
      doctors: enrichedDoctors,
    };

    enrichedMap[date] = entry;
    days.push(entry);
  }

  return { dayPlans: enrichedMap, days };
};
