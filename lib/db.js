import pg from "pg";
import { getConfig } from "@/lib/settings";

let pool = null;
let currentConfigHash = null;

function getConfigHash(config) {
  // Create a string that represents the database configuration
  return JSON.stringify({
    host: config?.database?.host,
    name: config?.database?.name,
    user: config?.database?.user,
    password: config?.database?.password,
  });
}

export async function resetPool() {
  if (pool) {
    await pool.end();
    pool = null;
    currentConfigHash = null;
  }
}

export async function getPool(retryCount = 3) {
  try {
    const config = await getConfig();
    const newConfigHash = getConfigHash(config);

    // If config has changed or pool doesn't exist, create new pool
    if (!pool || newConfigHash !== currentConfigHash) {
      await resetPool();

      // Parse host and port, handling edge cases
      const [host, portStr] = (
        config?.database?.host || "localhost:5432"
      ).split(":");
      const port = parseInt(portStr || "5432", 10);

      console.log(`Connecting to database at ${host}:${port}`); // Debug log

      pool = new pg.Pool({
        host: host,
        port: port,
        user: config?.database?.user || "postgres",
        password: config?.database?.password || "password",
        database: config?.database?.name || "postgres",
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000, // Increased timeout
      });

      // Test the connection
      try {
        const client = await pool.connect();
        await client.query("SELECT 1");
        client.release();
        console.log("Database connection successful"); // Debug log
        currentConfigHash = newConfigHash;
      } catch (error) {
        await resetPool();
        console.error("Database connection test failed:", error);

        // Retry logic
        if (retryCount > 0) {
          console.log(
            `Retrying connection... (${retryCount} attempts remaining)`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
          return getPool(retryCount - 1);
        }

        throw new Error(`Database connection failed: ${error.message}`);
      }
    }

    return pool;
  } catch (error) {
    console.error("Error getting database pool:", error);
    throw error;
  }
}

// Default page size for paginated queries
const DEFAULT_PAGE_SIZE = 25;

export async function getPlateReads({
  page = 1,
  pageSize = 25,
  filters = {},
} = {}) {
  const pool = await getPool();
  const offset = (page - 1) * pageSize;
  let paramIndex = 1; // Start from 1 instead of 3
  let conditions = [];
  let countValues = []; // Separate array for count query values
  let queryValues = []; // Values for main query

  // Build filter conditions
  if (filters.plateNumber) {
    conditions.push(`pr.plate_number ILIKE $${paramIndex}`);
    countValues.push(`%${filters.plateNumber}%`);
    queryValues.push(`%${filters.plateNumber}%`);
    paramIndex++;
  }

  if (filters.tag && filters.tag !== "all") {
    conditions.push(`EXISTS (
      SELECT 1 FROM plate_tags pt2 
      JOIN tags t2 ON pt2.tag_id = t2.id 
      WHERE pt2.plate_number = pr.plate_number 
      AND t2.name = $${paramIndex}
    )`);
    countValues.push(filters.tag);
    queryValues.push(filters.tag);
    paramIndex++;
  }

  if (filters.dateRange?.from && filters.dateRange?.to) {
    conditions.push(
      `pr.timestamp::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`
    );
    countValues.push(filters.dateRange.from, filters.dateRange.to);
    queryValues.push(filters.dateRange.from, filters.dateRange.to);
    paramIndex += 2;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count query uses just the filter values
  const countQuery = `
    SELECT COUNT(DISTINCT pr.id)
    FROM plate_reads pr
    LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
    LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    ${whereClause}
  `;

  const countResult = await pool.query(countQuery, countValues);
  const totalCount = parseInt(countResult.rows[0].count);

  // Main query uses filter values first, then adds LIMIT/OFFSET at the end
  const dataQuery = `
    SELECT 
      pr.*,
      COUNT(*) OVER (PARTITION BY pr.plate_number) as occurrence_count,
      kp.name as known_name,
      kp.notes,
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags,
      (SELECT flagged FROM plates WHERE plate_number = pr.plate_number LIMIT 1) as flagged
    FROM plate_reads pr
    LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
    LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    ${whereClause}
    GROUP BY pr.id, pr.plate_number, pr.image_data, pr.timestamp, kp.name, kp.notes
    ORDER BY pr.timestamp DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  // Add the pagination parameters at the end
  queryValues.push(pageSize, offset);

  const result = await pool.query(dataQuery, queryValues);

  return {
    data: result.rows,
    pagination: {
      page,
      pageSize,
      total: totalCount,
      pageCount: Math.ceil(totalCount / pageSize),
    },
  };
}

// Optimized getAllPlates with pagination support
export async function getAllPlates(paginationOpts) {
  const pool = await getPool();
  if (paginationOpts && typeof paginationOpts === "object") {
    const {
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
      sortBy = "first_seen_at",
      sortDesc = true,
    } = paginationOpts;
    const offset = (page - 1) * pageSize;

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM plates
    `);

    const result = await pool.query(
      `
      WITH plate_data AS (
        SELECT 
          p.plate_number,
          p.first_seen_at,
          p.created_at,
          p.flagged,
          kp.name,
          kp.notes,
          COUNT(pr.id) as occurrence_count,
          MAX(pr.timestamp) as last_seen_at
        FROM plates p
        LEFT JOIN plate_reads pr ON p.plate_number = pr.plate_number
        LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
        GROUP BY 
          p.plate_number,
          p.first_seen_at,
          p.created_at,
          p.flagged,
          kp.name,
          kp.notes
        ORDER BY ${sortBy} ${sortDesc ? "DESC" : "ASC"}
        LIMIT $1 OFFSET $2
      )
      SELECT 
        pd.*,
        COALESCE(
          array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color))
          FILTER (WHERE t.name IS NOT NULL),
          '[]'::jsonb[]
        ) as tags,
        CASE 
          WHEN last_seen_at IS NOT NULL THEN 
            EXTRACT(DAY FROM NOW() - last_seen_at)::integer
          ELSE 
            15
        END as days_since_last_seen
      FROM plate_data pd
      LEFT JOIN plate_tags pt ON pd.plate_number = pt.plate_number
      LEFT JOIN tags t ON pt.tag_id = t.id
      GROUP BY 
        pd.plate_number,
        pd.first_seen_at,
        pd.created_at,
        pd.flagged,
        pd.name,
        pd.notes,
        pd.occurrence_count,
        pd.last_seen_at
      ORDER BY ${
        sortBy === "days_since_last_seen"
          ? "days_since_last_seen"
          : `pd.${sortBy}`
      } ${sortDesc ? "DESC" : "ASC"}
    `,
      [pageSize, offset]
    );

    return {
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        pageCount: Math.ceil(parseInt(countResult.rows[0].count) / pageSize),
        page,
        pageSize,
      },
    };
  }

  // Original non-paginated query for backward compatibility
  const result = await pool.query(`
    SELECT 
      p.plate_number,
      p.first_seen_at,
      p.created_at,
      p.flagged,
      kp.name,
      kp.notes,
      COUNT(pr.id) as occurrence_count,
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags,
      CASE 
        WHEN MAX(pr.timestamp) IS NOT NULL THEN 
          EXTRACT(DAY FROM NOW() - MAX(pr.timestamp))::integer
        ELSE 
          15
      END as days_since_last_seen
    FROM plates p
    LEFT JOIN plate_reads pr ON p.plate_number = pr.plate_number
    LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
    LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    GROUP BY 
      p.plate_number,
      p.first_seen_at,
      p.created_at,
      p.flagged,
      kp.name,
      kp.notes
    ORDER BY p.first_seen_at DESC`);

  return result.rows;
}

