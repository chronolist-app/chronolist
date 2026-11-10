-- TiDBではV1の time_blocks.schedule_id 用の外部キーと索引に fk_3 が自動採番される。
-- 外部キーを削除しても索引は残るため、列を削除する前に索引も削除する。
ALTER TABLE time_blocks DROP FOREIGN KEY fk_3;
ALTER TABLE time_blocks DROP INDEX fk_3;
ALTER TABLE time_blocks DROP COLUMN schedule_id;
