import { promises as fs } from "fs";
import path from "path";
import Organization from "../models/Organization.js";

const LOGO_DIR = path.join(process.cwd(), "uploads", "logos");
const MAX_BRAND_NAME_LENGTH = 100;

async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.error(`Failed to delete file ${filePath}:`, err.message);
  }
}

export const editBranding = async (req, res) => {
  try {
    const { brandName } = req.body;
    const orgId = req?.organization?._id;

    if (!orgId) {
      if (req.file) await safeUnlink(req.file.path);
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let cleanBrandName;
    if (brandName !== undefined) {
      if (typeof brandName !== "string") {
        if (req.file) await safeUnlink(req.file.path);
        return res.status(400).json({
          success: false,
          message: "brandName must be a string",
        });
      }
      const trimmed = brandName.trim();
      if (trimmed.length > MAX_BRAND_NAME_LENGTH) {
        if (req.file) await safeUnlink(req.file.path);
        return res.status(400).json({
          success: false,
          message: `brandName must be under ${MAX_BRAND_NAME_LENGTH} characters`,
        });
      }
      if (trimmed) cleanBrandName = trimmed;
    }

    const updateFields = {};
    if (cleanBrandName) updateFields.brandName = cleanBrandName;
    if (req.file) updateFields.logoUrl = `/uploads/logos/${req.file.filename}`;

    if (!Object.keys(updateFields).length) {
      if (req.file) await safeUnlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Provide a brand name or logo to update",
      });
    }

    const updated = await Organization.findByIdAndUpdate(
      orgId,
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!updated) {
      if (req.file) await safeUnlink(req.file.path);
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    if (req.file) {
      cleanupOldLogos(orgId.toString(), req.file.filename);
    }

    res.status(200).json({
      success: true,
      message: "Branding updated successfully",
      data: updated,
    });
  } catch (error) {
    if (req.file) await safeUnlink(req.file.path);
    console.error("Error updating branding:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update branding, try again later",
    });
  }
};

export const getMyOrganization = async (req, res) => {
  try {
    const orgId = req?.organization?._id;
    if (!orgId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const org = await Organization.findById(orgId).select(
      "_id organizationName brandName logoUrl email code",
    );

    if (!org) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    res.status(200).json({ success: true, data: org });
  } catch (error) {
    console.error("Error fetching organization:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch organization details",
    });
  }
};

async function cleanupOldLogos(orgId, newFilename) {
  let files;
  try {
    files = await fs.readdir(LOGO_DIR);
  } catch (err) {
    console.error("Failed to read logos directory:", err.message);
    return;
  }

  const stale = files.filter(
    (f) => f.startsWith(`${orgId}-`) && f !== newFilename,
  );

  await Promise.all(stale.map((f) => safeUnlink(path.join(LOGO_DIR, f))));
}
