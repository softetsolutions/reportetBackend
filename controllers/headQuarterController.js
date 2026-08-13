import mongoose, { Types } from "mongoose";
import HeadQuarter from "../models/HeadQuarter.js";
import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";
import Employee from "../models/Employee.js";
import fs from "fs";
import ExcelJS from "exceljs";
import { getCellStringValue } from "../utils/helperFunction.js";
import Zone from "../models/Zone.js";

export const addHeadquarter = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { hierrarchy } = req.body;
    if (!hierrarchy?.headquarters?.length) {
      return res.json({
        success: false,
        message: "Empty headquarter",
      });
    }

    const result = await session.withTransaction(async () => {
      const organizationId = hierrarchy.headquarters[0].organizationId;

      const zoneNames = [
        ...new Set(
          hierrarchy.headquarters.map((hq) => hq.zone?.trim()).filter(Boolean),
        ),
      ];

      const zoneNameToId = {};

      if (zoneNames.length) {
        const existingZones = await Zone.find({
          organizationId,
          name: { $in: zoneNames },
        }).session(session);

        existingZones.forEach((z) => {
          zoneNameToId[z.name.toUpperCase()] = z._id;
        });

        const newZoneNames = zoneNames.filter(
          (name) => !zoneNameToId[name.toUpperCase()],
        );

        if (newZoneNames.length) {
          const newZones = await Zone.insertMany(
            newZoneNames.map((name) => ({ name, organizationId })),
            { session },
          );
          newZones.forEach((z) => {
            zoneNameToId[z.name.toUpperCase()] = z._id;
          });
        }
      }

      const headquartersToInsert = hierrarchy.headquarters.map((hq) => {
        const { zone, ...rest } = hq;
        return {
          ...rest,
          zone: zone?.trim()
            ? zoneNameToId[zone.trim().toUpperCase()]
            : undefined,
        };
      });

      const headquarters = await HeadQuarter.insertMany(headquartersToInsert, {
        session,
      });

      const areas = hierrarchy?.areas?.length
        ? await Area.insertMany(hierrarchy.areas, { session })
        : [];
      const doctor = hierrarchy?.doctors?.length
        ? await Doctor.insertMany(hierrarchy.doctors, { session })
        : [];

      return { headquarters, areas, doctor };
    });

    res.json({
      success: true,
      message: "Hierarchy added successfully",
      result: result,
    });
  } catch (error) {
    console.error("Transaction is aborted due to the", error.message);
    res.json({
      success: false,
      message: "Transaction is aborted, try again later",
    });
  } finally {
    await session.endSession();
  }
};

export const fetchHeadquarterData = async (req, res) => {
  try {
    let { pageNo = 1, limit = 5 } = req.body;
    limit = Number(limit);

    const { headQuarterName, zone } = req.body;

    const matchFilter = {
      organizationId: new Types.ObjectId(req?.organization?.id),
    };

    if (headQuarterName?.trim()) {
      matchFilter.headQuarterName = {
        $regex: headQuarterName.trim(),
        $options: "i",
      };
    }

    const basePipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: "zones",
          localField: "zone",
          foreignField: "_id",
          pipeline: [{ $project: { _id: 1, name: 1 } }],
          as: "zone",
        },
      },
      { $unwind: { path: "$zone", preserveNullAndEmptyArrays: true } },
    ];

    if (zone?.trim()) {
      basePipeline.push({
        $match: { "zone.name": { $regex: zone.trim(), $options: "i" } },
      });
    }

    const headQuartersDetails = await HeadQuarter.aggregate([
      ...basePipeline,
      {
        $facet: {
          headQuarterDetail: [
            {
              $sort: {
                _id: -1,
              },
            },
            {
              $skip: (pageNo - 1) * limit,
            },
            {
              $limit: limit,
            },
            {
              $project: {
                _id: 1,
                headQuarterName: 1,
                zone: 1,
                organizationId: 1,
              },
            },
            {
              $lookup: {
                from: "areas",
                localField: "_id",
                foreignField: "headQuarterId",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      name: 1,
                    },
                  },
                ],
                as: "areas",
              },
            },
            {
              $lookup: {
                from: "doctors",
                localField: "areas._id",
                foreignField: "areaId",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      name: 1,
                      specialty: 1,

                      areaId: 1,
                    },
                  },
                ],
                as: "allDoctors",
              },
            },
          ],

          totalCount: [
            {
              $count: "totalHeadquarters",
            },
          ],
        },
      },
    ]);

    res.json({
      success: true,
      data: headQuartersDetails,
    });
  } catch (error) {
    console.error("Unable to fetch the headQuarters", error.message);
    res.json({
      success: false,
      message: "Can not fetch the headquarter details",
    });
  }
};

