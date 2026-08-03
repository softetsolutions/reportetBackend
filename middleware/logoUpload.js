import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: "uploads/logos/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.organization._id}-${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only PNG, JPEG, SVG, or WEBP logos are allowed"));
};

export const logoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});
