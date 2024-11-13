// src/app/api/plate-reads/route.ts
import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

// We don't need force-dynamic since this is a POST endpoint
export async function POST(req) {
  const dbClient = await pool.connect();
  
  try {
    const data = await req.json();

    if (!data?.plate_number) {
      return Response.json(
        { error: 'Plate number is required' },
        { status: 400 }
      );
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