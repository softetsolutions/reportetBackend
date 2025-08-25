import Doctor from "../models/Doctor.js";
import Mr from "../models/Mr.js";
import fs from 'fs';
import ExcelJS from 'exceljs';
import Area from "../models/Area.js";


export const addDoctor = async (req, res) => {
  try {
    const { doctors } = req.body;

    if (!Array.isArray(doctors) || doctors.length === 0) {
      return res.status(400).json({ message: "Please provide an array of doctors." });
    }

    const validDoctors = [];
    const skippedDoctors = [];

    // Fetch all valid areaIds once to minimize DB queries
    const areaIds = doctors.map(doc => doc.areaId).filter(id => !!id);
    const validAreaIds = new Set(
      (
        await Area.find({
          _id: { $in: areaIds },
          organizationId: req.organization._id,
        }).select("_id")
      ).map(area => area._id.toString())
    );

    for (const doc of doctors) {
      const { name, specialty, areaId } = doc;

      if (!name || !specialty || !areaId) {
        skippedDoctors.push({ ...doc, reason: "Missing required fields" });
        continue;
      }

      if (!validAreaIds.has(areaId)) {
        skippedDoctors.push({ ...doc, reason: "Invalid or unauthorized areaId" });
        continue;
      }

      validDoctors.push({
        name,
        specialty,
        areaId,
        organizationId: req.organization._id,
      });
    }

    let insertedDoctors = [];
    if (validDoctors.length > 0) {
      insertedDoctors = await Doctor.insertMany(validDoctors);
    }

    res.status(201).json({
      message: "Doctors processed successfully.",
      inserted: insertedDoctors,
      skipped: skippedDoctors,
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to add doctors",
      error: error.message,
    });
  }
};


export const assignDoctorToMR = async (req, res) => {
  try {
    const { mrId, doctorId } = req.body;

    if (!mrId || !doctorId) {
      return res
        .status(400)
        .json({ message: "mrId and doctorId are required" });
    }

    const user = await Mr.findOne({
      _id: mrId,
      organizationId: req.organization._id,
    });

    const doctor = await Doctor.findOne({
      _id: doctorId,
      organizationId: req.organization._id,
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    user.assignedDoctors.push(doctorId);
    await user.save();

    res.json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to assign doctor to MR", error: error.message });
  }
};

export const getDoctorsByAreaId = async (req, res) => {
  try {
    const { areaId } = req.params;

    const doctors = await Doctor.find({ areaId }).select("name specialty _id");

    if (doctors.length === 0) {
      return res.status(404).json({ message: "No doctors found for this area" });
    }

    res.status(200).json(doctors);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve doctors by area", error: error.message });
  }
};

export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ organizationId: req.organization._id }).select("name specialty _id");

    if (doctors.length === 0) {
      return res.status(404).json({ message: "No doctors found" });
    }
    res.status(200).json(doctors);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve doctors", error: error.message });
  }
}

export const importDoctorsFromExcel = async (req, res) => {
  try {
    const filePath = req.file.path;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1); // First sheet

    let importedCount = 0;

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const name = row.getCell(1).value?.toString().trim();
      const specialty = row.getCell(2).value?.toString().trim();
      const areaName = row.getCell(3).value?.toString().trim();

      if (!name || !specialty || !areaName) continue;

      // Find or create area
      let area = await Area.findOne({ name: areaName, organizationId: req.organization._id });
      if (!area) {
        area = await Area.create({ name: areaName, organizationId: req.organization._id });
      }

      // Add doctor
      await Doctor.create({ name, specialty, areaId: area._id, organizationId: req.organization._id });
      importedCount++;
    }

    // Clean up file
    fs.unlinkSync(filePath);

    res.status(200).json({ message: `${importedCount} doctors imported successfully.` });
  } catch (err) {
    console.error('Excel Import Error:', err);
    res.status(500).json({ message: 'Failed to import doctors from Excel file.' });
  }
};

export const getDoctorByMrId = async (req, res) => {
  try {
    const { mrId } = req.params;

    const mr = await Mr.findOne({
      _id: mrId,
      role: "mr",
      organizationId: req.organization._id
    }).populate('assignedDoctors', 'name _id');

    if (!mr) {
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