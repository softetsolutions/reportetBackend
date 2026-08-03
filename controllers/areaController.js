import Area from "../models/Area.js";
import Employee from "../models/Employee.js";
import HeadQuarter from "../models/HeadQuarter.js";
import Doctor from "../models/Doctor.js";
import { getCellStringValue } from "../utils/helperFunction.js";

import fs from "fs";
import ExcelJS from "exceljs";

export const addArea = async (req, res) => {
  try {
    // const sampleAreaData = {
    //   //key should be area name, then followed by the values of it
    //   varanasi:{
    //     headQuarterId:""
    //     // ...other details for future
    //   }
    // }

    const { areaData } = req.body;

    const areasArray = Object.keys(areaData).map((areaName) => ({
      name: areaName,
      organizationId: req.organization._id,
      headQuarterId: areaData[areaName].headQuarterId,
    }));

    const dbAcknowledge = await Area.insertMany(areasArray, { ordered: false });

    res.status(201).json({
      success: true,
      inserted: dbAcknowledge,
      message: "Successfully added all records",
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
      success: false,
      message: "Failed to add areas",
      error: error.message,
    });
  }
};

export const getAreas = async (req, res) => {
  try {
    const pageNo = Number(req.body.pageNo) || 1;
    const limit = Number(req.body.limit) || 5;
    const { name, headQuarterName } = req.body;

    const filter = {
      organizationId: req?.organization?.id,
    };

    if (name?.trim()) {
      filter.name = { $regex: name.trim(), $options: "i" };
    }

    if (headQuarterName?.trim()) {
      const matchingHQs = await HeadQuarter.find(
        {
          headQuarterName: { $regex: headQuarterName.trim(), $options: "i" },
          organizationId: req?.organization?.id,
        },
        { _id: 1 },
      );

      const hqIds = matchingHQs.map((hq) => hq._id);
      filter.headQuarterId = { $in: hqIds };
    }
    const [areas, totalAreaCount] = await Promise.all([
      Area.find(
        filter,
        {
          _id: 1,
          name: 1,
          headQuarterId: 1,
        },
        {
          skip: (pageNo - 1) * limit,
          limit,
        },
      ).populate("headQuarterId", "_id headQuarterName"),
      Area.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      areas,
      areasCount: totalAreaCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve areas",
      error: error.message,
    });
  }
};

export const getAreaById = async (req, res) => {
  try {
    const area = await Area.findById(req.params.id).select("name _id");
    if (!area) {
      return res.status(404).json({ message: "Area not found" });
    }
    res.json(area);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve area", error: error.message });
  }
};

