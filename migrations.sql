CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


ALTER TABLE IF EXISTS public.plate_notifications 
    ADD COLUMN IF NOT EXISTS priority integer DEFAULT 1;

ALTER TABLE IF EXISTS public.plate_reads 
    ADD COLUMN IF NOT EXISTS camera_name character varying(25); 
     
ALTER TABLE known_plates ADD COLUMN ignore BOOLEAN DEFAULT FALSE;

ALTER TABLE plates ADD COLUMN occurrence_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_plates_occurrence_count ON plates(occurrence_count);

-- Count incrementing
CREATE OR REPLACE FUNCTION update_plate_occurrence_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Insert into plates if it doesn't exist, increment if it does
        INSERT INTO plates (plate_number, occurrence_count)
        VALUES (NEW.plate_number, 1)
        ON CONFLICT (plate_number)
        DO UPDATE SET occurrence_count = plates.occurrence_count + 1;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement count and remove plate if count reaches 0
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

-- Trigger from plate_reads
CREATE TRIGGER plate_reads_count_trigger
AFTER INSERT OR DELETE ON plate_reads
FOR EACH ROW
EXECUTE FUNCTION update_plate_occurrence_count();