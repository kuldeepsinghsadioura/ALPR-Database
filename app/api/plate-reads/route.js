import { getPool } from "@/lib/db";
import { checkPlateForNotification } from "@/lib/db";
import { sendPushoverNotification } from "@/lib/notifications";
import { getAuthConfig } from "@/lib/auth";

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

    if (!data?.plate_number) {
      return Response.json(
        { error: "Plate number is required" },
        { status: 400 }
      );
    }

    // Get database connection with retries
    const pool = await getPool();
    dbClient = await pool.connect();
    console.log("Database connection established");

    // Check notifications
    const shouldNotify = await checkPlateForNotification(data.plate_number);
    if (shouldNotify) {
      await sendPushoverNotification(data.plate_number);
    }

    const timestamp = data.timestamp || new Date().toISOString();
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
      [data.plate_number, data.Image || null, timestamp]
    );

    if (result.rows.length === 0) {
      return Response.json(
        {
          message: `Duplicate read: ${data.plate_number} at ${timestamp}`,
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        message: `Processed new plate read: ${data.plate_number} at ${timestamp}`,
        id: result.rows[0].id,
      },
      { status: 201 }
    );
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
