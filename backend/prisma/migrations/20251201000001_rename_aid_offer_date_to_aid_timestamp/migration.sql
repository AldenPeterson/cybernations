-- Rename AidOffer.date column to aid_timestamp to avoid using reserved/ambiguous name "date"
ALTER TABLE "aid_offers" RENAME COLUMN "date" TO "aid_timestamp";

