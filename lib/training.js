import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fileStorage from "@/lib/fileStorage";
import sharp from "sharp";
import { createObjectCsvWriter } from "csv-writer";
import { withClient } from "@/lib/db";
import { getConfig } from "@/lib/settings";
import os from "os";
import archiver from "archiver";
import fs_regular from "fs";

class TrainingDataGenerator {
  constructor(outputBasePath) {
    this.outputBasePath = outputBasePath;
    this.ocrPath = path.join(outputBasePath, "OCR");
    this.licensePlatePath = path.join(outputBasePath, "license-plate");
    this.stats = {
      ocr: {
        totalCount: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        minId: Infinity,
        maxId: -Infinity,
        hasValidRecords: false,
      },
      licensePlate: {
        totalCount: 0,
        verifiedCount: 0,
        unverifiedCount: 0,
        minId: Infinity,
        maxId: -Infinity,
        hasValidRecords: false,
      },
    };
  }

  async initialize() {
    try {
      // Create base directories
      await fs.mkdir(this.outputBasePath, { recursive: true });
      await fs.mkdir(this.ocrPath, { recursive: true });

      // Create license plate directories
      const validationStates = ["verified", "unverified"];
      const subDirs = ["images", "labels"];

      for (const state of validationStates) {
        for (const dir of subDirs) {
          await fs.mkdir(path.join(this.licensePlatePath, state, dir), {
            recursive: true,
          });
        }
      }
    } catch (error) {
      console.error("Error initializing directories:", error);
      throw error;
    }
  }

  async fourPointTransform(image, points) {
    try {
      const [tl, tr, br, bl] = this.orderPoints(points);

      const maxWidth = Math.max(
        this.euclideanDistance(br, bl),
        this.euclideanDistance(tr, tl)
      );

      const maxHeight = Math.max(
        this.euclideanDistance(tr, br),
        this.euclideanDistance(tl, bl)
      );

      const dstPoints = [
        { x: 0, y: 0 },
        { x: maxWidth - 1, y: 0 },
        { x: maxWidth - 1, y: maxHeight - 1 },
        { x: 0, y: maxHeight - 1 },
      ];

      return image
        .clone()
        .resize(maxWidth, maxHeight)
        .extract({
          left: Math.min(tl.x, bl.x),
          top: Math.min(tl.y, tr.y),
          width: maxWidth,
          height: maxHeight,
        });
    } catch (error) {
      console.error("Error in four point transform:", error);
      throw error;
    }
  }

  euclideanDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  orderPoints(pts) {
    try {
      const sortedX = [...pts].sort((a, b) => a[0] - b[0]);
      const leftMost = sortedX.slice(0, 2);
      const rightMost = sortedX.slice(2);

      leftMost.sort((a, b) => a[1] - b[1]);
      const [tl, bl] = leftMost;

      const distances = rightMost.map((point) =>
        this.euclideanDistance(
          { x: point[0], y: point[1] },
          { x: tl[0], y: tl[1] }
        )
      );
      const [br, tr] =
        distances[0] > distances[1]
          ? [rightMost[0], rightMost[1]]
          : [rightMost[1], rightMost[0]];

      return [tl, tr, br, bl].map((point) => ({ x: point[0], y: point[1] }));
    } catch (error) {
      console.error("Error ordering points:", error);
      throw error;
    }
  }

  async processOCRImage(imageBuffer, coordinates) {
    try {
      // coordinates should already be an array of [x1, y1, x2, y2]
      const [x1, y1, x2, y2] = coordinates;

      if (
        !Number.isInteger(x1) ||
        !Number.isInteger(y1) ||
        !Number.isInteger(x2) ||
        !Number.isInteger(y2)
      ) {
        throw new Error("Invalid coordinates format");
      }

      const image = sharp(imageBuffer);

      // Calculate width and height
      const width = x2 - x1;
      const height = y2 - y1;

      if (width <= 0 || height <= 0) {
        throw new Error("Invalid dimensions");
      }

      // Crop the image
      const croppedImage = await image.extract({
        left: x1,
        top: y1,
        width: width,
        height: height,
      });

      return croppedImage;
    } catch (error) {
      console.error("Error in processOCRImage:", error);
      throw error;
    }
  }