export const getAllHeadQuartersName = async (req, res) => {
  try {
    const headQuarter = await HeadQuarter.find(
      {
        organizationId: req?.organization?.id,
      },
      {
        _id: 1,
        headQuarterName: 1,
      },
    );
    res.json({
      status: true,
      headQuarterNames: headQuarter,
    });
  } catch (error) {
    console.error("Unable to fetch the headquarter names", error.message);
    res.json({
      success: false,
      message:
        "Unable to fetch the headquarters names, pls try again after sometime",
    });
  }
};

export const getEmployeeHeadQuarter = async (req, res) => {
  try {
    if (req?.employee) {
      if (!req?.employee?.assignedHeadQuarters?.length) {
        res.status(200).json({
          success: true,
          assignedHeadQuarters: [],
        });
      }

      const assignedHeadQuarters = await HeadQuarter.find(
        {
          _id: { $in: req?.employee?.assignedHeadQuarters },
        },
        {
          _id: 1,
          headQuarterName: 1,
          zone: 1,
        },
      ).populate("zone", "_id name");

      res.status(200).json({
        success: true,
        assignedHeadQuarters: assignedHeadQuarters,
      });
    } else {
      const { employeeId } = req?.body;

      const employeeDetail = await Employee.find(
        {
          id: employeeId,
        },
        {
          _id: 0,
          firstName: 0,
          lastName: 0,
          userName: 0,
          employeeId: 0,
          email: 0,
          phoneNumber: 0,
          password: 0,
          role: 0,
          organizationId: 0,
          assignedAreas: 0,
          assignedDoctors: 0,
          createdAt: 0,
          updatedAt: 0,
          __v: 0,
        },
      ).populate({
        path: "assignedHeadQuarters",
        select: "_id headQuarterName zone",
        populate: { path: "zone", select: "_id name" },
      });

      res.status(200).json({
        success: true,
        assignedHeadQuarters: employeeDetail?.assignedHeadQuarters,
      });
    }
  } catch (error) {
    console.error("Error in get Headquarter name of an employee", error);
    res.json({
      success: false,
      message: "Can not fetch headquarters, try again later",
    });
  }
};

export const editHeadquarter = async (req, res) => {
  try {
    const { headquarterId } = req.params;
    const { headQuarterName, zone } = req.body;

    if (!headquarterId) {
      return res.status(400).json({
        success: false,
        message: "Headquarter ID is required",
      });
    }

    if (!headQuarterName && !zone) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    const updateFields = {};
    if (headQuarterName) updateFields.headQuarterName = headQuarterName;

    if (zone?.trim()) {
      const zoneName = zone.trim();
      let zoneDoc = await Zone.findOne({
        organizationId: req?.organization?.id,
        name: { $regex: new RegExp(`^${zoneName}$`, "i") },
      });

      if (!zoneDoc) {
        zoneDoc = await Zone.create({
          name: zoneName,
          organizationId: req?.organization?.id,
        });
      }

      updateFields.zone = zoneDoc._id;
    }

    const updated = await HeadQuarter.findOneAndUpdate(
      {
        _id: headquarterId,
        organizationId: req?.organization?.id,
      },
      { $set: updateFields },
      { new: true, runValidators: true },
    ).populate("zone", "_id name");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Headquarter not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Headquarter updated successfully",
      data: updated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A headquarter with this name already exists in your organization",
      });
    }
    console.error("Error updating headquarter:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update headquarter, try again later",
    });
  }
};

