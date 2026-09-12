import Doctor from "../models/Doctor.js";
import fs from "fs";
import ExcelJS from "exceljs";
import Area from "../models/Area.js";
import { getCellStringValue } from "../utils/helperFunction.js";

function computeBirthdayMonthDay(dob) {
  if (!dob) return null;
  const parsed = new Date(dob);
  if (isNaN(parsed.getTime())) return null;
  return `${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

export const addDoctor = async (req, res) => {
  try {
    // const sampleDoctorDataStructure = {
    //   "Mr Satyam Tripathi": {
    //     specialty:"",
    //     areaId:"",
    //     headQuarterId:""
    //   }
    // }

    const { doctorData } = req.body;

    const doctorArray = Object.keys(doctorData).map((doctor) => ({
      name: doctor,
      specialty: doctorData[doctor]?.specialty,
      organizationId: req?.organization._id,
      areaId: doctorData[doctor]?.areaId,
      dob: doctorData[doctor]?.dob,
      birthdayMonthDay: computeBirthdayMonthDay(doctorData[doctor]?.dob),
      email: doctorData[doctor]?.email,
      phoneNumber: doctorData[doctor]?.phoneNumber,
    }));

    const dbAcknowledge = await Doctor.insertMany(doctorArray, {
      ordered: false,
    });

    res.status(201).json({
      success: true,
      inserted: dbAcknowledge,
      message: "Doctor are added successfuly",
    });
  } catch (error) {
    if (error.code === 11000 || error.writeErrors) {
      const insertedCount = error.result?.nInserted || 0;

      return res.status(201).json({
        success: true,
        inserted: insertedCount,
        duplicates: error.writeErrors?.length || 0,
        message: "Some records were skipped because they already exist",
      });
    }

    res.status(500).json({
      message: "Failed to add doctors",
      error: error.message,
    });
  }
};

export const getDoctorsByAreaId = async (req, res) => {
  try {
    const { areaId } = req.params;

    const organizationId =
      req.employee?.organizationId || req.organization?._id;
    if (!organizationId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const doctors = await Doctor.find({ areaId, organizationId }).select(
      "name specialty _id",
    );

    if (doctors.length === 0) {
      return res
        .status(404)
        .json({ message: "No doctors found for this area" });
    }

    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve doctors by area",
      error: error.message,
    });
  }
};

export const getAllDoctors = async (req, res) => {
  try {
    const pageNo = Number(req.body.pageNo) || 1;
    const limit = Number(req.body.limit) || 5;
    const { name, specialty, areaId, headQuarterId } = req.body;

    const filter = {
      organizationId: req?.organization?.id,
    };
    if (name?.trim()) {
      filter.name = { $regex: name.trim(), $options: "i" };
    }
    if (specialty?.trim()) {
      filter.specialty = { $regex: specialty.trim(), $options: "i" };
    }

    if (areaId) {
      filter.areaId = areaId;
    } else if (headQuarterId) {
      const areas = await Area.find(
        { headQuarterId, organizationId: req?.organization?.id },
        { _id: 1 },
      ).lean();
      filter.areaId = { $in: areas.map((a) => a._id) };
    }
    const [doctors, totalDoctorCount] = await Promise.all([
      Doctor.find(
        filter,
        {
          _id: 1,
          name: 1,
          specialty: 1,
          areaId: 1,
          dob: 1,
          email: 1,
          phoneNumber: 1,
        },
        {
          skip: (pageNo - 1) * limit,
          limit,
        },
      ).populate({
        path: "areaId",
        select: "name headQuarterId",
        populate: { path: "headQuarterId", select: "headQuarterName" },
      }),

      Doctor.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      doctors,
      doctorsCount: totalDoctorCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve doctors",
      error: error.message,
    });
  }
};

export const importDoctorsFromExcel = async (req, res) => {
  const filePath = req.file?.path;
  try {
    const {
      sheetNo = 0,
      rowNumber = 2,
      areaColumnName = "Area",
      doctorColumnName = "DR LIST",
    } = req?.body;
    const organizationId = req?.organization?._id;

    const escapeRegex = (value) =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[sheetNo];

    if (!worksheet) {
      throw new Error("Invalid sheet number");
    }

    const areaDoctorMap = {};
    const skippedRows = [];
    const fileDuplicateDoctors = [];

    const seenDoctorKeys = new Map();

    const buildDoctorKey = (email, phoneNumber, name) => {
      if (email) return `email::${email.trim().toLowerCase()}`;
      if (phoneNumber) return `phone::${String(phoneNumber).trim()}`;
      return `name::${name.trim().toLowerCase()}`;
    };

    worksheet.eachRow({ includeEmpty: false }, (row, number) => {
      if (number < rowNumber) return;
      const doctorName = getCellStringValue(row?.values[2]);
      const areaName = getCellStringValue(row?.values[3]);
      const speciality = getCellStringValue(row?.values[4]);
      const dob = getCellStringValue(row?.values[5]) || undefined;
      const email = getCellStringValue(row?.values[6]) || undefined;
      const phoneNumber = getCellStringValue(row?.values[7]) || undefined;

      if (!doctorName || !areaName) {
        skippedRows.push({
          row: number,
          reason: !doctorName ? "Missing doctor name" : "Missing area name",
        });
        return;
      }

      const doctorKey = buildDoctorKey(email, phoneNumber, doctorName);

      if (seenDoctorKeys.has(doctorKey)) {
        const first = seenDoctorKeys.get(doctorKey);
        fileDuplicateDoctors.push({
          row: number,
          name: doctorName,
          area: areaName,
          reason: `Duplicate of row ${first.row} in this file (same ${
            doctorKey.split("::")[0]
          })`,
        });
        return;
      }
      seenDoctorKeys.set(doctorKey, { row: number });

      const doctorEntry = {
        name: doctorName,
        specialty: speciality,
        dob,
        birthdayMonthDay: computeBirthdayMonthDay(dob),
        email,
        phoneNumber,
        areaId: areaName,
        organizationId,
        _row: number,
        _doctorKey: doctorKey,
      };

      if (areaDoctorMap[areaName]) {
        areaDoctorMap[areaName].push(doctorEntry);
      } else {
        areaDoctorMap[areaName] = [doctorEntry];
      }
    });

    const areasToFind = Object.keys(areaDoctorMap).map((areaName) => ({
      name: {
        $regex: new RegExp(`^${escapeRegex(areaName.trim())}$`, "i"),
      },
    }));

    const areaWithIds = areasToFind.length
      ? await Area.find({
          organizationId,
          $or: areasToFind,
        }).select("_id name")
      : [];

    const areaAndAreaIdMap = areaWithIds.reduce((acc, area) => {
      acc[area?.name?.toUpperCase()] = area?._id;
      return acc;
    }, {});

    const candidateDoctors = [];
    Object.values(areaDoctorMap).forEach((doctorList) => {
      doctorList.forEach((doc) => {
        const areaId = areaAndAreaIdMap[doc.areaId?.toUpperCase()];
        if (!areaId) {
          skippedRows.push({
            row: doc._row,
            reason: `Area "${doc.areaId}" not found in this organization`,
          });
          return;
        }
        candidateDoctors.push({ ...doc, areaId });
      });
    });

    const emails = candidateDoctors.filter((d) => d.email).map((d) => d.email);
    const phones = candidateDoctors
      .filter((d) => d.phoneNumber)
      .map((d) => d.phoneNumber);

    const orClauses = [];
    if (emails.length) orClauses.push({ email: { $in: emails } });
    if (phones.length) orClauses.push({ phoneNumber: { $in: phones } });

    const existingDoctors = orClauses.length
      ? await Doctor.find({ organizationId, $or: orClauses })
      : [];

    const existingDoctorKeys = new Set();
    existingDoctors.forEach((doc) => {
      if (doc.email)
        existingDoctorKeys.add(`email::${doc.email.trim().toLowerCase()}`);
      if (doc.phoneNumber)
        existingDoctorKeys.add(`phone::${String(doc.phoneNumber).trim()}`);
    });

    const dbDuplicateDoctors = [];
    const doctorsDetailInsertionPayload = [];

    candidateDoctors.forEach((doc) => {
      if (existingDoctorKeys.has(doc._doctorKey)) {
        dbDuplicateDoctors.push({
          row: doc._row,
          name: doc.name,
          area: Object.keys(areaAndAreaIdMap).find(
            (k) => String(areaAndAreaIdMap[k]) === String(doc.areaId),
          ),
          reason:
            "A doctor with this email/phone number already exists in this organization",
        });
        return;
      }
      const { _row, _doctorKey, ...toInsert } = doc;
      doctorsDetailInsertionPayload.push(toInsert);
    });

    let insertDoctors = [];
    if (doctorsDetailInsertionPayload.length) {
      try {
        insertDoctors = await Doctor.insertMany(doctorsDetailInsertionPayload, {
          ordered: false,
        });
      } catch (error) {
        insertDoctors = error.insertedDocs || [];
      }
    }

    const duplicates = [...fileDuplicateDoctors, ...dbDuplicateDoctors];

    res.status(200).json({
      success: true,
      data: insertDoctors,
      message: `${insertDoctors.length} doctor(s) imported successfully.${
        duplicates.length
          ? ` ${duplicates.length} duplicate row(s) were skipped.`
          : ""
      }`,
      summary: {
        insertedDoctorCount: insertDoctors.length,
        skippedDoctorCount: duplicates.length,
        skippedRowCount: skippedRows.length,
      },
      duplicates: {
        doctors: duplicates,
      },
      skippedRows,
    });
  } catch (err) {
    console.error("Excel Import Error:", err);
    res
      .status(500)
      .json({ message: "Failed to import doctors from Excel file." });
  } finally {
    if (filePath) {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr)
          console.error("Failed to delete uploaded file:", unlinkErr.message);
      });
    }
  }
};
export const getDoctorByMrId = async (req, res) => {
  try {
    const { mrId } = req.params;
    const orgId = req.headers["x-org-id"];

    // Fetch MR
    const mr = await Mr.findOne({
      _id: mrId,
      role: "mr",
      organizationId: orgId,
      //organizationId: req.organization?._id // if org request
    }).populate("assignedDoctors", "name _id");

    if (!mr) {
      // If MR is accessing themselves, check token
      if (req.mr && req.mr._id.toString() === mrId) {
        const selfMr = await Mr.findById(mrId).populate(
          "assignedDoctors",
          "name _id",
        );
        if (!selfMr || selfMr.assignedDoctors.length === 0)
          return res.status(404).json({ message: "No assigned doctors found" });
        return res.status(200).json(selfMr.assignedDoctors);
      }
      return res.status(404).json({ message: "MR not found" });
    }

    if (!mr.assignedDoctors || mr.assignedDoctors.length === 0) {
      return res.status(404).json({ message: "No assigned doctors found" });
    }

    res.status(200).json(mr.assignedDoctors);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve doctors",
      error: error.message,
    });
  }
};

export const editDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { name, specialty, areaId, dob, email, phoneNumber } = req.body;

    if (!name && !specialty && !areaId && !dob && !email && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    const updateFields = {};
    if (name) updateFields.name = name;
    if (specialty) updateFields.specialty = specialty;
    if (areaId) updateFields.areaId = areaId;
    if (dob !== undefined) {
      updateFields.dob = dob;
      updateFields.birthdayMonthDay = computeBirthdayMonthDay(dob);
    }
    if (dob !== undefined) updateFields.dob = dob;
    if (email !== undefined) updateFields.email = email;
    if (phoneNumber !== undefined) updateFields.phoneNumber = phoneNumber;

    // Multi-tenant guard: organizationId must match
    const updated = await Doctor.findOneAndUpdate(
      {
        _id: doctorId,
        organizationId: req?.organization?._id,
      },
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Doctor updated successfully",
      data: updated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A doctor with this name already exists in this area",
      });
    }
    console.error("Error updating doctor:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update doctor, try again later",
    });
  }
};

export const deleteDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const deleted = await Doctor.findOneAndDelete({
      _id: doctorId,
      organizationId: req?.organization?._id,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Doctor deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting doctor:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not delete doctor, try again later",
    });
  }
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const exportDoctors = async (req, res) => {
  try {
    if (!req?.organization?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { name, specialty, areaId, headQuarterId } = req.body;

    const filter = {
      organizationId: req.organization.id,
    };
    if (name?.trim()) {
      filter.name = { $regex: escapeRegex(name.trim()), $options: "i" };
    }
    if (specialty?.trim()) {
      filter.specialty = {
        $regex: escapeRegex(specialty.trim()),
        $options: "i",
      };
    }

    if (areaId) {
      filter.areaId = areaId;
    } else if (headQuarterId) {
      const areas = await Area.find(
        { headQuarterId, organizationId: req.organization.id },
        { _id: 1 },
      ).lean();
      filter.areaId = { $in: areas.map((a) => a._id) };
    }

    const EXPORT_CAP = 10000;
    const doctors = await Doctor.find(filter, {
      _id: 1,
      name: 1,
      specialty: 1,
      areaId: 1,
      dob: 1,
      email: 1,
      phoneNumber: 1,
    })
      .populate({
        path: "areaId",
        select: "name headQuarterId",
        populate: { path: "headQuarterId", select: "headQuarterName" },
      })
      .sort({ name: 1 })
      .limit(EXPORT_CAP)
      .lean();

    if (doctors.length === EXPORT_CAP) {
      return res.status(400).json({
        success: false,
        message: `Export limited to ${EXPORT_CAP} records. Please narrow your filters.`,
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Doctors");

    worksheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Specialty", key: "specialty", width: 20 },
      { header: "Area", key: "area", width: 25 },
      { header: "Headquarter", key: "headquarter", width: 25 },
      { header: "DOB", key: "dob", width: 15 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone Number", key: "phoneNumber", width: 18 },
    ];

    doctors.forEach((doc) => {
      worksheet.addRow({
        name: doc.name || "",
        specialty: doc.specialty || "",
        area: doc.areaId?.name || "",
        headquarter: doc.areaId?.headQuarterId?.headQuarterName || "",
        dob: doc.dob || "",
        email: doc.email || "",
        phoneNumber: doc.phoneNumber || "",
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=doctors_${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Failed to export doctors", error);
    res.status(500).json({
      success: false,
      message: "Failed to export doctors",
    });
  }
};
