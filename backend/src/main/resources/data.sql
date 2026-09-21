-- usersテーブルへの初期データ登録
INSERT INTO users (login_id, password, role)
VALUES
('admin', '$2a$10$onA5jAPMZOislXd8/X27ue1EaJiI35PcX0aZZtY5YaGcaaeH2ytlW', 'GENERAL');

-- scheduleテーブル, およびcalendar_eventテーブルへの初期データ登録
INSERT INTO schedule (user_id, kind, start_at, end_at, start_date, end_date, title)
VALUES
(1, 'DATED', '2025-10-31 12:00:00', '2025-10-31 14:00:00', null, null, '会議');
INSERT INTO calendar_event (schedule_id, color, memo)
VALUES
(1, 'RED', '12:00に集合');
INSERT INTO schedule (user_id, kind, start_at, end_at, start_date, end_date, title)
VALUES
(1, 'ALL_DAY', null, null, '2025-11-01', '2025-11-03', 'バイト');
INSERT INTO calendar_event (schedule_id, color, memo)
VALUES
(2, 'BLUE', '働きたくない');

-- todo_tasksテーブルへの初期データ登録
INSERT INTO todo_tasks (user_id, title, priority, due_kind, due_date, due_time, memo)
VALUES
(1, 'spring bootの勉強', 'LOW', 'NONE', null, null, 'むずすぎ');
INSERT INTO todo_tasks (user_id, title, priority, due_kind, due_date, due_time, memo)
VALUES
(1, '課題提出', 'MIDDLE', 'DATED', '2025-10-22', null, 'めんどくさ');
INSERT INTO todo_tasks (user_id, title, priority, due_kind, due_date, due_time, memo)
VALUES
(1, '卒研論文の提出', 'HIGH', 'DATETIME', '2026-01-26', '13:30:00', '教授へ直接手渡しする');

-- time_tablesテーブルへの初期データ登録
INSERT INTO time_tables (user_id, date)
VALUES
(1, '2025-12-29');
INSERT INTO time_tables (user_id, date)
VALUES
(1, '2025-10-31');

-- time_blocksテーブルへの初期データ登録
INSERT INTO time_blocks (user_id, table_id, title, status, schedule_id, width, start_at, color)
VALUES
(1, 1, '病院', 'PLACED', null, 180, '9:30:00', 'RED');
INSERT INTO time_blocks (user_id, table_id, title, status, schedule_id, width, start_at, color)
VALUES
(1, 1, 'オンライン授業', 'PLACED', null, 90, '10:30:00', 'PINK');
INSERT INTO time_blocks (user_id, table_id, title, status, schedule_id, width, start_at, color)
VALUES
(1, 1, '基本情報の対策', 'PLACED', null, 90, '11:30:00', 'RED');
INSERT INTO time_blocks (user_id, table_id, title, status, schedule_id, width, start_at, color)
VALUES
(1, 1, '映画鑑賞', 'PLACED', null, 120, '16:00:00', 'BLUE');
INSERT INTO time_blocks (user_id, table_id, title, status, schedule_id, width, start_at, color)
VALUES
(1, 2, '会議', 'PLACED', 1, 2, '12:00:00', 'RED');
INSERT INTO time_blocks (user_id, table_id, title, status, schedule_id, width, start_at, color)
VALUES
(1, null, 'ゲーム', 'HOLD', null, 180, null, 'RED');
INSERT INTO time_blocks (user_id, table_id, title, status, schedule_id, width, start_at, color)
VALUES
(1, null, '読書', 'HOLD', null, 120, null, 'GREEN');

-- time_block_tasksテーブルへの初期データ登録
INSERT INTO time_block_tasks (time_block_id, title)
VALUES
(1, 'データベース分野の復習');
INSERT INTO time_block_tasks (time_block_id, title)
VALUES
(1, 'ネットワーク分野の勉強');
INSERT INTO time_block_tasks (time_block_id, title)
VALUES
(1, '科目Bの勉強');

-- template_blocksテーブルへの初期データ登録
INSERT INTO template_blocks (user_id, title, width, color)
VALUES
(1, 'バイト', 300, 'GREEN');
INSERT INTO template_blocks (user_id, title, width, color)
VALUES
(1, 'ゼミ', 200, 'RED');
