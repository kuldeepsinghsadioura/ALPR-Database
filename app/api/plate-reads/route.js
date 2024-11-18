import { getPool } from "@/lib/db";
import { checkPlateForNotification } from "@/lib/db";
import { sendPushoverNotification } from "@/lib/notifications";
import { getAuthConfig } from "@/lib/auth";

// Helper function to extract plates from memo string
function extractPlatesFromMemo(memo) {
  if (!memo) return [];

  // Split by comma to handle multiple detections
  const detections = memo.split(",").map((d) => d.trim());

  // Process each detection
  const plates = detections
    .map((detection) => {
      // Split by colon to separate plate from confidence
      const [plate] = detection.split(":");

      // Basic plate validation
      // Most plates are 5-8 characters
      // Usually contains at least one letter and one number
      // Allows for special characters like hyphens
      if (
        plate &&
        plate.length >= 4 &&
        plate.length <= 8 &&
        /^[A-Z0-9-]+$/i.test(plate) && // Only alphanumeric and hyphen
        /[A-Z]/i.test(plate) && // At least one letter
        /[0-9]/.test(plate) // At least one number
      ) {
        return plate.toUpperCase();
      }
      return null;
    })
    .filter((plate) => plate !== null);

  return [...new Set(plates)]; // Remove duplicates
}

export async function POST(req) {
  let dbClient = null;

  try {
    const data = await req.json();
    console.log("Received plate read data:", data);

    // API key validation
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
      ? [data.plate_number]
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

    // Process each plate
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
          INSERT INTO plate_reads (plate_number, image_data, timestamp)
          SELECT $1, $2, $3
          WHERE NOT EXISTS (
            SELECT 1 FROM plate_reads 
            WHERE plate_number = $1 AND timestamp = $3
          )
          RETURNING id
        )
        SELECT id FROM new_read`,
        [plate, data.Image || null, timestamp]
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
