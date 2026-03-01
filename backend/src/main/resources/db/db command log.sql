-- FULL SCHEMA → JSON (tables, columns, identity, computed cols, PKs,
--   unique indexes, all indexes, FKs, check constraints, triggers, row counts)
SET NOCOUNT ON;

SELECT
  s.name  AS schema_name,
  t.name  AS table_name,

  -- Approximate row count (avoids full table scans)
  (
    SELECT SUM(p2.rows)
    FROM sys.partitions p2
    WHERE p2.object_id = t.object_id AND p2.index_id IN (0, 1)
  ) AS row_count,

  -- Columns (with identity & computed info)
  (
    SELECT
      c.column_id,
      c.name                                          AS column_name,
      TYPE_NAME(c.user_type_id)                       AS data_type,
      c.max_length,
      c.precision,
      c.scale,
      c.is_nullable,
      c.is_identity,
      CASE WHEN c.is_identity = 1
           THEN CAST(IDENT_SEED(QUOTENAME(s.name) + '.' + QUOTENAME(t.name)) AS bigint)
      END                                             AS identity_seed,
      CASE WHEN c.is_identity = 1
           THEN CAST(IDENT_INCR(QUOTENAME(s.name) + '.' + QUOTENAME(t.name)) AS bigint)
      END                                             AS identity_increment,
      c.is_computed,
      cc.definition                                   AS computed_definition,
      cc.is_persisted                                 AS computed_persisted,
      dc.definition                                   AS default_definition
    FROM sys.columns c
    LEFT JOIN sys.default_constraints dc
      ON dc.object_id = c.default_object_id
    LEFT JOIN sys.computed_columns cc
      ON cc.object_id = c.object_id AND cc.column_id = c.column_id
    WHERE c.object_id = t.object_id
    ORDER BY c.column_id
    FOR JSON PATH
  ) AS columns,

  -- Primary key (may be composite)
  (
    SELECT
      i.name                          AS pk_name,
      ic.key_ordinal,
      col.name                        AS column_name
    FROM sys.indexes i
    JOIN sys.index_columns ic
      ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns col
      ON col.object_id = ic.object_id AND col.column_id = ic.column_id
    WHERE i.object_id = t.object_id
      AND i.is_primary_key = 1
    ORDER BY ic.key_ordinal
    FOR JSON PATH
  ) AS primary_key,

  -- Unique constraints / unique indexes (non-PK)
  (
    SELECT
      i.name                          AS unique_name,
      ic.key_ordinal,
      col.name                        AS column_name
    FROM sys.indexes i
    JOIN sys.index_columns ic
      ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns col
      ON col.object_id = ic.object_id AND col.column_id = ic.column_id
    WHERE i.object_id = t.object_id
      AND i.is_unique = 1
      AND i.is_primary_key = 0
    ORDER BY i.name, ic.key_ordinal
    FOR JSON PATH
  ) AS unique_constraints,

  -- All indexes (non-PK, non-unique — covers perf-relevant indexes)
  (
    SELECT
      i.name                          AS index_name,
      i.type_desc                     AS index_type,
      i.is_unique,
      i.filter_definition,
      (
        SELECT
          col2.name                   AS column_name,
          ic2.key_ordinal,
          ic2.is_descending_key,
          ic2.is_included_column
        FROM sys.index_columns ic2
        JOIN sys.columns col2
          ON col2.object_id = ic2.object_id AND col2.column_id = ic2.column_id
        WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id
        ORDER BY ic2.is_included_column, ic2.key_ordinal
        FOR JSON PATH
      ) AS index_columns
    FROM sys.indexes i
    WHERE i.object_id = t.object_id
      AND i.is_primary_key = 0
      AND i.type > 0                   -- skip heaps
    ORDER BY i.name
    FOR JSON PATH
  ) AS indexes,

  -- Foreign keys
  (
    SELECT
      fk.name                         AS fk_name,
      cparent.name                    AS column_name,
      sref.name                       AS referenced_schema,
      tref.name                       AS referenced_table,
      cref.name                       AS referenced_column,
      fk.delete_referential_action_desc AS on_delete,
      fk.update_referential_action_desc AS on_update
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc
      ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns cparent
      ON cparent.object_id = fkc.parent_object_id
     AND cparent.column_id = fkc.parent_column_id
    JOIN sys.tables tref
      ON tref.object_id = fkc.referenced_object_id
    JOIN sys.schemas sref
      ON sref.schema_id = tref.schema_id
    JOIN sys.columns cref
      ON cref.object_id = fkc.referenced_object_id
     AND cref.column_id = fkc.referenced_column_id
    WHERE fkc.parent_object_id = t.object_id
    ORDER BY fk.name, fkc.constraint_column_id
    FOR JSON PATH
  ) AS foreign_keys,

  -- Check constraints
  (
    SELECT
      ck.name                         AS check_name,
      ck.definition,
      ck.is_disabled
    FROM sys.check_constraints ck
    WHERE ck.parent_object_id = t.object_id
    ORDER BY ck.name
    FOR JSON PATH
  ) AS check_constraints,

  -- Triggers
  (
    SELECT
      tr.name                         AS trigger_name,
      tr.type_desc,
      CASE WHEN tr.is_instead_of_trigger = 1 THEN 'INSTEAD OF' ELSE 'AFTER' END AS firing,
      tr.is_disabled,
      OBJECT_DEFINITION(tr.object_id) AS trigger_definition
    FROM sys.triggers tr
    WHERE tr.parent_id = t.object_id
    ORDER BY tr.name
    FOR JSON PATH
  ) AS triggers

FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
ORDER BY s.name, t.name
FOR JSON PATH, ROOT('schema');






-- SELECT * FROM dbo.users;
-- SELECT * FROM dbo.people;
-- SELECT * FROM PERSON_PARENT;
-- SELECT * FROM PERSON_SIBLING;
-- SELECT * FROM PERSON_SPOUSE;
-- SELECT * FROM dbo.dues_payments;
-- SELECT * FROM dbo.orders;
-- SELECT * FROM dbo.order_items;