export const deleteHeadquarter = async (req, res) => {
  try {
    const { headquarterId } = req.params;

    if (!headquarterId) {
      return res.status(400).json({
        success: false,
        message: "Headquarter ID is required",
      });
    }

    const linkedAreaCount = await Area.countDocuments({
      headQuarterId: headquarterId,
    });

    if (linkedAreaCount > 0) {
      const linkedAreas = await Area.find(
        { headQuarterId: headquarterId },
        { _id: 1 },
      );
      const areaIds = linkedAreas.map((a) => a._id);
      const linkedDoctorCount = await Doctor.countDocuments({
        areaId: { $in: areaIds },
      });

      return res.status(409).json({
        success: false,
        message:
          linkedDoctorCount > 0
            ? `Cannot delete: this headquarter has ${linkedAreaCount} area(s) and ${linkedDoctorCount} doctor(s) linked to it. Please remove them first.`
            : `Cannot delete: this headquarter has ${linkedAreaCount} area(s) linked to it. Please remove them first.`,
      });
    }

    const deleted = await HeadQuarter.findOneAndDelete({
      _id: headquarterId,
      organizationId: req?.organization?.id,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Headquarter not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Headquarter deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting headquarter:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not delete headquarter, try again later",
    });
  }
};

export const importHeadquartersFromExcel = async (req, res) => {
  const session = await mongoose.startSession();
  const filePath = req.file?.path;
  try {
    const { sheetNo = 0, rowNumber = 2, toRow } = req?.body;
    const organizationId = req?.organization?._id;
    const endRow = toRow ? Number(toRow) : Infinity;

    const escapeRegex = (value) =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[sheetNo];
    if (!worksheet) {
      //fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "Invalid sheet number",
      });
    }

    const hqMap = {};

    const seenDoctorKeys = new Map();
    const skippedRows = [];
    const fileDuplicateDoctors = [];

    const buildDoctorKey = (email, phoneNumber, name) => {
      if (email) return `email::${email.trim().toLowerCase()}`;
      if (phoneNumber) return `phone::${String(phoneNumber).trim()}`;

      return `name::${name.trim().toLowerCase()}`;
    };

    worksheet.eachRow({ includeEmpty: false }, (row, number) => {
      if (number < rowNumber || number > endRow) return;

      const hqNameRaw = getCellStringValue(row?.values[2]);
      const zoneName = getCellStringValue(row?.values[3]);
      const areaNameRaw = getCellStringValue(row?.values[4]);
      const doctorName = getCellStringValue(row?.values[5]);
      const specialty = getCellStringValue(row?.values[6]);
      const dob = getCellStringValue(row?.values[7]) || undefined;
      const email = getCellStringValue(row?.values[8]) || undefined;
      const phoneNumber = getCellStringValue(row?.values[9]) || undefined;

      if (!hqNameRaw) {
        skippedRows.push({ row: number, reason: "Missing headquarter name" });
        return;
      }

      const hqKey = hqNameRaw.trim().toUpperCase();
      if (!hqMap[hqKey]) {
        hqMap[hqKey] = { name: hqNameRaw.trim(), zone: zoneName, areas: {} };
      }

      if (areaNameRaw) {
        const areaKey = areaNameRaw.trim().toUpperCase();
        if (!hqMap[hqKey].areas[areaKey]) {
          hqMap[hqKey].areas[areaKey] = {
            name: areaNameRaw.trim(),
            doctors: [],
          };
        }

        if (doctorName) {
          const doctorKey = buildDoctorKey(email, phoneNumber, doctorName);
          const compositeKey = `${hqKey}::${areaKey}::${doctorKey}`;

          if (seenDoctorKeys.has(compositeKey)) {
            const first = seenDoctorKeys.get(compositeKey);
            fileDuplicateDoctors.push({
              row: number,
              name: doctorName,
              headquarter: hqMap[hqKey].name,
              area: hqMap[hqKey].areas[areaKey].name,
              reason: `Duplicate of row ${first.row} in this file (same ${doctorKey.split("::")[0]})`,
            });
            return;
          }

          seenDoctorKeys.set(compositeKey, { row: number });
          hqMap[hqKey].areas[areaKey].doctors.push({
            name: doctorName,
            specialty,
            dob,
            email,
            phoneNumber,
            _row: number,
            _doctorKey: doctorKey,
          });
        }
      }
    });

    //fs.unlinkSync(filePath);

    if (!Object.keys(hqMap).length) {
      return res.status(400).json({
        success: false,
        message: "No valid headquarter rows found in the sheet",
      });
    }

    let insertedHQCount = 0;
    let insertedAreaCount = 0;
    let insertedDoctorCount = 0;

    const existingHeadquarters = [];
    const existingAreas = [];
    const dbDuplicateDoctors = [];

    await session.withTransaction(async () => {
      const hqKeys = Object.keys(hqMap);
      const hqNames = hqKeys.map((k) => hqMap[k].name);

      const existingHQs = await HeadQuarter.find({
        organizationId,
        $or: hqNames.map((name) => ({
          headQuarterName: {
            $regex: new RegExp(`^${escapeRegex(name)}$`, "i"),
          },
        })),
      }).session(session);

      const hqNameToId = {};
      existingHQs.forEach((hq) => {
        hqNameToId[hq.headQuarterName.toUpperCase()] = hq._id;
        existingHeadquarters.push({ name: hq.headQuarterName });
      });

      // Resolve/create zones for the headquarters that still need to be inserted
      const zoneNames = [
        ...new Set(
          hqKeys
            .filter((key) => !hqNameToId[key])
            .map((key) => hqMap[key].zone?.trim())
            .filter(Boolean),
        ),
      ];

      const zoneNameToId = {};

      if (zoneNames.length) {
        const existingZones = await Zone.find({
          organizationId,
          name: { $in: zoneNames },
        }).session(session);

        existingZones.forEach((z) => {
          zoneNameToId[z.name.toUpperCase()] = z._id;
        });

        const newZoneNames = zoneNames.filter(
          (name) => !zoneNameToId[name.toUpperCase()],
        );

        if (newZoneNames.length) {
          const newZones = await Zone.insertMany(
            newZoneNames.map((name) => ({ name, organizationId })),
            { session },
          );
          newZones.forEach((z) => {
            zoneNameToId[z.name.toUpperCase()] = z._id;
          });
        }
      }

      const newHQs = hqKeys
        .filter((key) => !hqNameToId[key])
        .map((key) => ({
          headQuarterName: hqMap[key].name,
          zone: hqMap[key].zone?.trim()
            ? zoneNameToId[hqMap[key].zone.trim().toUpperCase()]
            : undefined,
          organizationId,
        }));

      if (newHQs.length) {
        const inserted = await HeadQuarter.insertMany(newHQs, { session });
        insertedHQCount = inserted.length;
        inserted.forEach((hq) => {
          hqNameToId[hq.headQuarterName.toUpperCase()] = hq._id;
        });
      }

      const areaKeyToId = {};
      const areasToInsert = [];

      for (const hqKey of hqKeys) {
        const hqId = hqNameToId[hqKey];
        const areaKeys = Object.keys(hqMap[hqKey].areas);
        if (!areaKeys.length) continue;

        const areaNames = areaKeys.map((k) => hqMap[hqKey].areas[k].name);

        const existingAreasForHQ = await Area.find({
          organizationId,
          headQuarterId: hqId,
          $or: areaNames.map((name) => ({
            name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") },
          })),
        }).session(session);

        existingAreasForHQ.forEach((area) => {
          areaKeyToId[`${hqId}::${area.name.toUpperCase()}`] = area._id;
          existingAreas.push({
            name: area.name,
            headquarter: hqMap[hqKey].name,
          });
        });

        areaKeys.forEach((areaKey) => {
          if (!areaKeyToId[`${hqId}::${areaKey}`]) {
            areasToInsert.push({
              name: hqMap[hqKey].areas[areaKey].name,
              headQuarterId: hqId,
              organizationId,
              _tmpKey: `${hqId}::${areaKey}`,
            });
          }
        });
      }

      if (areasToInsert.length) {
        const toInsert = areasToInsert.map(({ _tmpKey, ...rest }) => rest);
        const inserted = await Area.insertMany(toInsert, { session });
        insertedAreaCount = inserted.length;
        inserted.forEach((area, idx) => {
          areaKeyToId[areasToInsert[idx]._tmpKey] = area._id;
        });
      }

      const allDoctors = [];
      for (const hqKey of hqKeys) {
        const hqId = hqNameToId[hqKey];
        for (const areaKey of Object.keys(hqMap[hqKey].areas)) {
          const areaId = areaKeyToId[`${hqId}::${areaKey}`];
          const areaEntry = hqMap[hqKey].areas[areaKey];
          areaEntry.doctors.forEach((doc) => {
            allDoctors.push({
              ...doc,
              areaId,
              headquarter: hqMap[hqKey].name,
              area: areaEntry.name,
            });
          });
        }
      }

      const emails = allDoctors.filter((d) => d.email).map((d) => d.email);
      const phones = allDoctors
        .filter((d) => d.phoneNumber)
        .map((d) => d.phoneNumber);

      const orClauses = [];
      if (emails.length) orClauses.push({ email: { $in: emails } });
      if (phones.length) orClauses.push({ phoneNumber: { $in: phones } });

      const existingDoctors = orClauses.length
        ? await Doctor.find({ organizationId, $or: orClauses }).session(session)
        : [];

      const existingDoctorKeys = new Set();
      existingDoctors.forEach((doc) => {
        if (doc.email)
          existingDoctorKeys.add(`email::${doc.email.trim().toLowerCase()}`);
        if (doc.phoneNumber)
          existingDoctorKeys.add(`phone::${String(doc.phoneNumber).trim()}`);
      });

      const doctorsToInsert = [];
      allDoctors.forEach((doc) => {
        if (existingDoctorKeys.has(doc._doctorKey)) {
          dbDuplicateDoctors.push({
            row: doc._row,
            name: doc.name,
            headquarter: doc.headquarter,
            area: doc.area,
            reason:
              "A doctor with this email/phone number already exists in this organization",
          });
          return;
        }
        const { _row, _doctorKey, headquarter, area, ...toInsert } = doc;
        doctorsToInsert.push(toInsert);
      });

      if (doctorsToInsert.length) {
        try {
          const inserted = await Doctor.insertMany(doctorsToInsert, {
            session,
            ordered: false,
          });
          insertedDoctorCount = inserted.length;
        } catch (error) {
          insertedDoctorCount = error.result?.nInserted || 0;
        }
      }
    });

    const totalDuplicateDoctors =
      fileDuplicateDoctors.length + dbDuplicateDoctors.length;

    res.status(200).json({
      success: true,
      message: `${insertedHQCount} headquarter(s), ${insertedAreaCount} area(s), ${insertedDoctorCount} doctor(s) imported successfully.${
        totalDuplicateDoctors
          ? ` ${totalDuplicateDoctors} duplicate doctor row(s) were skipped.`
          : ""
      }`,
      summary: {
        insertedHQCount,
        insertedAreaCount,
        insertedDoctorCount,
        skippedDoctorCount: totalDuplicateDoctors,
        skippedRowCount: skippedRows.length,
      },
      duplicates: {
        doctors: [...fileDuplicateDoctors, ...dbDuplicateDoctors],
      },
      existing: {
        headquarters: existingHeadquarters,
        areas: existingAreas,
      },
      skippedRows,
    });
  } catch (err) {
    console.error("Headquarter Import Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to import headquarters from Excel file.",
    });
  } finally {
    await session.endSession();
    if (filePath) {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr)
          console.error("Failed to delete uploaded file:", unlinkErr.message);
      });
    }
  }
};

