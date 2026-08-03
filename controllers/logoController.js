import fs from "fs";
import path from "path";
import Organization from "../models/Organization.js";

const LOGO_DIR = path.join(process.cwd(), "uploads", "logos");

export const editBranding = async (req, res) => {
  try {
    const { brandName } = req.body;
    const orgId = req?.organization?._id;

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    const updateFields = {};
    if (brandName?.trim()) {
      updateFields.brandName = brandName.trim();
    }

    if (req.file) {
      updateFields.logoUrl = `/uploads/logos/${req.file.filename}`;
    }

    if (!Object.keys(updateFields).length) {
      return res.status(400).json({
        success: false,
        message: "Provide a brand name or logo to update",
      });
    }

    const updated = await Organization.findByIdAndUpdate(
      orgId,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).select("-password");

    if (req.file) {
      cleanupOldLogos(orgId.toString(), req.file.filename);
    }

    res.status(200).json({
      success: true,
      message: "Branding updated successfully",
      data: updated,
    });
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    console.error("Error updating branding:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update branding, try again later",
    });
  }
};

function cleanupOldLogos(orgId, newFilename) {
  fs.readdir(LOGO_DIR, (err, files) => {
    if (err) {
      console.error("Failed to read logos directory:", err.message);
      return;
    }

    files
      .filter((f) => f.startsWith(`${orgId}-`) && f !== newFilename)
      .forEach((f) => {
        fs.unlink(path.join(LOGO_DIR, f), (unlinkErr) => {
          if (unlinkErr) {
            console.error(`Failed to delete old logo ${f}:`, unlinkErr.message);
          }
        });
      });
  });
}
