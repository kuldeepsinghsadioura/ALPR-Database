import mqtt from 'mqtt';
import { pool } from './db';

let client;

export function initMqtt() {
  if (client) return;
  
  client = mqtt.connect('mqtt://localhost:1883');
  
  client.on('connect', () => {
    console.log('Connected to MQTT broker');
    client.subscribe('#');
  });
  
  client.on('message', async (topic, message) => {
    if (message.toString() === 'unexpected stop') return;

    try {
      const data = JSON.parse(message);
      
      if (!data?.plate_number) return;

      // Begin transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // First ensure plate exists in plates table
        await client.query(
          `INSERT INTO plates (plate_number)
           VALUES ($1)
           ON CONFLICT (plate_number) DO NOTHING`,
          [data.plate_number]
        );

        // Then insert the plate read
        await client.query(
          `INSERT INTO plate_reads (plate_number, image_data, timestamp)
           VALUES ($1, $2, $3)`,
          [
            data.plate_number,
            data.Image || null,
            data.timestamp || new Date().toISOString()
          ]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing plate read:', error);
      } finally {
        client.release();
      }
    } catch (error) {
      // Ignore parse errors, just means it wasn't a plate message
      return;
    }
  });
}