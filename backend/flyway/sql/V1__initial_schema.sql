-- 本番用初期スキーマ。適用後は編集せず、変更は次のバージョンのSQLに追加する。
-- Usersテーブルの作成
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    login_id VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(60) NOT NULL,
    role VARCHAR(8) NOT NULL,
    -- roleがとれる値の制約
    CONSTRAINT chk_role CHECK (role IN ('GENERAL', 'ADMIN'))
);


-- scheduleテーブルの作成
CREATE TABLE schedule (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    kind VARCHAR(8) NOT NULL,
    start_at TIMESTAMP NULL,
    end_at TIMESTAMP NULL,
    start_date DATE,
    end_date DATE,
    tz varchar(64) NOT NULL DEFAULT 'Asia/Tokyo',
    title VARCHAR(64) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),

    -- kindが「DATED」か「ALL_DAY」のどちらかをとるための制約
    CONSTRAINT chk_kind_str CHECK (kind IN ('DATED', 'ALL_DAY')),

    CONSTRAINT chk_kind_timed
        CHECK (
            -- 「通常予定」のときにstart_atとend_atが必ず値をもつための制約. また開始時刻と終了時刻が同じか, 終了時刻が後になるための制約
            (kind = 'DATED' and start_at is NOT NULL and end_at is NOT NULL and start_at <= end_at)
            or
            -- 「終日予定」のときにstart_dateとend_dateが必ず値をもつための制約. また開始日と終了日が同じか, 終了日が後になるための制約
            (kind = 'ALL_DAY' and start_date is not NULL and end_date is not NULL and start_date <= end_date)
        ),

    CONSTRAINT chk_exclusive
        CHECK (
            -- 「通常予定」のときにstart_dateとend_dateが必ずnullを持つための制約
            (kind = 'DATED' and start_date is NULL and end_date is NULL)
            or
            -- 「終日予定」のときにstart_atとend_atが必ずnullを持つための制約
            (kind = 'ALL_DAY' and start_at is NULL and end_at is NULL)
        )
);

-- calendar_eventテーブルの作成
CREATE TABLE calendar_event (
    id INT PRIMARY KEY AUTO_INCREMENT,
    schedule_id INT NOT NULL,
    color VARCHAR(16) NOT NULL,
    memo TEXT,
    FOREIGN KEY (schedule_id) REFERENCES schedule(id)
);


-- todo_tasksテーブルの作成
CREATE TABLE todo_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(64) NOT NULL,
    priority VARCHAR(8) NOT NULL,
    due_kind VARCHAR(16) NOT NULL,
    due_date DATE,
    due_time TIME,
    is_completed BOOLEAN DEFAULT FALSE,
    memo TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),

    -- priorityがとれる値の制約
    CONSTRAINT chk_priority CHECK (priority IN ('HIGH', 'MIDDLE', 'LOW')),
    -- due_kindがとれる値の制約
    CONSTRAINT chk_due_kind CHECK (due_kind IN ('NONE', 'DATED', 'DATETIME')),
    -- due_kindの値に基づいてdue_dateとdue_timeが値をとっているかの確認
    CONSTRAINT chk_due_date
        CHECK (
            (due_kind = 'NONE' and due_date IS NULL and due_time IS NULL)
            or
            (due_kind = 'DATED' and due_date is NOT NULL and due_time IS NULL)
            or
            (due_kind = 'DATETIME' and due_date is NOT NULL and due_time is NOT NULL)
        )
);


-- time_tablesテーブルの作成
CREATE TABLE time_tables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    -- user_idとdateの組み合わせが一意であることを保証する制約
    CONSTRAINT uq_time_tables_user_date UNIQUE (user_id, date)
);

-- time_blocksテーブルの作成
CREATE TABLE time_blocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    table_id INT,
    title VARCHAR(64) NOT NULL,
    status VARCHAR(8) NOT NULL,
    schedule_id INT,
    width INT NOT NULL,
    start_at TIME,
    color VARCHAR(8) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (table_id)
        REFERENCES time_tables(id)
        ON DELETE CASCADE,
    FOREIGN KEY (schedule_id)
        REFERENCES schedule(id)
        ON DELETE CASCADE,

    -- statusがとれる値の制約
    CONSTRAINT chk_status CHECK (status IN ('PLACED', 'HOLD'))
);

-- time_block_tasksテーブルの作成
CREATE TABLE time_block_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    time_block_id INT NOT NULL,
    title VARCHAR(64) NOT NULL,
    FOREIGN KEY (time_block_id)
        REFERENCES time_blocks(id)
        ON DELETE CASCADE
);

-- template_blocksテーブルの作成
CREATE TABLE template_blocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(64) NOT NULL,
    width INT NOT NULL,
    color VARCHAR(8) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