  async generateOCRDataset() {
    try {
      const records = await this.queryDatabase("OCR");
      if (records.length === 0) {
        console.log("No OCR records found to process");
        return;
      }

      const csvWriter = createObjectCsvWriter({
        path: path.join(this.ocrPath, "labels.csv"),
        header: [
          { id: "filepath", title: "filepath" },
          { id: "character", title: "character" },
        ],
      });

      const csvData = [];

      for (const record of records) {
        try {
          // crop_coordinates should already be an array
          if (
            !Array.isArray(record.crop_coordinates) ||
            record.crop_coordinates.length !== 4
          ) {
            console.warn(
              `Skipping record ${record.id}: Invalid crop coordinates format`
            );
            continue;
          }

          const imageBuffer = await fileStorage.getImage(record.image_path);
          if (!imageBuffer) {
            console.warn(`Skipping record ${record.id}: Image not found`);
            continue;
          }

          const processedImage = await this.processOCRImage(
            imageBuffer,
            record.crop_coordinates
          );

          const filename = `${uuidv4()}.jpg`;
          const outputPath = path.join(this.ocrPath, filename);

          await processedImage.toFile(outputPath);
          csvData.push({
            filepath: filename,
            character: record.plate_number,
          });
        } catch (error) {
          console.error(`Error processing record ${record.id}:`, error);
          continue;
        }
      }

      if (csvData.length > 0) {
        await csvWriter.writeRecords(csvData);
        console.log(`Successfully processed ${csvData.length} OCR records`);
      } else {
        console.warn("No records were successfully processed");
      }
    } catch (error) {
      console.error("Error generating OCR dataset:", error);
      throw error;
    }
  }

  async generateLicensePlateDataset() {
    if (!this.stats.licensePlate.hasValidRecords) {
      console.warn(
        "Skipping license plate dataset generation - no valid records found"
      );
      return;
    }

    try {
      const records = await this.queryDatabase("license-plate");

      for (const record of records) {
        try {
          if (!record.plate_annotation) {
            console.warn(
              `Skipping record ${record.id}: Missing plate annotation`
            );
            continue;
          }

          const subDir = record.validated ? "verified" : "unverified";
          const filename = `${uuidv4()}`;

          const imageBuffer = await fileStorage.getImage(record.image_path);
          if (!imageBuffer) {
            console.warn(`Skipping record ${record.id}: Image not found`);
            continue;
          }

          await fs.writeFile(
            path.join(
              this.licensePlatePath,
              subDir,
              "images",
              `${filename}.jpg`
            ),
            imageBuffer
          );

          const annotations = record.plate_annotation.split("&");
          await fs.writeFile(
            path.join(
              this.licensePlatePath,
              subDir,
              "labels",
              `${filename}.txt`
            ),
            annotations.join("\n")
          );
        } catch (error) {
          console.error(
            `Error processing license plate record ${record.id}:`,
            error
          );
          continue;
        }
      }
    } catch (error) {
      console.error("Error generating license plate dataset:", error);
      throw error;
    }
  }

  async getLastTrainingRecord() {
    return withClient(async (client) => {
      const result = await client.query(`
        SELECT training_last_record 
        FROM devmgmt 
        LIMIT 1
      `);
      return result.rows[0]?.training_last_record || 0;
    });
  }

  async updateLastTrainingRecord(lastId) {
    return withClient(async (client) => {
      await client.query(
        `
        UPDATE devmgmt 
        SET training_last_record = $1
      `,
        [lastId]
      );
    });
  }

  async validateData() {
    return withClient(async (client) => {
      console.log("Running validation checks...");

      // Debug query to see actual data
      const debugQuery = `
        SELECT id, plate_number, crop_coordinates, plate_annotation, image_path
        FROM plate_reads 
        WHERE (crop_coordinates IS NOT NULL AND array_length(crop_coordinates, 1) > 0)
           OR (plate_annotation IS NOT NULL AND plate_annotation != '')
        LIMIT 5
      `;
      const debugResult = await client.query(debugQuery);
      console.log("Sample of records with annotations:", debugResult.rows);

      // Check OCR data
      const ocrQuery = `
        SELECT COUNT(*) as count 
        FROM plate_reads 
        WHERE crop_coordinates IS NOT NULL 
          AND array_length(crop_coordinates, 1) = 4
          AND image_path IS NOT NULL
          AND image_path != ''
      `;
      const ocrResult = await client.query(ocrQuery);
      const hasOcrData = parseInt(ocrResult.rows[0].count) > 0;
      console.log("OCR data count:", ocrResult.rows[0].count);

      // Check license plate data
      const plateQuery = `
        SELECT COUNT(*) as count 
        FROM plate_reads 
        WHERE plate_annotation IS NOT NULL 
          AND plate_annotation != ''
          AND image_path IS NOT NULL
          AND image_path != ''
      `;
      const plateResult = await client.query(plateQuery);
      const hasPlateData = parseInt(plateResult.rows[0].count) > 0;
      console.log("License plate data count:", plateResult.rows[0].count);

      // Update our stats
      this.stats.ocr.hasValidRecords = hasOcrData;
      this.stats.licensePlate.hasValidRecords = hasPlateData;

      if (!hasOcrData && !hasPlateData) {
        console.warn(
          "No valid training data found. Please update your AI and Blue Iris action to capture annotation data."
        );
        return false;
      }

      return { hasOcrData, hasPlateData };
    });
  }

