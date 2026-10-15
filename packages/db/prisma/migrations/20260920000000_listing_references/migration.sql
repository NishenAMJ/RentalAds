ALTER TABLE "listings" ADD COLUMN "reference" TEXT;
CREATE UNIQUE INDEX "listings_reference_key" ON "listings"("reference");
CREATE SEQUENCE listing_reference_sequence;

-- Allocate atomically at approval, including approvals made by trusted tooling.
-- A sequence avoids duplicate references when two admins approve concurrently.
CREATE FUNCTION assign_listing_reference() RETURNS trigger AS $$
DECLARE sequence_number TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."reference" IS NOT NULL THEN
    NEW."reference" := OLD."reference";
  ELSIF NEW."status" = 'ACTIVE' THEN
    sequence_number := nextval('listing_reference_sequence')::TEXT;
    NEW."reference" := 'SL-' || lpad(sequence_number, greatest(6, length(sequence_number)), '0');
  ELSE
    NEW."reference" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_assign_reference
BEFORE INSERT OR UPDATE ON "listings"
FOR EACH ROW EXECUTE FUNCTION assign_listing_reference();

-- Existing approved, active inventory must also be searchable by reference.
UPDATE "listings" SET "status" = 'ACTIVE' WHERE "status" = 'ACTIVE';
