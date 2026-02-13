-- -- FULL SCHEMA → JSON (tables, columns, PKs, unique indexes, FKs)
-- SET NOCOUNT ON;

-- SELECT
--   s.name  AS schema_name,
--   t.name  AS table_name,

--   -- Columns
--   (
--     SELECT
--       c.column_id,
--       c.name                          AS column_name,
--       TYPE_NAME(c.user_type_id)       AS data_type,
--       c.max_length,
--       c.precision,
--       c.scale,
--       c.is_nullable,
--       dc.definition                   AS default_definition
--     FROM sys.columns c
--     LEFT JOIN sys.default_constraints dc
--       ON dc.object_id = c.default_object_id
--     WHERE c.object_id = t.object_id
--     ORDER BY c.column_id
--     FOR JSON PATH
--   ) AS columns,

--   -- Primary key (may be composite)
--   (
--     SELECT
--       i.name                          AS pk_name,
--       ic.key_ordinal,
--       col.name                        AS column_name
--     FROM sys.indexes i
--     JOIN sys.index_columns ic
--       ON ic.object_id = i.object_id AND ic.index_id = i.index_id
--     JOIN sys.columns col
--       ON col.object_id = ic.object_id AND col.column_id = ic.column_id
--     WHERE i.object_id = t.object_id
--       AND i.is_primary_key = 1
--     ORDER BY ic.key_ordinal
--     FOR JSON PATH
--   ) AS primary_key,

--   -- Unique constraints / unique indexes (non-PK)
--   (
--     SELECT
--       i.name                          AS unique_name,
--       ic.key_ordinal,
--       col.name                        AS column_name
--     FROM sys.indexes i
--     JOIN sys.index_columns ic
--       ON ic.object_id = i.object_id AND ic.index_id = i.index_id
--     JOIN sys.columns col
--       ON col.object_id = ic.object_id AND col.column_id = ic.column_id
--     WHERE i.object_id = t.object_id
--       AND i.is_unique = 1
--       AND i.is_primary_key = 0
--     ORDER BY i.name, ic.key_ordinal
--     FOR JSON PATH
--   ) AS unique_constraints,

--   -- Foreign keys
--   (
--     SELECT
--       fk.name                         AS fk_name,
--       cparent.name                    AS column_name,
--       sref.name                       AS referenced_schema,
--       tref.name                       AS referenced_table,
--       cref.name                       AS referenced_column,
--       fk.delete_referential_action_desc AS on_delete,
--       fk.update_referential_action_desc AS on_update
--     FROM sys.foreign_keys fk
--     JOIN sys.foreign_key_columns fkc
--       ON fkc.constraint_object_id = fk.object_id
--     JOIN sys.columns cparent
--       ON cparent.object_id = fkc.parent_object_id
--      AND cparent.column_id = fkc.parent_column_id
--     JOIN sys.tables tref
--       ON tref.object_id = fkc.referenced_object_id
--     JOIN sys.schemas sref
--       ON sref.schema_id = tref.schema_id
--     JOIN sys.columns cref
--       ON cref.object_id = fkc.referenced_object_id
--      AND cref.column_id = fkc.referenced_column_id
--     WHERE fkc.parent_object_id = t.object_id
--     ORDER BY fk.name, fkc.constraint_column_id
--     FOR JSON PATH
--   ) AS foreign_keys

-- FROM sys.tables t
-- JOIN sys.schemas s ON s.schema_id = t.schema_id
-- ORDER BY s.name, t.name
-- FOR JSON PATH, ROOT('schema');






-- SELECT * FROM dbo.users;
SELECT * FROM dbo.people;
-- SELECT * FROM PERSON_PARENT;
-- SELECT * FROM PERSON_SIBLING;
-- SELECT * FROM PERSON_SPOUSE;