export const getUnassignedHierarchy = async (req, res) => {
  try {
    const organizationId = req?.organization?._id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const [areaManagers, mrs, allHQs] = await Promise.all([
      Employee.find(
        { organizationId, role: "areaManager", isActive: true },
        { firstName: 1, lastName: 1, employeeId: 1, assignedHeadQuarters: 1 },
      )
        .populate("assignedHeadQuarters", "headQuarterName zone")
        .lean(),

      Employee.find(
        { organizationId, role: "mr", isActive: true },
        { assignedHeadQuarters: 1 },
      ).lean(),

      HeadQuarter.find({ organizationId }, { headQuarterName: 1, zone: 1 })
        .populate("zone", "name")
        .lean(),
    ]);

    const hqIdsWithAreaManager = new Set(
      areaManagers.flatMap((am) =>
        (am.assignedHeadQuarters || []).map((hq) => String(hq._id)),
      ),
    );

    const hqIdsWithMR = new Set(
      mrs.flatMap((mr) =>
        (mr.assignedHeadQuarters || []).map((id) => String(id)),
      ),
    );

    const headquartersWithoutAreaManager = allHQs.filter(
      (hq) => !hqIdsWithAreaManager.has(String(hq._id)),
    );

    const areaManagersWithoutMR = areaManagers.reduce((acc, am) => {
      const uncoveredHQs = (am.assignedHeadQuarters || []).filter(
        (hq) => !hqIdsWithMR.has(String(hq._id)),
      );
      if (uncoveredHQs.length) {
        acc.push({
          _id: am._id,
          employeeId: am.employeeId,
          name: `${am.firstName} ${am.lastName}`,
          headquartersWithoutMR: uncoveredHQs,
        });
      }
      return acc;
    }, []);

    return res.status(200).json({
      success: true,
      data: {
        headquartersWithoutAreaManager,
        areaManagersWithoutMR,
      },
    });
  } catch (error) {
    console.error("Error fetching unassigned hierarchy:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch unassigned hierarchy details",
    });
  }
};

