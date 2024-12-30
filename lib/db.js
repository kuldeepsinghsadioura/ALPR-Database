import pg from "pg";
import { getConfig } from "@/lib/settings";

let pool = null;
let currentConfigHash = null;

function getConfigHash(config) {
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
  let paramIndex = 1;
  let conditions = [];
  let countValues = [];
  let queryValues = [];

  if (filters.plateNumber) {
    if (filters.fuzzySearch) {
      const normalizedSearch = filters.plateNumber
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();

      conditions.push(`(
        pr.plate_number ILIKE $${paramIndex} OR 
        REPLACE(REPLACE(UPPER(pr.plate_number), ' ', ''), '*', '') LIKE $${
          paramIndex + 1
        } OR
        LEVENSHTEIN(
          REPLACE(REPLACE(UPPER(pr.plate_number), ' ', ''), '*', ''),
          $${paramIndex + 2}
        ) <= GREATEST(2, CEIL(LENGTH($${paramIndex + 2}) * 0.25))
      )`);

      countValues.push(
        `%${filters.plateNumber}%`,
        `%${normalizedSearch}%`,
        normalizedSearch
      );
      queryValues.push(
        `%${filters.plateNumber}%`,
        `%${normalizedSearch}%`,
        normalizedSearch
      );
      paramIndex += 3;
    } else {
      conditions.push(`pr.plate_number ILIKE $${paramIndex}`);
      countValues.push(`%${filters.plateNumber}%`);
      queryValues.push(`%${filters.plateNumber}%`);
      paramIndex++;
    }
  }
  if (
    filters.hourRange?.from !== undefined &&
    filters.hourRange?.to !== undefined
  ) {
    if (filters.hourRange.from <= filters.hourRange.to) {
      // Normal range within the same day
      conditions.push(
        `EXTRACT(HOUR FROM pr.timestamp) BETWEEN $${paramIndex} AND $${
          paramIndex + 1
        }`
      );
      countValues.push(filters.hourRange.from, filters.hourRange.to);
      queryValues.push(filters.hourRange.from, filters.hourRange.to);
    } else {
      // Range spans midnight
      conditions.push(
        `(
          EXTRACT(HOUR FROM pr.timestamp) >= $${paramIndex} OR 
          EXTRACT(HOUR FROM pr.timestamp) < $${paramIndex + 1}
        )`
      );
      countValues.push(filters.hourRange.from, filters.hourRange.to);
      queryValues.push(filters.hourRange.from, filters.hourRange.to);
    }
    paramIndex += 2;
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

  if (filters.cameraName) {
    conditions.push(`pr.camera_name ILIKE $${paramIndex}`);
    countValues.push(`%${filters.cameraName}%`);
    queryValues.push(`%${filters.cameraName}%`);
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
    GROUP BY pr.id, pr.plate_number, pr.image_data, pr.timestamp, pr.camera_name, kp.name, kp.notes
    ORDER BY pr.timestamp DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

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
  const {
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    sortBy = "first_seen_at",
    sortDesc = true,
    filters = {},
  } = paginationOpts || {};

  const offset = (page - 1) * pageSize;
  let paramIndex = 1;
  let conditions = [];
  let values = [];

  if (filters.search) {
    conditions.push(`p.plate_number ILIKE $${paramIndex} OR      
      kp.name ILIKE $${paramIndex} OR
      kp.notes ILIKE $${paramIndex}`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters.tag) {
    conditions.push(`EXISTS (
      SELECT 1 FROM plate_tags pt2 
      JOIN tags t2 ON pt2.tag_id = t2.id 
      WHERE pt2.plate_number = p.plate_number 
      AND t2.name = $${paramIndex}
    )`);
    values.push(filters.tag);
    paramIndex++;
  }

  if (filters.dateRange?.from && filters.dateRange?.to) {
    conditions.push(
      `p.first_seen_at::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`
    );
    values.push(filters.dateRange.from, filters.dateRange.to);
    paramIndex += 2;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    // Get total count first
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM plates p 
       LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
       ${whereClause}`,
      values
    );

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
        ${whereClause}
        GROUP BY 
          p.plate_number,
          p.first_seen_at,
          p.created_at,
          p.flagged,
          kp.name,
          kp.notes
        ORDER BY ${
          sortBy === "last_seen_at"
            ? "MAX(pr.timestamp)"
            : sortBy === "days_since_last_seen"
            ? "MAX(pr.timestamp)"
            : sortBy
        } ${sortDesc ? "DESC NULLS LAST" : "ASC NULLS LAST"}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      )
      SELECT 
        pd.*,
        COALESCE(
          array_agg(
            CASE WHEN t.name IS NOT NULL 
            THEN jsonb_build_object('name', t.name, 'color', t.color)
            END
          ) FILTER (WHERE t.name IS NOT NULL),
          ARRAY[]::jsonb[]
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
        sortBy === "last_seen_at"
          ? "last_seen_at" // Changed from days_since_last_seen to directly sort by timestamp
          : sortBy === "days_since_last_seen"
          ? "last_seen_at" // Actual timestamp for days since
          : `pd.${sortBy}`
      } ${sortDesc ? "DESC NULLS LAST" : "ASC NULLS LAST"}
    `,
      [...values, pageSize, offset]
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
  } catch (error) {
    console.error("Error in getAllPlates:", error);
    throw error;
  }
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
      GROUP BY pn.id, pn.plate_number, pn.enabled, pn.priority, pn.created_at, pn.updated_at
      ORDER BY pn.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Error fetching notification plates:", error);
    throw error;
  }
}

export async function addNotificationPlate(plateNumber) {
  const pool = await getPool();
  const query = `
    INSERT INTO plate_notifications (plate_number, priority)
    VALUES ($1, 1)
    ON CONFLICT ON CONSTRAINT plate_notifications_plate_number_key
    DO UPDATE
    SET enabled = true, updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await pool.query(query, [plateNumber]);
  return result.rows[0];
}

export async function updateNotificationPriorityDB(plateNumber, priority) {
  const pool = await getPool();
  const query = `
    UPDATE plate_notifications
    SET priority = $2, updated_at = CURRENT_TIMESTAMP
    WHERE plate_number = $1
    RETURNING *
  `;
  const result = await pool.query(query, [plateNumber, priority]);
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

export async function getPlateDetails(plateNumber) {
  const pool = await getPool();
  const query = `
    SELECT 
      p.notes, 
      p.name,
      pn.priority,
      pn.enabled
    FROM plates p
    LEFT JOIN plate_notifications pn ON p.plate_number = pn.plate_number
    WHERE p.plate_number = $1
  `;
  const result = await pool.query(query, [plateNumber]);
  return result.rows[0];
}

export async function getMetrics(startDate, endDate) {
  const pool = await getPool();
  const query = `
    WITH daily_stats AS (
      SELECT 
        COUNT(DISTINCT plate_number) as unique_plates,
        COUNT(*) as total_reads
      FROM plate_reads 
      WHERE timestamp > $1::timestamp with time zone - INTERVAL '24 hours' AND timestamp <= $1::timestamp with time zone
    ),
    weekly_stats AS (
      SELECT COUNT(DISTINCT plate_number) as weekly_unique
      FROM plate_reads 
      WHERE timestamp > $2::timestamp with time zone AND timestamp <= $1::timestamp with time zone
    ),
    suspicious_all_time AS (
      SELECT COUNT(DISTINCT pr.plate_number) as suspicious_count
      FROM plate_reads pr
      JOIN plate_tags pt ON pr.plate_number = pt.plate_number
      JOIN tags t ON pt.tag_id = t.id
      WHERE t.name = 'Suspicious'
    ),
    time_data AS (
      SELECT 
        timestamp,
        EXTRACT(HOUR FROM timestamp)::integer as hour,
        1 as frequency
      FROM plate_reads
      WHERE timestamp > $2::timestamp with time zone AND timestamp <= $1::timestamp with time zone
    ),
    top_plates AS (
      SELECT 
        pr.plate_number,
        COUNT(*) as occurrence_count,
        kp.name as known_name,
        array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
          FILTER (WHERE t.name IS NOT NULL) as tags
      FROM plate_reads pr
      LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
      LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE timestamp > $1::timestamp with time zone - INTERVAL '24 hours' 
        AND timestamp <= $1::timestamp with time zone
      GROUP BY pr.plate_number, kp.name
      ORDER BY COUNT(*) DESC
      LIMIT 10
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
      (SELECT json_agg(json_build_object(
        'timestamp', timestamp,
        'hour', hour,
        'frequency', frequency
      )) FROM time_data) as time_data,
      (SELECT json_agg(json_build_object(
        'plate', plate_number,
        'count', occurrence_count,
        'name', known_name,
        'tags', tags
      )) FROM top_plates) as top_plates
    FROM daily_stats d, weekly_stats w, suspicious_all_time s, total_plates tp
  `;

  const result = await pool.query(query, [endDate, startDate]);
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
      kp.ignore,
      kp.created_at,
      array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags,
      (SELECT flagged FROM plates WHERE plate_number = kp.plate_number LIMIT 1) as flagged
     FROM known_plates kp
     LEFT JOIN plate_tags pt ON kp.plate_number = pt.plate_number
     LEFT JOIN tags t ON pt.tag_id = t.id
     GROUP BY kp.plate_number, kp.name, kp.notes, kp.ignore, kp.created_at
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

export async function getTagsForPlate(plateNumber) {
  const pool = await getPool();
  const result = await pool.query(
    `SELECT t.name 
     FROM plate_tags pt 
     JOIN tags t ON pt.tag_id = t.id 
     WHERE pt.plate_number = $1`,
    [plateNumber]
  );
  return result.rows.map((row) => row.name);
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM plates 
       WHERE plate_number = $1`,
      [plateNumber]
    );

    await client.query(
      `DELETE FROM known_plates 
       WHERE plate_number = $1`,
      [plateNumber]
    );

    await client.query(
      `DELETE FROM plate_tags 
       WHERE plate_number = $1`,
      [plateNumber]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error removing plate:", error);
    throw error;
  } finally {
    client.release();
  }
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
    WITH recent_reads AS (
      SELECT timestamp, image_data
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
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) FILTER (WHERE t.name IS NOT NULL) as tags,
      (SELECT json_agg(json_build_object(
        'timestamp', timestamp,
        'hour', EXTRACT(HOUR FROM timestamp),
        'frequency', 1
      )) FROM plate_reads WHERE plate_number = $1) as time_data,
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
    GROUP BY p.plate_number, p.first_seen_at, kp.name, kp.notes
  `,
    [plateNumber]
  );
  return result.rows[0];
}

export async function cleanupOldRecords(maxRecords) {
  const pool = await getPool();

  try {
    // First check if we're over the threshold
    const {
      rows: [{ count }],
    } = await pool.query("SELECT COUNT(*) as count FROM plate_reads");

    console.log(
      `Current plate_reads count: ${count}, threshold: ${maxRecords * 1.1}`
    );

    // Only cleanup if we're 10% over the limit
    if (count > maxRecords * 1.1) {
      const deleteResult = await pool.query(
        `
        DELETE FROM plate_reads 
        WHERE id IN (
          SELECT id FROM plate_reads
          ORDER BY timestamp ASC
          LIMIT (SELECT COUNT(*) - $1 FROM plate_reads)
        )
        `,
        [maxRecords]
      );

      console.log(`Cleaned up ${deleteResult.rowCount} old records`);
    }
  } catch (error) {
    console.error("Error cleaning up old records:", error);
    throw error;
  }
}

export async function getDistinctCameraNames() {
  const pool = await getPool();
  try {
    const query = `
      SELECT DISTINCT camera_name 
      FROM plate_reads 
      WHERE camera_name IS NOT NULL 
      ORDER BY camera_name`;

    const result = await pool.query(query);
    return result.rows.map((row) => row.camera_name);
  } catch (error) {
    console.error("Error fetching camera names:", error);
    return [];
  }
}

export async function updatePlateRead(readId, newPlateNumber) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE plate_reads 
       SET plate_number = $1 
       WHERE id = $2`,
      [newPlateNumber, readId]
    );

    // Create new entry in plates table instead of updating the old one to prevent data loss in edge case where the misread is a real plate
    await client.query(
      `INSERT INTO plates (plate_number)
       VALUES ($1)
       ON CONFLICT (plate_number) DO NOTHING`,
      [newPlateNumber]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAllPlateReads(oldPlateNumber, newPlateNumber) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE plate_reads 
       SET plate_number = $1 
       WHERE plate_number = $2`,
      [newPlateNumber, oldPlateNumber]
    );

    await client.query(
      `INSERT INTO plates (plate_number)
       VALUES ($1)
       ON CONFLICT (plate_number) DO NOTHING`,
      [newPlateNumber]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function togglePlateIgnore(plateNumber, ignore) {
  const pool = await getPool();
  const result = await pool.query(
    `UPDATE plates 
     SET ignore = $1
     WHERE plate_number = $2
     RETURNING *`,
    [ignore, plateNumber]
  );

  return result.rows[0];
}
