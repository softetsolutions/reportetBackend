import Area from "../models/Area.js";
import Mr from "../models/Mr.js";
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
    const areas = await Area.find({
      organizationId: req.organization._id,
    }).select("name _id");
    if (areas.length === 0) {
      return res.status(404).json({ message: "No areas found" });
    }
    res.json(areas);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve areas", error: error.message });
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

export const getAreaByMrId = async (req, res) => {
  try {
    const { mrId } = req.params;

    // If logged in as MR
    if (req.mr) {
      // MR can access their own areas only
      if (req.mr._id.toString() !== mrId) {
        return res
          .status(403)
          .json({ message: "Forbidden: Cannot access other MR's areas" });
      }
      const selfMr = await Mr.findById(mrId).populate(
        "assignedAreas",
        "name _id",
      );
      return res.status(200).json(selfMr.assignedAreas || []);
    }

    // If logged in as Organization
    if (req.organization) {
      const mr = await Mr.findOne({
        _id: mrId,
        organizationId: req.organization._id,
      }).populate("assignedAreas", "name _id");

      if (!mr) {
        return res
          .status(404)
          .json({ message: "MR not found or no assigned areas" });
      }

      return res.status(200).json(mr.assignedAreas || []);
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    console.error("Get Areas by MR ID Error:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve areas", error: error.message });
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
