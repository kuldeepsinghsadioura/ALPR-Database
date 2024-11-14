import pg from 'pg';

export const pool = new pg.Pool({
  host: 'localhost',
  port: 32769,
  user: 'postgres',
  password: 'password',
  database: 'postgres'
});

// export async function getPlateReads() {
//   const result = await pool.query(`
//     SELECT 
//       pr.*,
//       COUNT(*) OVER (PARTITION BY pr.plate_number) as occurrence_count,
//       kp.name as known_name,
//       kp.notes,
//       array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
//         FILTER (WHERE t.name IS NOT NULL) as tags,
//       (SELECT flagged FROM plates WHERE plate_number = pr.plate_number LIMIT 1) as flagged
//     FROM plate_reads pr
//     LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
//     LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
//     LEFT JOIN tags t ON pt.tag_id = t.id
//     GROUP BY pr.id, pr.plate_number, pr.image_data, pr.timestamp, kp.name, kp.notes
//     ORDER BY pr.timestamp DESC
//   `);
//   return result.rows;
// }

export async function getMetrics() {
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
    suspicious_all_time AS (
      SELECT COUNT(DISTINCT pr.plate_number) as suspicious_count
      FROM plate_reads pr
      JOIN plate_tags pt ON pr.plate_number = pt.plate_number
      JOIN tags t ON pt.tag_id = t.id
      WHERE t.name = 'Suspicious'
    ),
    time_distributions AS (
      SELECT 
        (EXTRACT(HOUR FROM timestamp)::integer / 2 * 2) as hour_block,
        COUNT(*) as frequency,
        COUNT(DISTINCT plate_number) as unique_vehicles
      FROM plate_reads 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY hour_block
      ORDER BY hour_block
    ),
    hour_blocks AS (
      SELECT generate_series(0, 22, 2) as hour_block
    ),
    complete_distribution AS (
      SELECT 
        h.hour_block,
        COALESCE(td.frequency, 0) as frequency,
        COALESCE(td.unique_vehicles, 0) as unique_vehicles
      FROM hour_blocks h
      LEFT JOIN time_distributions td ON h.hour_block = td.hour_block
    ),
    top_plates AS (
      SELECT 
        plate_number,
        COUNT(*) as occurrence_count
      FROM plate_reads
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY plate_number
      ORDER BY occurrence_count DESC
      LIMIT 5
    ),
    total_plates AS (
      SELECT COUNT(DISTINCT plate_number) as total_plates_count
      FROM plates
    )
    SELECT 
      d.unique_plates,
      d.total_reads,
      w.weekly_unique,
      s.suspicious_count,
      tp.total_plates_count,
      (SELECT array_agg(json_build_object(
      'hour_block', h.hour_block,
      'frequency', COALESCE(td.frequency, 0),
      'unique_vehicles', COALESCE(td.unique_vehicles, 0)
      ) ORDER BY h.hour_block)
      FROM hour_blocks h
      LEFT JOIN time_distributions td ON h.hour_block = td.hour_block) as time_distribution,
      (SELECT json_agg(json_build_object(
        'plate', plate_number,
        'count', occurrence_count
      )) FROM top_plates) as top_plates
    FROM daily_stats d, weekly_stats w, suspicious_all_time s, total_plates tp`;

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
      kp.plate_number,
      kp.name,
      kp.notes,
      kp.created_at,
      array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags,
      (SELECT flagged FROM plates WHERE plate_number = kp.plate_number LIMIT 1) as flagged
     FROM known_plates kp
     LEFT JOIN plate_tags pt ON kp.plate_number = pt.plate_number
     LEFT JOIN tags t ON pt.tag_id = t.id
     GROUP BY kp.plate_number, kp.name, kp.notes, kp.created_at
     ORDER BY kp.created_at DESC`
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


// export async function getAllPlates() {
//   const result = await pool.query(`
//     SELECT 
//       p.plate_number,
//       p.first_seen_at,
//       p.created_at,
//       p.flagged,
//       kp.name,
//       kp.notes,
//       COUNT(pr.id) as occurrence_count,
//       array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
//         FILTER (WHERE t.name IS NOT NULL) as tags,
//       CASE 
//         WHEN MAX(pr.timestamp) IS NOT NULL THEN 
//           EXTRACT(DAY FROM NOW() - MAX(pr.timestamp))::integer
//         ELSE 
//           LEAST(
//             CEIL(EXTRACT(DAY FROM NOW() - (SELECT MIN(timestamp) FROM plate_reads)) / 5) * 5,
//             15
//           )::integer
//       END as days_since_last_seen
//     FROM plates p
//     LEFT JOIN plate_reads pr ON p.plate_number = pr.plate_number
//     LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
//     LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
//     LEFT JOIN tags t ON pt.tag_id = t.id
//     GROUP BY 
//       p.plate_number,
//       p.first_seen_at,
//       p.created_at,
//       p.flagged,
//       kp.name,
//       kp.notes
//     ORDER BY p.first_seen_at DESC`);
  
//   return result.rows;
// }

export async function togglePlateFlag(plateNumber, flagged) {
  const result = await pool.query(
    `UPDATE plates 
     SET flagged = $1
     WHERE plate_number = $2
     RETURNING *`,
    [flagged, plateNumber]
  );
  
  return result.rows[0];
}

// db.js
export async function getPlateInsights(plateNumber) {
  const result = await pool.query(`
    WITH time_distributions AS (
      SELECT 
        (EXTRACT(HOUR FROM timestamp)::integer / 2 * 2) as hour_block,
        COUNT(*) as frequency
      FROM plate_reads 
      WHERE plate_number = $1
      GROUP BY hour_block
      ORDER BY hour_block
    ),
    hour_blocks AS (
      SELECT generate_series(0, 22, 2) as hour_block
    ),
    complete_distribution AS (
      SELECT 
        h.hour_block,
        COALESCE(td.frequency, 0) as frequency
      FROM hour_blocks h
      LEFT JOIN time_distributions td ON h.hour_block = td.hour_block
    ),
    recent_reads AS (
      SELECT 
        timestamp,
        image_data
      FROM plate_reads
      WHERE plate_number = $1
      ORDER BY timestamp DESC
      LIMIT 5
    )
    SELECT 
      p.plate_number,
      p.first_seen_at,
      COUNT(pr.id) as total_occurrences,
      MAX(pr.timestamp) as last_seen_at,
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags,
      (SELECT json_agg(json_build_object(
        'timeBlock', hour_block,
        'frequency', frequency,
        'timeRange', 
        concat(
          LPAD(hour_block::text, 2, '0'), ':00-', 
          LPAD(((hour_block + 2) % 24)::text, 2, '0'), ':00'
        )
      )) FROM complete_distribution) as time_distribution,
      (SELECT json_agg(json_build_object(
        'timestamp', timestamp,
        'imageData', image_data
      )) FROM recent_reads) as recent_reads,
      kp.name as known_name,
      kp.notes
    FROM plates p
    LEFT JOIN plate_reads pr ON p.plate_number = pr.plate_number
    LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
    LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.plate_number = $1
    GROUP BY 
      p.plate_number,
      p.first_seen_at,
      kp.name,
      kp.notes
  `, [plateNumber]);

  return result.rows[0];
}