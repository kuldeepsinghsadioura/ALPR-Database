import { cleanupOldRecords, getPool } from "@/lib/db";
import { checkPlateForNotification } from "@/lib/db";
import { sendPushoverNotification } from "@/lib/notifications";
import { getAuthConfig } from "@/lib/auth";
import { getConfig } from "@/lib/settings";

// Revised to use a blacklist of all other possible AI labels if using the memo. This will filter any other AI objects out, while still allowing for weird OCR reads and vanity plates.
const EXCLUDED_LABELS = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "bus",
  "truck",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "bear",
  "deer",
  "rabbit",
  "raccoon",
  "fox",
  "skunk",
  "squirrel",
  "pig",
  "vehicle",
  "boat",
  "bottle",
  "chair",
  "cup",
  "table",
  "airplane",
  "train",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "elephant",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "wine glass",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
  "plate",
  "dayplate",
  "nightplate",
  "people",
  "motorbike",
].map((label) => label.toLowerCase());

function extractPlatesFromMemo(memo) {
  if (!memo) return [];

  // Split up all the detected objects/plates in memo
  const detections = memo.split(",").map((d) => d.trim());

  // Process each item in the memo
  const plates = detections
    .map((detection) => {
      // Split by colon to separate label from confidence
      const [label] = detection.split(":");

      if (!label) return null;

      // Convert to lowercase for comparison
      const normalizedLabel = label.trim().toLowerCase();

      // ignore other AI objects and only return plates
      if (EXCLUDED_LABELS.includes(normalizedLabel)) {
        return null;
      }

      // The older dayplate and nightplate models return the plate in brackets, so check for these and remove them if they are present.
      let plateNumber = label.trim();
      if (plateNumber.includes("[") && plateNumber.includes("]")) {
        plateNumber = plateNumber.replace(/\[|\]/g, "");
      }

      // Return cleaned plate number in uppercase
      return plateNumber.toUpperCase();
    })
    .filter((plate) => plate !== null);

  return [...new Set(plates)]; // Remove duplicates
}

export async function POST(req) {
  let dbClient = null;

  // delete plate reads over the maxRecords limit
  const config = await getConfig();
  await cleanupOldRecords(config.general.maxRecords);

  try {
    const data = await req.json();
    console.log("Received plate read data:", data);

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return Response.json({ error: "API key is required" }, { status: 401 });
    }

    const authConfig = await getAuthConfig();
    if (apiKey !== authConfig.apiKey) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Extract plates either from memo or plate_number
    const plates = data.memo
      ? extractPlatesFromMemo(data.memo)
      : data.plate_number
      ? [data.plate_number.toUpperCase()]
      : [];

    if (plates.length === 0) {
      return Response.json(
        { error: "No valid plates found in request" },
        { status: 400 }
      );
    }

    // Get database connection with retries
    const pool = await getPool();
    dbClient = await pool.connect();
    console.log("Database connection established");

    const timestamp = data.timestamp || new Date().toISOString();
    const processedPlates = [];
    const duplicatePlates = [];
    const camera = data.camera || null;

    for (const plate of plates) {
      // Check notifications
      const shouldNotify = await checkPlateForNotification(plate);
      if (shouldNotify) {
        await sendPushoverNotification(plate, null, data.Image);
      }

      const result = await dbClient.query(
        `WITH new_plate AS (
          INSERT INTO plates (plate_number)
          VALUES ($1)
          ON CONFLICT (plate_number) DO NOTHING
        ),
        new_read AS (
          INSERT INTO plate_reads (plate_number, image_data, timestamp, camera_name)
          SELECT $1, $2, $3, $4
          WHERE NOT EXISTS (
            SELECT 1 FROM plate_reads 
            WHERE plate_number = $1 AND timestamp = $3
          )
          RETURNING id
        )
        SELECT id FROM new_read`,
        [plate, data.Image || null, timestamp, camera]
      );

      if (result.rows.length === 0) {
        duplicatePlates.push(plate);
      } else {
        processedPlates.push({
          plate,
          id: result.rows[0].id,
        });
      }
    }

    // Prepare response based on results
    const response = {
      processed: processedPlates,
      duplicates: duplicatePlates,
      message: `Processed ${processedPlates.length} plates, ${duplicatePlates.length} duplicates`,
    };

    const status = processedPlates.length > 0 ? 201 : 409;
    return Response.json(response, { status });
  } catch (error) {
    console.error("Error processing request:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
}
