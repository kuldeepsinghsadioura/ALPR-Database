// src/app/api/plate-reads/route.ts
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { checkPlateForNotification } from '@/lib/db';
import { sendPushoverNotification } from '@/lib/notifications';
import { getAuthConfig } from '@/lib/auth';

export async function POST(req) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return Response.json(
      { error: 'API key is required' },
      { status: 401 }
    );
  }

  // Verify the API key against stored config
  const authConfig = await getAuthConfig();
  if (apiKey !== authConfig.apiKey) {
    return Response.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }

  if (!data?.plate_number) {
    return Response.json(
      { error: 'Plate number is required' },
      { status: 400 }
    );
  }


  const dbClient = await pool.connect();
  
  try {
    const data = await req.json();

    // Check if this plate should trigger a notification
    const shouldNotify = await checkPlateForNotification(data.plate_number);
    if (shouldNotify) {
      await sendPushoverNotification(data.plate_number);
    }

    const timestamp = data.timestamp || new Date().toISOString();
    
    // Use a single query to check for duplicates and insert if not exists
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
      [
        data.plate_number,
        data.Image || null,
        timestamp
      ]
    );

    if (result.rows.length === 0) {
      return Response.json({
        message: `Duplicate read: ${data.plate_number} at ${timestamp}`
      }, { status: 409 });
    }

    return Response.json({
      message: `Processed new plate read: ${data.plate_number} at ${timestamp}`,
      id: result.rows[0].id
    }, { status: 201 });

  } catch (error) {
    console.error('Error processing request:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    dbClient.release();
  }
}