-- Delete children before parents without disabling foreign key constraints.
DELETE FROM SPRING_SESSION_ATTRIBUTES;
DELETE FROM SPRING_SESSION;
DELETE FROM time_block_tasks;
DELETE FROM time_blocks;
DELETE FROM time_tables;
DELETE FROM template_blocks;
DELETE FROM calendar_event;
DELETE FROM schedule;
DELETE FROM todo_tasks;
DELETE FROM users;
