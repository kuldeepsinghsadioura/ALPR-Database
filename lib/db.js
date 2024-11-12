import pg from 'pg';

export const pool = new pg.Pool({
  host: 'localhost',
  port: 32768,
  user: 'postgres',
  password: 'password',
  database: 'postgres'
});

export async function getPlateReads() {
  const result = await pool.query(`
    SELECT 
      pr.*,
      COUNT(*) OVER (PARTITION BY pr.plate_number) as occurrence_count,
      kp.name as known_name,
      kp.notes,
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags
    FROM plate_reads pr
    LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
    LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    GROUP BY pr.id, pr.plate_number, pr.image_data, pr.timestamp, kp.name, kp.notes
    ORDER BY pr.timestamp DESC
  `);
  return result.rows;
}

export async function getDailyMetrics() {
  const query = `
    WITH daily_stats AS (
      SELECT 
        COUNT(DISTINCT plate_number) as unique_plates,
        COUNT(*) as total_reads
      FROM plate_reads 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    ),
    weekly_stats AS (
      SELECT COUNT(DISTINCT plate_number) as weekly_unique
      FROM plate_reads 
      WHERE timestamp > NOW() - INTERVAL '7 days'
    ),
    suspicious_today AS (
      SELECT COUNT(DISTINCT pr.plate_number) as suspicious_count
      FROM plate_reads pr
      JOIN plate_tags pt ON pr.plate_number = pt.plate_number
      JOIN tags t ON pt.tag_id = t.id
      WHERE t.name = 'Suspicious'
      AND pr.timestamp > NOW() - INTERVAL '24 hours'
    )
    SELECT 
      d.unique_plates,
      d.total_reads,
      w.weekly_unique,
      s.suspicious_count
    FROM daily_stats d, weekly_stats w, suspicious_today s`;

  const result = await pool.query(query);
  return result.rows[0];
}

// New known plates management methods
export async function manageKnownPlate({ plateNumber, name = null, notes = null, tags = [] }) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Insert or update the plate
    const plateResult = await client.query(
      `INSERT INTO plates (plate_number, name, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (plate_number) DO UPDATE SET
         name = EXCLUDED.name,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [plateNumber, name, notes]
    );

    // Handle tags if provided
    if (tags.length > 0) {
      // Remove existing tags
      await client.query(
        `DELETE FROM plate_tags WHERE plate_number = $1`,
        [plateNumber]
      );

      // Add new tags
      const tagQuery = `
        INSERT INTO plate_tags (plate_number, tag_id)
        SELECT $1, id FROM tags WHERE name = ANY($2)
        ON CONFLICT (plate_number, tag_id) DO NOTHING
      `;
      await client.query(tagQuery, [plateNumber, tags]);
    }

    // Get the complete plate data with tags
    const finalResult = await client.query(
      `SELECT 
        p.*,
        array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
       FROM plates p
       LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.plate_number = $1
       GROUP BY p.plate_number, p.name, p.notes, p.first_seen_at, p.created_at, p.updated_at`,
      [plateNumber]
    );

    await client.query('COMMIT');
    return finalResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


export async function getKnownPlates() {
  const result = await pool.query(
    `SELECT 
      p.*,
      array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
     FROM plates p
     LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
     LEFT JOIN tags t ON pt.tag_id = t.id
     WHERE p.name IS NOT NULL
     GROUP BY p.plate_number, p.name, p.notes, p.first_seen_at, p.created_at, p.updated_at
     ORDER BY p.updated_at DESC`
  );
  return result.rows;
}


// Add/Update a known plate
export async function updateKnownPlate(plateNumber, { name, notes }) {
  const result = await pool.query(
    `INSERT INTO known_plates (plate_number, name, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (plate_number) 
     DO UPDATE SET 
       name = EXCLUDED.name,
       notes = EXCLUDED.notes
     RETURNING *`,
    [plateNumber, name, notes]
  );
  return result.rows[0];
}

// Tag Management
export async function getAvailableTags() {
  const result = await pool.query('SELECT * FROM tags ORDER BY name');
  return result.rows;
}

export async function createTag(name, color = '#808080') {
  const result = await pool.query(
    `INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *`,
    [name, color]
  );
  return result.rows[0];
}

export async function updateTagColor(name, color) {
  const result = await pool.query(
    `UPDATE tags SET color = $2 WHERE name = $1 RETURNING *`,
    [name, color]
  );
  return result.rows[0];
}

export async function deleteTag(name) {
  await pool.query('DELETE FROM tags WHERE name = $1', [name]);
}

// Plate Tag Management
export async function addTagToPlate(plateNumber, tagName) {
  await pool.query(
    `INSERT INTO plate_tags (plate_number, tag_id)
     SELECT $1, id FROM tags WHERE name = $2
     ON CONFLICT (plate_number, tag_id) DO NOTHING`,
    [plateNumber, tagName]
  );
}

export async function removeTagFromPlate(plateNumber, tagName) {
  await pool.query(
    `DELETE FROM plate_tags 
     WHERE plate_number = $1 
     AND tag_id = (SELECT id FROM tags WHERE name = $2)`,
    [plateNumber, tagName]
  );
}

export async function getPlateHistory(plateNumber) {
  const result = await pool.query(`
    SELECT 
      pr.*,
      kp.name as known_name,
      kp.notes,
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags
    FROM plate_reads pr
    LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
    LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE pr.plate_number = $1
    GROUP BY pr.id, pr.plate_number, pr.image_data, pr.timestamp, kp.name, kp.notes
    ORDER BY pr.timestamp DESC`,
    [plateNumber]
  );
  return result.rows;
}
export async function removeKnownPlate(plateNumber) {
  await pool.query(
    'DELETE FROM known_plates WHERE plate_number = $1',
    [plateNumber]
  );
}