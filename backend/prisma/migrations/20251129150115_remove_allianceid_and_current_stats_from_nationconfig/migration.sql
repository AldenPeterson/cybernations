-- AlterTable
-- Drop columns if they exist (using DO block for conditional drops)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nation_configs' AND column_name = 'alliance_id') THEN
        ALTER TABLE "nation_configs" DROP COLUMN "alliance_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nation_configs' AND column_name = 'current_tech') THEN
        ALTER TABLE "nation_configs" DROP COLUMN "current_tech";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nation_configs' AND column_name = 'current_infra') THEN
        ALTER TABLE "nation_configs" DROP COLUMN "current_infra";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nation_configs' AND column_name = 'current_strength') THEN
        ALTER TABLE "nation_configs" DROP COLUMN "current_strength";
    END IF;
END $$;