  async queryDatabase(modelType) {
    return withClient(async (client) => {
      const lastRecord = await this.getLastTrainingRecord();
      console.log(`Querying ${modelType} records after ID ${lastRecord}`);

      const baseQuery = `
        SELECT 
          id, plate_number, image_path, crop_coordinates,
          plate_annotation, ocr_annotation, validated
        FROM plate_reads
        WHERE image_path IS NOT NULL
          AND image_path != ''
          AND id > $1
      `;

      // Add specific conditions based on model type
      const modelCondition =
        modelType === "OCR"
          ? "AND crop_coordinates IS NOT NULL AND array_length(crop_coordinates, 1) = 4"
          : "AND plate_annotation IS NOT NULL AND plate_annotation != ''";

      const query = baseQuery + modelCondition + " ORDER BY id ASC";
      console.log(`${modelType} query:`, query);

      const result = await client.query(query, [lastRecord]);

      console.log(`Found ${result.rows.length} ${modelType} records`);
      if (result.rows.length > 0) {
        console.log(`First ${modelType} record:`, result.rows[0]);
      }

      // Update stats for the specific model type
      const stats =
        modelType === "OCR" ? this.stats.ocr : this.stats.licensePlate;
      stats.totalCount = result.rows.length;
      stats.verifiedCount = result.rows.filter((r) => r.validated).length;
      stats.unverifiedCount = result.rows.filter((r) => !r.validated).length;
      stats.hasValidRecords = result.rows.length > 0;

      if (result.rows.length > 0) {
        stats.minId = Math.min(...result.rows.map((r) => r.id));
        stats.maxId = Math.max(...result.rows.map((r) => r.id));
      }

      return result.rows;
    });
  }

  async compressDirectory(dirPath, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs_regular.createWriteStream(outputPath);
      const archive = archiver("zip", {
        zlib: { level: 9 },
      });

      output.on("close", () => resolve());
      archive.on("error", reject);

      archive.pipe(output);
      archive.directory(dirPath, false);
      archive.finalize();
    });
  }

  async uploadToCloud(modelType, zipPath) {
    try {
      const stats =
        modelType === "OCR" ? this.stats.ocr : this.stats.licensePlate;

      if (!stats.hasValidRecords) {
        console.warn(
          `Skipping ${modelType} upload - no valid records generated`
        );
        return;
      }

      const config = await getConfig();
      const userName = config.training?.name || "unknown";
      const identifier = `${userName}@${os.hostname()}`;

      const metadata = {
        model_type: modelType === "OCR" ? "ocr" : "plate",
        total_count: stats.totalCount,
        verified_count: stats.verifiedCount,
        unverified_count: stats.unverifiedCount,
        record_range: `${stats.minId}-${stats.maxId}`,
        user_name: userName,
      };

      const initResponse = await fetch(
        "https://alpr-training.algertc.workers.dev/api/training/init",
        {
          method: "POST",
          headers: {
            "x-machine-identifier": identifier,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initResponse.ok) {
        throw new Error(
          `Failed to initialize upload: ${await initResponse.text()}`
        );
      }

      const { url: signedUrl } = await initResponse.json();

      const fileStream = await fs.readFile(zipPath);
      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        body: fileStream,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Failed to upload file: ${await uploadResponse.text()}`
        );
      }

      await this.updateLastTrainingRecord(stats.maxId);
      return true;
    } catch (error) {
      console.error("Error uploading to cloud:", error);
      throw error;
    }
  }

  async generateAndUpload() {
    try {
      const validationResult = await this.validateData();
      if (!validationResult) {
        console.log("No valid data found for training");
        return;
      }

      const { hasOcrData, hasPlateData } = validationResult;

      await this.initialize();

      // Process OCR data if available
      if (hasOcrData) {
        await this.generateOCRDataset();
        if (this.stats.ocr.hasValidRecords) {
          const ocrZipPath = path.join(this.outputBasePath, "ocr_dataset.zip");
          await this.compressDirectory(this.ocrPath, ocrZipPath);
          await this.uploadToCloud("OCR", ocrZipPath);
          await fs.unlink(ocrZipPath);
        }
      } else {
        console.log("Skipping OCR dataset - no valid data");
      }

      // Process license plate data if available
      if (hasPlateData) {
        await this.generateLicensePlateDataset();
        if (this.stats.licensePlate.hasValidRecords) {
          const lpZipPath = path.join(
            this.outputBasePath,
            "license_plate_dataset.zip"
          );
          await this.compressDirectory(this.licensePlatePath, lpZipPath);
          await this.uploadToCloud("license-plate", lpZipPath);
          await fs.unlink(lpZipPath);
        }
      } else {
        console.log("Skipping license plate dataset - no valid data");
      }

      // Cleanup
      try {
        await fs.rm(this.ocrPath, { recursive: true, force: true });
        await fs.rm(this.licensePlatePath, { recursive: true, force: true });
      } catch (err) {
        console.warn("Cleanup error:", err);
      }
    } catch (error) {
      console.error("Error in generate and upload:", error);
      throw error;
    }
  }
}

export default TrainingDataGenerator;

// Usage example:
// const generator = new TrainingDataGenerator('./training_data');
// await generator.generate();
