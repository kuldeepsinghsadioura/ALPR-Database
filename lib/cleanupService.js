import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";

async function cleanupRecords() {
  const config = await getConfig();
  const maxRecords = config.maxRecords;

  const {
    rows: [{ count }],
  } = await db.sql`
    SELECT COUNT(*) as count FROM plate_reads
  `;

  // Only cleanup if we're 10% over the limit
  if (count > maxRecords * 1.1) {
    const deleteCount = count - maxRecords;

    await db.sql`
      DELETE FROM plate_reads
      WHERE id IN (
        SELECT id 
        FROM plate_reads 
        ORDER BY created_at ASC 
        LIMIT ${deleteCount}
      )
    `;

    console.log(
      `Cleaned up ${deleteCount} records. Current count: ${count}, Max limit: ${maxRecords}`
    );
  }
}

// Check every 15 minutes
setInterval(cleanupRecords, 1000 * 60 * 15);

// Run once on startup
cleanupRecords();