export const getAllZoneNames = async (req, res) => {
  try {
    const zones = await Zone.find(
      { organizationId: req?.organization?.id },
      { _id: 1, name: 1 },
    ).sort({ name: 1 });

    res.json({
      success: true,
      zones,
    });
  } catch (error) {
    console.error("Unable to fetch zones", error.message);
    res.json({
      success: false,
      message: "Unable to fetch zones, please try again later",
    });
  }
};

export const getHeadquarterAssignments = async (req, res) => {
  try {
    const { headquarterId } = req.params;
    const organizationId = req?.organization?.id;

    if (!headquarterId || !mongoose.isValidObjectId(headquarterId)) {
      return res.status(400).json({
        success: false,
        message: "Valid headquarter ID is required",
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const hqObjectId = new Types.ObjectId(headquarterId);
    const orgObjectId = new Types.ObjectId(organizationId);

    const employeeFields = {
      firstName: 1,
      lastName: 1,
      employeeId: 1,
      email: 1,
      phoneNumber: 1,
      role: 1,
    };

    const [headquarter, hqEmployees, areas] = await Promise.all([
      HeadQuarter.findOne(
        { _id: hqObjectId, organizationId: orgObjectId },
        { headQuarterName: 1, zone: 1 },
      )
        .populate("zone", "_id name")
        .lean(),

      Employee.find(
        {
          organizationId: orgObjectId,
          role: { $in: ["areaManager", "mr"] },
          assignedHeadQuarters: hqObjectId,
          isActive: true,
        },
        employeeFields,
      ).lean(),

      Area.find(
        { organizationId: orgObjectId, headQuarterId: hqObjectId },
        { name: 1, assignedTo: 1 },
      ).lean(),
    ]);

    if (!headquarter) {
      return res.status(404).json({
        success: false,
        message: "Headquarter not found or access denied",
      });
    }

    const zonalManagers = headquarter.zone
      ? await Employee.find(
          {
            organizationId: orgObjectId,
            role: "zonalManager",
            assignedZones: headquarter.zone._id,
            isActive: true,
          },
          employeeFields,
        ).lean()
      : [];

    const areaManagers = [];
    const mrs = [];
    hqEmployees.forEach((emp) => {
      if (emp.role === "areaManager") areaManagers.push(emp);
      else if (emp.role === "mr") mrs.push(emp);
    });

    const employeeIdToAreas = {};
    areas.forEach((area) => {
      if (area.assignedTo) {
        const key = String(area.assignedTo);
        (employeeIdToAreas[key] ??= []).push({
          _id: area._id,
          name: area.name,
        });
      }
    });

    const withName = ({ role, ...emp }) => ({
      ...emp,
      name: `${emp.firstName} ${emp.lastName}`,
    });

    const mrsWithAreas = mrs.map((mr) => ({
      ...withName(mr),
      assignedAreas: employeeIdToAreas[String(mr._id)] || [],
    }));

    return res.status(200).json({
      success: true,
      data: {
        headquarter: {
          _id: headquarter._id,
          headQuarterName: headquarter.headQuarterName,
          zone: headquarter.zone || null,
        },
        zonalManagers: zonalManagers.map(withName),
        areaManagers: areaManagers.map(withName),
        mrs: mrsWithAreas,
      },
    });
  } catch (error) {
    console.error("Error fetching headquarter assignments:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch headquarter assignments",
    });
  }
};
