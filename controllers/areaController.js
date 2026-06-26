import Area from "../models/Area.js";
import Employee from "../models/Employee.js";
import HeadQuarter from "../models/HeadQuarter.js";

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
    const {name,headQuarterName}=req.body

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
        { _id: 1 }
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
  try {
    const filePath = req.file.path;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);

    let importedCount = 0;

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const name = row.getCell(1).value?.toString().trim();

      if (!name) continue;

      const existing = await Area.findOne({
        name,
        organizationId: req.organization._id,
      });
      if (!existing) {
        await Area.create({ name, organizationId: req.organization._id });
        importedCount++;
      }
    }

    fs.unlinkSync(filePath);

    res
      .status(200)
      .json({ message: `${importedCount} areas imported successfully.` });
  } catch (err) {
    console.error("Area Import Error:", err);
    res
      .status(500)
      .json({ message: "Failed to import areas from Excel file." });
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