export async function getFlaggedPlates() {
  const pool = await getPool();
  const query = `
    SELECT 
      p.plate_number,
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags
    FROM plates p
    LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.flagged = true
    GROUP BY p.plate_number
    ORDER BY p.plate_number`;

  const result = await pool.query(query);
  return result.rows;
}

export async function getNotificationPlates() {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
        pn.*,
        array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
          FILTER (WHERE t.name IS NOT NULL) as tags
      FROM plate_notifications pn
      LEFT JOIN plate_tags pt ON pn.plate_number = pt.plate_number
      LEFT JOIN tags t ON pt.tag_id = t.id
      GROUP BY pn.id, pn.plate_number, pn.enabled, pn.created_at, pn.updated_at
      ORDER BY pn.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Error fetching notification plates:", error);
    throw error; // Re-throw to be caught by calling functions
  }
}

export async function addNotificationPlate(plateNumber) {
  const pool = await getPool();
  const query = `
    INSERT INTO plate_notifications (plate_number)
    VALUES ($1)
    ON CONFLICT ON CONSTRAINT plate_notifications_plate_number_key
    DO UPDATE
    SET enabled = true, updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await pool.query(query, [plateNumber]);
  return result.rows[0];
}

export async function toggleNotification(plateNumber, enabled) {
  const pool = await getPool();
  const query = `
    UPDATE plate_notifications
    SET enabled = $2, updated_at = CURRENT_TIMESTAMP
    WHERE plate_number = $1
    RETURNING *
  `;
  const result = await pool.query(query, [plateNumber, enabled]);
  return result.rows[0];
}

export async function deleteNotification(plateNumber) {
  const pool = await getPool();
  const query = `DELETE FROM plate_notifications WHERE plate_number = $1`;
  await pool.query(query, [plateNumber]);
}

export async function checkPlateForNotification(plateNumber) {
  const pool = await getPool();
  const query = `
    SELECT * FROM plate_notifications
    WHERE plate_number = $1 AND enabled = true
  `;
  const result = await pool.query(query, [plateNumber]);
  return result.rows[0];
}

export async function getMetrics() {
  const pool = await getPool();
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
    EXTRACT(HOUR FROM timestamp AT TIME ZONE CURRENT_SETTING('TIMEZONE'))::integer as hour_block,
    COUNT(*) as frequency
  FROM plate_reads 
  WHERE timestamp > NOW() - INTERVAL '7 days'
  GROUP BY hour_block
  ORDER BY hour_block
),
hour_blocks AS (
  SELECT generate_series(0, 23) as hour_block
),
complete_distribution AS (
  SELECT 
    h.hour_block,
    COALESCE(td.frequency, 0) as frequency
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
    'frequency', cd.frequency
  ) ORDER BY h.hour_block)
  FROM hour_blocks h
  JOIN complete_distribution cd ON h.hour_block = cd.hour_block) as time_distribution,
  (SELECT json_agg(json_build_object(
    'plate', plate_number,
    'count', occurrence_count
  )) FROM top_plates) as top_plates
FROM daily_stats d, weekly_stats w, suspicious_all_time s, total_plates tp`;

  const result = await pool.query(query);
  return result.rows[0];
}

