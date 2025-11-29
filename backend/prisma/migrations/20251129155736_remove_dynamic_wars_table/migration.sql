-- DropTable
-- Drop the dynamic_wars table and its foreign key constraints
DO $$
BEGIN
    -- Drop foreign key constraints if they exist
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'dynamic_wars' AND constraint_name = 'dynamic_wars_declaring_nation_id_fkey') THEN
        ALTER TABLE "dynamic_wars" DROP CONSTRAINT "dynamic_wars_declaring_nation_id_fkey";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'dynamic_wars' AND constraint_name = 'dynamic_wars_receiving_nation_id_fkey') THEN
        ALTER TABLE "dynamic_wars" DROP CONSTRAINT "dynamic_wars_receiving_nation_id_fkey";
    END IF;
    
    -- Drop indexes if they exist
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'dynamic_wars' AND indexname = 'dynamic_wars_declaring_nation_id_idx') THEN
        DROP INDEX "dynamic_wars_declaring_nation_id_idx";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'dynamic_wars' AND indexname = 'dynamic_wars_receiving_nation_id_idx') THEN
        DROP INDEX "dynamic_wars_receiving_nation_id_idx";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'dynamic_wars' AND indexname = 'dynamic_wars_status_idx') THEN
        DROP INDEX "dynamic_wars_status_idx";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'dynamic_wars' AND indexname = 'dynamic_wars_war_id_key') THEN
        DROP INDEX "dynamic_wars_war_id_key";
    END IF;
    
    -- Drop the table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dynamic_wars') THEN
        DROP TABLE "dynamic_wars";
    END IF;
END $$;

