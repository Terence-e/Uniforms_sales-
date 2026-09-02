-- Down for 20260101003400_list_documents.sql.
--
-- Read-only function over existing tables: dropping it removes the ledger
-- screen's data source and nothing else.

drop function if exists public.list_documents(text[], date, date, integer, integer);
