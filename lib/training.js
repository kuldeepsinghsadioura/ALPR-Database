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
const canvas = require("canvas");
const { createCanvas, loadImage } = canvas;

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
      await fs.mkdir(this.outputBasePath, { recursive: true });

      // Create OCR directories with validated/unvalidated subdirectories
      await fs.mkdir(this.ocrPath, { recursive: true });
      await fs.mkdir(path.join(this.ocrPath, "validated"), { recursive: true });
      await fs.mkdir(path.join(this.ocrPath, "unvalidated"), {
        recursive: true,
      });

      // Create license plate directories
      await fs.mkdir(this.licensePlatePath, { recursive: true });
      await fs.mkdir(path.join(this.licensePlatePath, "images"), {
        recursive: true,
      });
      await fs.mkdir(path.join(this.licensePlatePath, "labels"), {
        recursive: true,
      });
    } catch (error) {
      console.error(
        `\x1b[33m[AI TRAINING]\x1b[0m Error \x1b[31minitializing directories\x1b[0m:`,
        error
      );
      throw error;
    }
  }

  euclideanDistance(p1, p2) {
    return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
  }

  orderPoints(pts) {
    pts.sort((a, b) => a[0] - b[0]);

    let leftMost = pts.slice(0, 2).sort((a, b) => a[1] - b[1]);
    let rightMost = pts.slice(2, 4);

    let [tl, bl] = leftMost;
    let distances = rightMost.map((p) => this.euclideanDistance(p, tl));
    let rightIndices = [0, 1].sort((a, b) => distances[b] - distances[a]);

    let br = rightMost[rightIndices[0]];
    let tr = rightMost[rightIndices[1]];

    return [tl, tr, br, bl];
  }

  multiplyMatrices(a, b) {
    const rowsA = a.length;
    const colsA = a[0].length;
    const rowsB = b.length;
    const colsB = b[0].length;
    const result = new Array(rowsA);

    for (let i = 0; i < rowsA; i++) {
      result[i] = new Array(colsB);
      for (let j = 0; j < colsB; j++) {
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }

    return result;
  }

  crossProduct(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  getPerspectiveTransform(src, dst) {
    const A = Array(8)
      .fill()
      .map(() => Array(8).fill(0));
    const b = Array(8).fill(0);

    for (let i = 0; i < 4; i++) {
      const [srcX, srcY] = src[i];
      const [dstX, dstY] = dst[i];

      A[i][0] = srcX;
      A[i][1] = srcY;
      A[i][2] = 1;
      A[i][6] = -srcX * dstX;
      A[i][7] = -srcY * dstX;

      A[i + 4][3] = srcX;
      A[i + 4][4] = srcY;
      A[i + 4][5] = 1;
      A[i + 4][6] = -srcX * dstY;
      A[i + 4][7] = -srcY * dstY;

      b[i] = dstX;
      b[i + 4] = dstY;
    }

    for (let i = 0; i < 8; i++) {
      let maxRow = i;
      for (let j = i + 1; j < 8; j++) {
        if (Math.abs(A[j][i]) > Math.abs(A[maxRow][i])) {
          maxRow = j;
        }
      }

      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];

      for (let j = i + 1; j < 8; j++) {
        const factor = A[j][i] / A[i][i];
        b[j] -= factor * b[i];
        for (let k = i; k < 8; k++) {
          A[j][k] -= factor * A[i][k];
        }
      }
    }

    const h = Array(9).fill(0);
    h[8] = 1;

    for (let i = 7; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < 8; j++) {
        sum -= A[i][j] * h[j];
      }
      h[i] = sum / A[i][i];
    }

    return [
      [h[0], h[1], h[2]],
      [h[3], h[4], h[5]],
      [h[6], h[7], h[8]],
    ];
  }

  transformPoint(matrix, point) {
    const [x, y] = point;
    const z = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2];

    if (Math.abs(z) < 1e-10) return null;

    return [
      (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2]) / z,
      (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2]) / z,
    ];
  }

  async fourPointTransform(imageBuffer, points) {
    try {
      const image = await loadImage(imageBuffer);

      const orderedPoints = this.orderPoints(points);
      const [tl, tr, br, bl] = orderedPoints;

      const widthTop = this.euclideanDistance(tr, tl);
      const widthBottom = this.euclideanDistance(br, bl);
      const maxWidth = Math.max(Math.floor(widthTop), Math.floor(widthBottom));

      const heightLeft = this.euclideanDistance(bl, tl);
      const heightRight = this.euclideanDistance(br, tr);
      const maxHeight = Math.max(
        Math.floor(heightLeft),
        Math.floor(heightRight)
      );

      const dst = [
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1],
      ];

      const matrix = this.getPerspectiveTransform(orderedPoints, dst);

      const dstCanvas = createCanvas(maxWidth, maxHeight);
      const dstCtx = dstCanvas.getContext("2d");

      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Transform matrix for image: ${matrix}`
      );

      const srcCanvas = createCanvas(image.width, image.height);
      const srcCtx = srcCanvas.getContext("2d");
      srcCtx.drawImage(image, 0, 0);

      for (let y = 0; y < maxHeight; y++) {
        for (let x = 0; x < maxWidth; x++) {
          const invMatrix = this.getPerspectiveTransform(dst, orderedPoints);

          const srcPoint = this.transformPoint(invMatrix, [x, y]);

          if (!srcPoint) continue;

          const [srcX, srcY] = srcPoint;

          if (
            srcX < 0 ||
            srcX >= image.width ||
            srcY < 0 ||
            srcY >= image.height
          ) {
            continue;
          }

          const pixel = srcCtx.getImageData(
            Math.floor(srcX),
            Math.floor(srcY),
            1,
            1
          ).data;

          dstCtx.fillStyle = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${
            pixel[3] / 255
          })`;
          dstCtx.fillRect(x, y, 1, 1);
        }
      }

      const buffer = dstCanvas.toBuffer("image/jpeg");

      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Four point transform \x1b[32mcompleted\x1b[0m: ${maxWidth}x${maxHeight}`
      );

      return buffer;
    } catch (error) {
      console.error(
        `\x1b[33m[AI TRAINING]\x1b[0m \x1b[31mError in fourPointTransform\x1b[0m:`,
        error
      );

      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Falling back to \x1b[35moriginal image\x1b[0m`
      );
      return imageBuffer;
    }
  }

  async processOCRImage(imageBuffer, cropCoordinates, ocrAnnotation) {
    try {
      if (!Array.isArray(cropCoordinates) || cropCoordinates.length !== 4) {
        throw new Error("Invalid crop coordinates format");
      }

      const [x1, y1, x2, y2] = cropCoordinates;

      if (
        !Number.isInteger(x1) ||
        !Number.isInteger(y1) ||
        !Number.isInteger(x2) ||
        !Number.isInteger(y2)
      ) {
        throw new Error("Invalid crop coordinate values");
      }

      const cropLeft = Math.min(x1, x2);
      const cropTop = Math.min(y1, y2);
      const cropWidth = Math.abs(x2 - x1);
      const cropHeight = Math.abs(y2 - y1);

      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Step 1: Cropping image to \x1b[36m${cropWidth}x${cropHeight}\x1b[0m at position \x1b[36m${cropLeft},${cropTop}\x1b[0m`
      );

      const plateImage = await sharp(imageBuffer)
        .extract({
          left: cropLeft,
          top: cropTop,
          width: cropWidth,
          height: cropHeight,
        })
        .toBuffer();

      if (
        !ocrAnnotation ||
        !Array.isArray(ocrAnnotation) ||
        ocrAnnotation.length === 0
      ) {
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m No OCR annotation found, returning \x1b[36mcropped plate\x1b[0m`
        );
        return sharp(plateImage)
          .grayscale()
          .normalize()
          .sharpen()
          .withMetadata();
      }

      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Found ocr_annotation, length: \x1b[36m${
          ocrAnnotation.length
        }\x1b[0m, type: \x1b[36m${typeof ocrAnnotation}\x1b[0m`
      );
      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m ocr_annotation[0]: ${JSON.stringify(
          ocrAnnotation[0]
        )}`
      );

      const firstAnnotation = ocrAnnotation[0];

      if (!Array.isArray(firstAnnotation) || firstAnnotation.length < 2) {
        throw new Error("Invalid OCR annotation format");
      }

      const quadPoints = firstAnnotation[0];

      if (!Array.isArray(quadPoints) || quadPoints.length !== 4) {
        throw new Error("Invalid quadrilateral points");
      }

      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Step 2: Applying \x1b[36mperspective transform\x1b[0m with points: ${JSON.stringify(
          quadPoints
        )}`
      );

      const transformedBuffer = await this.fourPointTransform(
        plateImage,
        quadPoints
      );

      return sharp(transformedBuffer)
        .grayscale()
        .normalize()
        .sharpen()
        .withMetadata();
    } catch (error) {
      console.error(
        `\x1b[33m[AI TRAINING]\x1b[0m \x1b[31mError in processOCRImage\x1b[0m:`,
        error
      );
      throw error;
    }
  }

  async generateOCRDataset() {
    try {
      const records = await this.queryDatabase("OCR");
      if (records.length === 0) {
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m \x1b[33mNo OCR records found to process\x1b[0m`
        );
        return;
      }

      // Create separate CSV writers for validated and unvalidated records
      const validatedCsvWriter = createObjectCsvWriter({
        path: path.join(this.ocrPath, "validated", "labels.csv"),
        header: [
          { id: "filepath", title: "filepath" },
          { id: "character", title: "character" },
        ],
      });

      const unvalidatedCsvWriter = createObjectCsvWriter({
        path: path.join(this.ocrPath, "unvalidated", "labels.csv"),
        header: [
          { id: "filepath", title: "filepath" },
          { id: "character", title: "character" },
        ],
      });

      const validatedCsvData = [];
      const unvalidatedCsvData = [];
      const batchSize = 5;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m Processing OCR batch \x1b[36m${
            Math.floor(i / batchSize) + 1
          }\x1b[0m of \x1b[36m${Math.ceil(records.length / batchSize)}\x1b[0m`
        );

        for (const record of batch) {
          try {
            if (
              !Array.isArray(record.crop_coordinates) ||
              record.crop_coordinates.length !== 4
            ) {
              console.warn(
                `\x1b[33m[AI TRAINING]\x1b[0m Skipping record \x1b[36m${record.id}\x1b[0m: \x1b[33mInvalid crop coordinates\x1b[0m`
              );
              continue;
            }

            let ocrAnnotation = null;
            if (record.ocr_annotation) {
              try {
                let parsed;
                if (typeof record.ocr_annotation === "string") {
                  parsed = JSON.parse(record.ocr_annotation);
                } else {
                  parsed = record.ocr_annotation;
                }

                console.log(
                  `\x1b[33m[AI TRAINING]\x1b[0m OCR annotation for record \x1b[36m${
                    record.id
                  }\x1b[0m: ${JSON.stringify(parsed)}`
                );

                if (parsed && parsed.ocr_annotation) {
                  ocrAnnotation = parsed.ocr_annotation;
                  console.log(
                    `\x1b[33m[AI TRAINING]\x1b[0m Using nested ocr_annotation: ${JSON.stringify(
                      ocrAnnotation
                    )}`
                  );
                } else {
                  ocrAnnotation = parsed;
                }
              } catch (parseError) {
                console.warn(
                  `\x1b[33m[AI TRAINING]\x1b[0m \x1b[33mError parsing OCR annotation\x1b[0m for record \x1b[36m${record.id}\x1b[0m:`,
                  parseError
                );
              }
            }

            const imageBuffer = await fileStorage.getImage(record.image_path);
            if (!imageBuffer) {
              console.warn(
                `\x1b[33m[AI TRAINING]\x1b[0m Skipping record \x1b[36m${record.id}\x1b[0m: \x1b[33mImage not found\x1b[0m`
              );
              continue;
            }

            console.log(
              `\x1b[33m[AI TRAINING]\x1b[0m Processing record \x1b[36m${record.id}\x1b[0m`
            );

            if (!ocrAnnotation) {
              console.log(
                `\x1b[33m[AI TRAINING]\x1b[0m Skipping record \x1b[36m${record.id}\x1b[0m: \x1b[33mNo valid OCR annotation\x1b[0m`
              );
              continue;
            }

            const processedImage = await this.processOCRImage(
              imageBuffer,
              record.crop_coordinates,
              ocrAnnotation
            );

            const filename = `${uuidv4()}.jpg`;

            // Determine the folder based on validation status
            const targetFolder = record.validated ? "validated" : "unvalidated";
            const outputFilePath = path.join(
              this.ocrPath,
              targetFolder,
              filename
            );

            await processedImage.toFile(outputFilePath);
            console.log(
              `\x1b[33m[AI TRAINING]\x1b[0m Saved processed image for record \x1b[36m${record.id}\x1b[0m to \x1b[32m${targetFolder}/${filename}\x1b[0m`
            );

            // Add to the appropriate CSV data array
            const csvEntry = {
              filepath: filename,
              character: record.plate_number,
            };

            if (record.validated) {
              validatedCsvData.push(csvEntry);
            } else {
              unvalidatedCsvData.push(csvEntry);
            }
          } catch (error) {
            console.error(
              `\x1b[33m[AI TRAINING]\x1b[0m \x1b[31mError processing record ${record.id}\x1b[0m:`,
              error
            );
            continue;
          }
        }
      }

      // Write CSV files if there's data
      if (validatedCsvData.length > 0) {
        await validatedCsvWriter.writeRecords(validatedCsvData);
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m \x1b[32mSuccessfully processed ${validatedCsvData.length} validated OCR records\x1b[0m`
        );
      } else {
        console.warn(
          `\x1b[33m[AI TRAINING]\x1b[0m \x1b[33mNo validated records were successfully processed\x1b[0m`
        );
      }

      if (unvalidatedCsvData.length > 0) {
        await unvalidatedCsvWriter.writeRecords(unvalidatedCsvData);
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m \x1b[32mSuccessfully processed ${unvalidatedCsvData.length} unvalidated OCR records\x1b[0m`
        );
      } else {
        console.warn(
          `\x1b[33m[AI TRAINING]\x1b[0m \x1b[33mNo unvalidated records were successfully processed\x1b[0m`
        );
      }
    } catch (error) {
      console.error(
        `\x1b[33m[AI TRAINING]\x1b[0m \x1b[31mError generating OCR dataset\x1b[0m:`,
        error
      );
      throw error;
    }
  }

  async generateLicensePlateDataset() {
    if (!this.stats.licensePlate.hasValidRecords) {
      console.warn(
        `\x1b[33m[AI TRAINING]\x1b[0m \x1b[33mSkipping license plate dataset generation - no valid records found\x1b[0m`
      );
      return;
    }

    try {
      const records = await this.queryDatabase("license-plate");
      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Processing \x1b[36m${records.length}\x1b[0m license plate records`
      );

      for (const record of records) {
        try {
          if (!record.plate_annotation) {
            console.warn(
              `\x1b[33m[AI TRAINING]\x1b[0m Skipping record \x1b[36m${record.id}\x1b[0m: \x1b[33mMissing plate annotation\x1b[0m`
            );
            continue;
          }

          const filename = `${uuidv4()}`;
          const imageBuffer = await fileStorage.getImage(record.image_path);

          if (!imageBuffer) {
            console.warn(
              `\x1b[33m[AI TRAINING]\x1b[0m Skipping record \x1b[36m${record.id}\x1b[0m: \x1b[33mImage not found\x1b[0m`
            );
            continue;
          }

          await fs.writeFile(
            path.join(this.licensePlatePath, "images", `${filename}.jpg`),
            imageBuffer
          );

          const annotations = record.plate_annotation.split("&");
          await fs.writeFile(
            path.join(this.licensePlatePath, "labels", `${filename}.txt`),
            annotations.join("\n")
          );
        } catch (error) {
          console.error(
            `\x1b[33m[AI TRAINING]\x1b[0m \x1b[31mError processing license plate record ${record.id}\x1b[0m:`,
            error
          );
          continue;
        }
      }
    } catch (error) {
      console.error(
        `\x1b[33m[AI TRAINING]\x1b[0m \x1b[31mError generating license plate dataset\x1b[0m:`,
        error
      );
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
      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Running \x1b[36mvalidation checks\x1b[0m...`
      );

      const debugQuery = `
        SELECT id, plate_number, crop_coordinates, plate_annotation, ocr_annotation, image_path
        FROM plate_reads 
        WHERE (crop_coordinates IS NOT NULL AND array_length(crop_coordinates, 1) > 0)
           OR (plate_annotation IS NOT NULL AND plate_annotation != '')
        LIMIT 5
      `;
      const debugResult = await client.query(debugQuery);
      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Sample of records with annotations:`,
        debugResult.rows
      );

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
      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m OCR data count: \x1b[36m${ocrResult.rows[0].count}\x1b[0m`
      );

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
      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m License plate data count: \x1b[36m${plateResult.rows[0].count}\x1b[0m`
      );

      this.stats.ocr.hasValidRecords = hasOcrData;
      this.stats.licensePlate.hasValidRecords = hasPlateData;

      if (!hasOcrData && !hasPlateData) {
        console.warn(
          `\x1b[33m[AI TRAINING]\x1b[0m \x1b[33mNo valid training data found. Please update your AI and Blue Iris action to capture annotation data.\x1b[0m`
        );
        return false;
      }

      return { hasOcrData, hasPlateData };
    });
  }

  async queryDatabase(modelType) {
    return withClient(async (client) => {
      const lastRecord = await this.getLastTrainingRecord();
      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Querying \x1b[36m${modelType}\x1b[0m records after ID \x1b[36m${lastRecord}\x1b[0m`
      );

      const baseQuery = `
        SELECT 
          id, plate_number, image_path, crop_coordinates,
          plate_annotation, ocr_annotation, validated
        FROM plate_reads
        WHERE image_path IS NOT NULL
          AND image_path != ''
          AND id > $1
      `;

      const modelCondition =
        modelType === "OCR"
          ? "AND crop_coordinates IS NOT NULL AND array_length(crop_coordinates, 1) = 4"
          : "AND plate_annotation IS NOT NULL AND plate_annotation != ''";

      const query = baseQuery + modelCondition + " ORDER BY id ASC";
      console.log(`\x1b[33m[AI TRAINING]\x1b[0m ${modelType} query:`, query);

      const result = await client.query(query, [lastRecord]);

      console.log(
        `\x1b[33m[AI TRAINING]\x1b[0m Found \x1b[36m${result.rows.length}\x1b[0m ${modelType} records`
      );
      if (result.rows.length > 0) {
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m First ${modelType} record:`,
          result.rows[0]
        );
      }

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

  async compressDirectory(dirPath, outputPath, isOcrDataset = false) {
    return new Promise((resolve, reject) => {
      const output = fs_regular.createWriteStream(outputPath);
      const archive = archiver("zip", {
        zlib: { level: 9 },
      });

      output.on("close", () => resolve());
      archive.on("error", reject);

      archive.pipe(output);

      if (isOcrDataset) {
        // For OCR dataset, add validated and unvalidated subfolders while preserving structure
        const validatedPath = path.join(dirPath, "validated");
        const unvalidatedPath = path.join(dirPath, "unvalidated");

        // Check if directories exist before adding them
        if (fs_regular.existsSync(validatedPath)) {
          archive.directory(validatedPath, "validated");
        }

        if (fs_regular.existsSync(unvalidatedPath)) {
          archive.directory(unvalidatedPath, "unvalidated");
        }
      } else {
        // For other datasets, use the original behavior
        archive.directory(dirPath, false);
      }

      archive.finalize();
    });
  }

  async uploadToCloud(modelType, zipPath, updateLastRecord = true) {
    try {
      const stats =
        modelType === "OCR" ? this.stats.ocr : this.stats.licensePlate;

      if (!stats.hasValidRecords) {
        console.warn(
          `\x1b[33m[AI TRAINING]\x1b[0m Skipping \x1b[36m${modelType}\x1b[0m upload - \x1b[33mno valid records generated\x1b[0m`
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

      // Only update the last record if requested
      if (updateLastRecord) {
        await this.updateLastTrainingRecord(stats.maxId);
      }

      return true;
    } catch (error) {
      console.error(
        `\x1b[33m[AI TRAINING]\x1b[0m \x1b[31mError uploading to cloud\x1b[0m:`,
        error
      );
      throw error;
    }
  }

  async generateAndUpload() {
    try {
      const validationResult = await this.validateData();
      if (!validationResult) {
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m \x1b[33mNo valid data found for training\x1b[0m`
        );
        return;
      }

      const { hasOcrData, hasPlateData } = validationResult;

      // Track the highest ID processed across both models
      let maxProcessedId = 0;

      await this.initialize();

      if (hasOcrData) {
        await this.generateOCRDataset();
        if (this.stats.ocr.hasValidRecords) {
          const ocrZipPath = path.join(this.outputBasePath, "ocr_dataset.zip");
          // Pass true to indicate this is an OCR dataset
          await this.compressDirectory(this.ocrPath, ocrZipPath, true);

          // Don't update the last record yet
          await this.uploadToCloud("OCR", ocrZipPath, false);

          // Keep track of the highest ID
          maxProcessedId = Math.max(maxProcessedId, this.stats.ocr.maxId);

          await fs.unlink(ocrZipPath);
        }
      } else {
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m Skipping OCR dataset - \x1b[33mno valid data\x1b[0m`
        );
      }

      if (hasPlateData) {
        await this.generateLicensePlateDataset();
        if (this.stats.licensePlate.hasValidRecords) {
          const lpZipPath = path.join(
            this.outputBasePath,
            "license_plate_dataset.zip"
          );
          await this.compressDirectory(this.licensePlatePath, lpZipPath);

          // Don't update the last record yet
          await this.uploadToCloud("license-plate", lpZipPath, false);

          // Keep track of the highest ID
          maxProcessedId = Math.max(
            maxProcessedId,
            this.stats.licensePlate.maxId
          );

          await fs.unlink(lpZipPath);
        }
      } else {
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m Skipping license plate dataset - \x1b[33mno valid data\x1b[0m`
        );
      }

      // Only update the last processed record ID after both models have been processed
      if (maxProcessedId > 0) {
        console.log(
          `\x1b[33m[AI TRAINING]\x1b[0m Updating last training record to \x1b[36m${maxProcessedId}\x1b[0m`
        );
        await this.updateLastTrainingRecord(maxProcessedId);
      }

      try {
        await fs.rm(this.ocrPath, { recursive: true, force: true });
        await fs.rm(this.licensePlatePath, { recursive: true, force: true });
      } catch (err) {
        console.warn(
          `\x1b[33m[AI TRAINING]\x1b[0m \x1b[33mCleanup error\x1b[0m:`,
          err
        );
      }
    } catch (error) {
      console.error(
        `\x1b[33m[AI TRAINING]\x1b[0m \x1b[31mError in generate and upload\x1b[0m:`,
        error
      );
      throw error;
    }
  }
}

export default TrainingDataGenerator;
