import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'password',
  port: 32768,
});

export async function savePlateRead({ plateNumber, imageData, timestamp, vehicleDescription }) {
  const query = `
    INSERT INTO plate_reads (plate_number, image_data, timestamp, vehicle_description)
    VALUES ($1, $2, $3, $4)
  `;
  
  try {
    await pool.query(query, [plateNumber, imageData, timestamp, vehicleDescription]);
  } catch (err) {
    console.error('Error saving plate read:', err);
    throw err;
  }
}

export async function getPlateReads({ search = '', sortBy = 'timestamp', sortOrder = 'DESC', filterTag = '', page = 1 }) {
  const limit = 10;
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT 
      pr.id,
      pr.plate_number,
      pr.image_data,
      pr.timestamp at time zone 'UTC' as timestamp,
      pr.vehicle_description,
      COUNT(*) OVER (PARTITION BY pr.plate_number) as count,
      ARRAY_AGG(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
    FROM plate_reads pr
    LEFT JOIN tags t ON pr.plate_number = t.plate_number
    WHERE pr.plate_number ILIKE $1
  `;
  
  const params = [`%${search}%`];
  let paramCount = 1;

  if (filterTag) {
    query += ` AND EXISTS (
      SELECT 1 FROM tags 
      WHERE plate_number = pr.plate_number 
      AND tag = $${paramCount + 1}
    )`;
    params.push(filterTag);
    paramCount++;
  }

  query += `
    GROUP BY 
      pr.id,
      pr.plate_number,
      pr.image_data,
      pr.timestamp,
      pr.vehicle_description
  `;

  if (sortBy === 'count') {
    query += ` ORDER BY count ${sortOrder}, pr.plate_number ASC`;
  } else {
    query += ` ORDER BY ${sortBy} ${sortOrder}, pr.plate_number ASC`;
  }

  query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  try {
    const result = await pool.query(query, params);
    return result.rows.map(row => ({
      ...row,
      tags: row.tags || []
    }));
  } catch (err) {
    console.error('Error getting plate reads:', err);
    throw err;
  }
}

export async function addTag(plateNumber, tagName) {
  const query = `
    INSERT INTO tags (plate_number, tag)
    VALUES ($1, $2)
    ON CONFLICT (plate_number, tag) DO NOTHING
  `;
  
  try {
    await pool.query(query, [plateNumber, tagName]);
  } catch (err) {
    console.error('Error adding tag:', err);
    throw err;
  }
}

export async function removeTag(plateNumber, tagName) {
  const query = `
    DELETE FROM tags
    WHERE plate_number = $1 AND tag = $2
  `;
  
  try {
    await pool.query(query, [plateNumber, tagName]);
  } catch (err) {
    console.error('Error removing tag:', err);
    throw err;
  }
}

export async function getTags() {
  const query = `
    SELECT DISTINCT tag 
    FROM tags 
    ORDER BY tag
  `;
  
  try {
    const result = await pool.query(query);
    return result.rows.map(row => row.tag);
  } catch (err) {
    console.error('Error getting tags:', err);
    throw err;
  }
}