export const importAreasFromExcel = async (req, res) => {
  const filePath = req.file?.path;
  try {
    const {
      sheetNo = 0,
      rowNumber = 2,
      areaColumnName = "Area Name",
      headQuarterColumnName = "Headquarter Name",
    } = req?.body;
    const organizationId = req?.organization?._id;

    const escapeRegex = (value) =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[sheetNo];
    if (!worksheet) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "Invalid sheet number",
      });
    }

    const areaRows = [];
    const skippedRows = [];
    const fileDuplicateAreas = [];

    const seenAreaKeys = new Map();

    worksheet.eachRow({ includeEmpty: false }, (row, number) => {
      if (number < rowNumber) return;

      const areaName = getCellStringValue(row.getCell(2).value);
      const headQuarterName = getCellStringValue(row.getCell(3).value);

      if (!areaName || !headQuarterName) {
        skippedRows.push({
          row: number,
          reason: !areaName ? "Missing area name" : "Missing headquarter name",
        });
        return;
      }

      const areaKey = `${headQuarterName.trim().toUpperCase()}::${areaName
        .trim()
        .toUpperCase()}`;

      if (seenAreaKeys.has(areaKey)) {
        const first = seenAreaKeys.get(areaKey);
        fileDuplicateAreas.push({
          row: number,
          name: areaName,
          headquarter: headQuarterName,
          reason: `Duplicate of row ${first.row} in this file (same area under same headquarter)`,
        });
        return;
      }
      seenAreaKeys.set(areaKey, { row: number });

      areaRows.push({ areaName, headQuarterName, row: number });
    });

    fs.unlinkSync(filePath);

    if (!areaRows.length) {
      return res.status(400).json({
        success: false,
        message: "No valid area rows found in the sheet",
        skippedRows,
        duplicates: { areas: fileDuplicateAreas },
      });
    }

    const uniqueHQNames = [...new Set(areaRows.map((r) => r.headQuarterName))];
    const hqQuery = uniqueHQNames.map((name) => ({
      headQuarterName: {
        $regex: new RegExp(`^${escapeRegex(name)}$`, "i"),
      },
    }));

    const matchingHQs = await HeadQuarter.find({
      organizationId,
      $or: hqQuery,
    }).select("_id headQuarterName");

    const hqNameToId = matchingHQs.reduce((acc, hq) => {
      acc[hq.headQuarterName.toUpperCase()] = hq._id;
      return acc;
    }, {});

    const unmatchedHQs = [];
    const candidateAreas = [];

    areaRows.forEach((row) => {
      const hqId = hqNameToId[row.headQuarterName.toUpperCase()];
      if (!hqId) {
        unmatchedHQs.push(row);
        skippedRows.push({
          row: row.row,
          reason: `Headquarter "${row.headQuarterName}" not found in this organization`,
        });
        return;
      }
      candidateAreas.push({
        name: row.areaName,
        headQuarterId: hqId,
        organizationId,
        _row: row.row,
        _hqName: row.headQuarterName,
      });
    });

    const areaNamesByHQ = candidateAreas.reduce((acc, a) => {
      const key = String(a.headQuarterId);
      if (!acc[key]) acc[key] = new Set();
      acc[key].add(a.name.trim().toUpperCase());
      return acc;
    }, {});

    const existingAreaOrClauses = Object.entries(areaNamesByHQ).map(
      ([hqId, names]) => ({
        headQuarterId: hqId,
        $or: [...names].map((name) => ({
          name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") },
        })),
      }),
    );

    const existingAreasInDB = existingAreaOrClauses.length
      ? await Area.find({ organizationId, $or: existingAreaOrClauses })
      : [];

    const existingAreaKeys = new Set(
      existingAreasInDB.map(
        (a) => `${String(a.headQuarterId)}::${a.name.trim().toUpperCase()}`,
      ),
    );

    const dbDuplicateAreas = [];
    const areasToInsert = [];

    candidateAreas.forEach((a) => {
      const key = `${String(a.headQuarterId)}::${a.name.trim().toUpperCase()}`;
      if (existingAreaKeys.has(key)) {
        dbDuplicateAreas.push({
          row: a._row,
          name: a.name,
          headquarter: a._hqName,
          reason: "This area already exists under this headquarter",
        });
        return;
      }
      const { _row, _hqName, ...toInsert } = a;
      areasToInsert.push(toInsert);
    });

    let insertedCount = 0;

    if (areasToInsert.length) {
      try {
        const inserted = await Area.insertMany(areasToInsert, {
          ordered: false,
        });
        insertedCount = inserted.length;
      } catch (error) {
        insertedCount =
          error.insertedDocs?.length || error.result?.nInserted || 0;
      }
    }

    const duplicateAreas = [...fileDuplicateAreas, ...dbDuplicateAreas];

    res.status(200).json({
      success: true,
      message: `${insertedCount} area(s) imported successfully.${
        duplicateAreas.length
          ? ` ${duplicateAreas.length} duplicate row(s) were skipped.`
          : ""
      }`,
      summary: {
        insertedCount,
        skippedDuplicateCount: duplicateAreas.length,
        skippedRowCount: skippedRows.length,
      },
      duplicates: {
        areas: duplicateAreas,
      },
      skippedRows,
      skippedDueToUnmatchedHeadquarter: unmatchedHQs,
    });
  } catch (err) {
    console.error("Area Import Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to import areas from Excel file.",
    });
  } finally {
    if (filePath) {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr)
          console.error("Failed to delete uploaded file:", unlinkErr.message);
      });
    }
  }
};
export const getAreasByHeadQuarterId = async (req, res) => {
  try {
    const areas = await Area.find(
      {
        organizationId: req.organization?.id,
        headQuarterId: req?.params?.id,
      },
      {
        name: 1,
        _id: 1,
      },
    );

    res.status(200).json({
      success: true,
      data: areas,
    });
  } catch (error) {
    console.error("Problem in geting areas by headquarter id", error);
    res.status(500).json({
      message: "Failed to retrive area by headQuarter id",
      error: error.message,
    });
  }
};

export const getEmployeeAssignedAreas = async (req, res) => {
  try {
    if (req?.employee) {
      if (!req?.employee?.assignedHeadQuarters?.length) {
        res.status(200).json({
          success: true,
          assignedAreas: [],
        });
      }

      const assignedAreas = await Area.find(
        {
          _id: { $in: req?.employee?.assignedHeadQuarters },
        },
        {
          _id: 1,
          name: 1,
        },
      );

      res.status(200).json({
        success: true,
        assignedAreas: assignedAreas,
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
          assignedDoctors: 0,
          assignedHeadQuarters: 0,
          createdAt: 0,
          updatedAt: 0,
          __v: 0,
        },
      ).populate("assignedDoctors", "_id name");

      res?.status(200).json({
        success: true,
        assignedAreas: employeeDetail?.assignedDoctors,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to get the employee assigned area.",
    });
  }
};

export const editArea = async (req, res) => {
  try {
    const { areaId } = req.params;
    const { name, headQuarterId } = req.body;

    if (!name && !headQuarterId) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    const updateFields = {};
    if (name) updateFields.name = name;
    if (headQuarterId) updateFields.headQuarterId = headQuarterId;

    // Multi-tenant guard: organizationId must match
    const updated = await Area.findOneAndUpdate(
      {
        _id: areaId,
        organizationId: req?.organization?._id,
      },
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Area not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Area updated successfully",
      data: updated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An area with this name already exists in this headquarter",
      });
    }
    console.error("Error updating area:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update area, try again later",
    });
  }
};

export const deleteArea = async (req, res) => {
  try {
    const { areaId } = req.params;
    const { force } = req.query;

    console.log("force param:", req.query.force, typeof req.query.force);
    const linkedDoctorCount = await Doctor.countDocuments({ areaId });

    if (linkedDoctorCount > 0 && force !== "true") {
      return res.status(409).json({
        success: false,
        hasLinkedDoctors: true,
        doctorCount: linkedDoctorCount,
        message: `This area has ${linkedDoctorCount} doctor(s) assigned to it.`,
      });
    }
    if (linkedDoctorCount > 0 && force === "true") {
      await Doctor.deleteMany({ areaId });
    }

    const deleted = await Area.findOneAndDelete({
      _id: areaId,
      organizationId: req?.organization?._id,
    });
    console.log("force param:", req.query.force, typeof req.query.force);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Area not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Area deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting area:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not delete area, try again later",
    });
  }
};
