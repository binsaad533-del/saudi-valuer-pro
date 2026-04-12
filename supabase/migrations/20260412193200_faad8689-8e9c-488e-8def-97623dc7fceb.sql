-- Check current schema version / applied migrations
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;