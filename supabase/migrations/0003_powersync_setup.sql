-- Bloque anónimo para crear de forma segura la publicación 'powersync' si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
        CREATE PUBLICATION powersync FOR ALL TABLES;
    END IF;
END $$;
