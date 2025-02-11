CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;

-- Modify plate_notifications
ALTER TABLE IF EXISTS public.plate_notifications 
    ADD COLUMN IF NOT EXISTS priority integer DEFAULT 1;

-- Modify plate_reads
ALTER TABLE IF EXISTS public.plate_reads 
    ADD COLUMN IF NOT EXISTS camera_name character varying(25),
    ADD COLUMN IF NOT EXISTS image_path varchar(255),
    ADD COLUMN IF NOT EXISTS thumbnail_path varchar(255),
    ADD COLUMN IF NOT EXISTS bi_path varchar(100);
     
-- Modify known_plates
ALTER TABLE IF EXISTS public.known_plates 
    ADD COLUMN IF NOT EXISTS ignore BOOLEAN DEFAULT FALSE;

-- Modify plates
ALTER TABLE IF EXISTS public.plates 
    ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 0;

-- Create index if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_plates_occurrence_count') THEN
        CREATE INDEX idx_plates_occurrence_count ON plates(occurrence_count);
    END IF;
END $$;

-- Count incrementing function
CREATE OR REPLACE FUNCTION update_plate_occurrence_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO plates (plate_number, occurrence_count)
        VALUES (NEW.plate_number, 1)
        ON CONFLICT (plate_number)
        DO UPDATE SET occurrence_count = plates.occurrence_count + 1;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE plates 
        SET occurrence_count = occurrence_count - 1
        WHERE plate_number = OLD.plate_number;
        
        DELETE FROM plates
        WHERE plate_number = OLD.plate_number
        AND occurrence_count <= 0;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'plate_reads_count_trigger') THEN
        CREATE TRIGGER plate_reads_count_trigger
        AFTER INSERT OR DELETE ON plate_reads
        FOR EACH ROW
        EXECUTE FUNCTION update_plate_occurrence_count();
    END IF;
END $$;

-- Clerical stuff
CREATE TABLE IF NOT EXISTS devmgmt (
    id SERIAL PRIMARY KEY,
    update1 BOOLEAN DEFAULT FALSE
);
INSERT INTO devmgmt (id, update1)
SELECT 1, false
WHERE NOT EXISTS (SELECT 1 FROM devmgmt);