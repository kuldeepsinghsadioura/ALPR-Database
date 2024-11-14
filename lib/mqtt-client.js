import mqtt from "mqtt";
import { pool } from "./db";

let mqttClient = null;

export function initMqtt() {
  if (mqttClient) {
    console.log("MQTT client already initialized");
    return;
  }

  console.log("Initializing MQTT client");
  mqttClient = mqtt.connect("mqtt://localhost:1883");

  mqttClient.on("connect", () => {
    console.log("Connected to MQTT broker");
    mqttClient.subscribe("BlueIris/Alert/ALPR2/plate_reads");
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      const data = JSON.parse(message);

      if (!data?.plate_number) return;

      const timestamp = data.timestamp || new Date().toISOString();

      // Process the plate read
      const dbClient = await pool.connect();
      try {
        await dbClient.query("BEGIN");

        // First check if this exact plate read already exists
        const existingRead = await dbClient.query(
          `SELECT id FROM plate_reads 
           WHERE plate_number = $1 AND timestamp = $2`,
          [data.plate_number, timestamp]
        );

        if (existingRead.rows.length > 0) {
          console.log(
            `Skipping duplicate read: ${data.plate_number} at ${timestamp}`
          );
          await dbClient.query("ROLLBACK");
          return;
        }

        // If not exists, proceed with insert
        await dbClient.query(
          `INSERT INTO plates (plate_number)
           VALUES ($1)
           ON CONFLICT (plate_number) DO NOTHING`,
          [data.plate_number]
        );

        await dbClient.query(
          `INSERT INTO plate_reads (plate_number, image_data, timestamp)
           VALUES ($1, $2, $3)`,
          [data.plate_number, data.Image || null, timestamp]
        );

        await dbClient.query("COMMIT");
        console.log(
          `Processed new plate read: ${data.plate_number} at ${timestamp}`
        );
      } catch (error) {
        await dbClient.query("ROLLBACK");
        console.error("Error processing plate read:", error);
      } finally {
        dbClient.release();
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });
}
