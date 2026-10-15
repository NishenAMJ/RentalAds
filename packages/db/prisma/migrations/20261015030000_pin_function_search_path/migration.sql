-- Supabase security advisor: "Function public.assign_listing_reference has a role mutable search_path".
-- Without a fixed search_path the function resolves names (here the sequence) using whatever path the calling role
-- has, which can be abused by creating look-alike objects in a schema earlier on that path.
-- Pinning it changes no behaviour: the sequence lives in "public". pg_temp is listed last so temporary objects
-- can never shadow real ones. Metadata only; no data is touched.
ALTER FUNCTION public.assign_listing_reference() SET search_path = public, pg_temp;
