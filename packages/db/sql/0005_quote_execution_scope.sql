ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS execution_scope varchar(20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'quotes_execution_scope_check'
    ) THEN
        ALTER TABLE public.quotes
        ADD CONSTRAINT quotes_execution_scope_check
        CHECK (
            execution_scope IS NULL
            OR execution_scope IN ('interno', 'externo')
        );
    END IF;
END $$;
