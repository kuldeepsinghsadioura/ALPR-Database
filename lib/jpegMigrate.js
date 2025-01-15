import { getPool } from "@/lib/db";
import fileStorage from "@/lib/fileStorage";

async function migrateImages() {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    // Get all records with base64 images
    const { rows } = await client.query(
      `SELECT id, plate_number, image_data 
       FROM plate_reads 
       WHERE image_data IS NOT NULL 
         AND image_path IS NULL`
    );

    console.log(`Found ${rows.length} images to migrate`);

    for (const row of rows) {
      try {
        // Save image to filesystem
        const { imagePath, thumbnailPath } = await fileStorage.saveImage(
          row.image_data,
          row.plate_number
        );

        // Update database record
        await client.query(
          `UPDATE plate_reads 
           SET image_path = $1,
               thumbnail_path = $2,
               image_data = NULL
           WHERE id = $3`,
          [imagePath, thumbnailPath, row.id]
        );

        console.log(`Migrated image for plate ${row.plate_number}`);
      } catch (error) {
        console.error(
          `Failed to migrate image for plate ${row.plate_number}:`,
          error
        );
      }
    }

    console.log("Migration completed");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
if (require.main === module) {
  migrateImages()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
