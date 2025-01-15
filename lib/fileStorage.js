import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import crypto from "crypto";

export class FileStorage {
  constructor(options = {}) {
    this.baseDir =
      options.baseDir ||
      process.env.STORAGE_PATH ||
      path.join(process.cwd(), "storage");
    this.imagesDir = path.join(this.baseDir, "images");
    this.thumbnailsDir = path.join(this.baseDir, "thumbnails");
  }

  async initialize() {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(this.imagesDir, { recursive: true });
    await fs.mkdir(this.thumbnailsDir, { recursive: true });
  }

  generateFilename(plateNumber) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex");
    return `${plateNumber}_${timestamp}_${random}`;
  }

  async saveImage(base64Data, plateNumber) {
    if (!base64Data) return { imagePath: null, thumbnailPath: null };

    // Remove data URL prefix if present
    const imageData = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(imageData, "base64");

    const filename = this.generateFilename(plateNumber);
    const imagePath = path.join(this.imagesDir, `${filename}.jpg`);
    const thumbnailPath = path.join(
      this.thumbnailsDir,
      `${filename}_thumb.jpg`
    );

    // Save original image
    await sharp(buffer).jpeg({ quality: 85 }).toFile(imagePath);

    // Create and save thumbnail
    await sharp(buffer)
      .resize(200, 150, { fit: "inside" })
      .jpeg({ quality: 70 })
      .toFile(thumbnailPath);

    return {
      imagePath: path.relative(this.baseDir, imagePath),
      thumbnailPath: path.relative(this.baseDir, thumbnailPath),
    };
  }

  async getImage(imagePath) {
    const fullPath = path.join(this.baseDir, imagePath);
    try {
      const data = await fs.readFile(fullPath);
      return data;
    } catch (error) {
      console.error(`Error reading image ${fullPath}:`, error);
      return null;
    }
  }

  async deleteImage(imagePath, thumbnailPath) {
    try {
      if (imagePath) {
        await fs.unlink(path.join(this.baseDir, imagePath));
      }
      if (thumbnailPath) {
        await fs.unlink(path.join(this.baseDir, thumbnailPath));
      }
    } catch (error) {
      console.error("Error deleting image files:", error);
    }
  }
}

const fileStorage = new FileStorage();
await fileStorage.initialize();

export default fileStorage;