// New known plates management methods
export async function manageKnownPlate({
  plateNumber,
  name = null,
  notes = null,
  tags = [],
}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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
      await client.query(`DELETE FROM plate_tags WHERE plate_number = $1`, [
        plateNumber,
      ]);

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

    await client.query("COMMIT");
    return finalResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getKnownPlates() {
  const pool = await getPool();
  console.log("getting known plates");
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
  const pool = await getPool();
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
  const pool = await getPool();
  const result = await pool.query("SELECT * FROM tags ORDER BY name");
  return result.rows;
}

export async function createTag(name, color = "#808080") {
  const pool = await getPool();
  const result = await pool.query(
    `INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *`,
    [name, color]
  );
  return result.rows[0];
}

export async function updateTagColor(name, color) {
  const pool = await getPool();
  const result = await pool.query(
    `UPDATE tags SET color = $2 WHERE name = $1 RETURNING *`,
    [name, color]
  );
  return result.rows[0];
}

export async function deleteTag(name) {
  const pool = await getPool();
  await pool.query("DELETE FROM tags WHERE name = $1", [name]);
}

// Plate Tag Management
export async function addTagToPlate(plateNumber, tagName) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO plate_tags (plate_number, tag_id)
     SELECT $1, id FROM tags WHERE name = $2
     ON CONFLICT (plate_number, tag_id) DO NOTHING`,
    [plateNumber, tagName]
  );
}

export async function removeTagFromPlate(plateNumber, tagName) {
  const pool = await getPool();
  await pool.query(
    `DELETE FROM plate_tags 
     WHERE plate_number = $1 
     AND tag_id = (SELECT id FROM tags WHERE name = $2)`,
    [plateNumber, tagName]
  );
}

export async function getPlateHistory(plateNumber) {
  const pool = await getPool();
  const result = await pool.query(
    `
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
  const pool = await getPool();
  await pool.query("DELETE FROM known_plates WHERE plate_number = $1", [
    plateNumber,
  ]);
}

export async function removePlate(plateNumber) {
  const pool = await getPool();
  await pool.query("DELETE FROM plates WHERE plate_number = $1", [plateNumber]);
}

export async function removePlateRead(plateNumber) {
  const pool = await getPool();
  await pool.query("DELETE FROM plate_reads WHERE plate_number = $1", [
    plateNumber,
  ]);
}

export async function togglePlateFlag(plateNumber, flagged) {
  const pool = await getPool();
  const result = await pool.query(
    `UPDATE plates 
     SET flagged = $1
     WHERE plate_number = $2
     RETURNING *`,
    [flagged, plateNumber]
  );

  return result.rows[0];
}

export async function getPlateInsights(plateNumber) {
  const pool = await getPool();
  const result = await pool.query(
    `
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
  `,
    [plateNumber]
  );

  return result.rows[0];
}
