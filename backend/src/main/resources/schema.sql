-- テーブルが存在したら削除
DROP TABLE IF EXISTS SPRING_SESSION_ATTRIBUTES;
DROP TABLE IF EXISTS SPRING_SESSION;
DROP TABLE IF EXISTS time_block_tasks;
DROP TABLE IF EXISTS time_blocks;
DROP TABLE IF EXISTS calendar_event;
DROP TABLE IF EXISTS template_blocks;
DROP TABLE IF EXISTS todo_tasks;
DROP TABLE IF EXISTS time_tables;
DROP TABLE IF EXISTS schedule;
DROP TABLE IF EXISTS users;

-- Spring Session JDBC: same columns, indexes and constraints as Flyway V2.
-- H2 uses its default storage engine; MySQL's ENGINE / ROW_FORMAT are omitted.
CREATE TABLE SPRING_SESSION (
    PRIMARY_ID CHAR(36) NOT NULL,
    SESSION_ID CHAR(36) NOT NULL,
    CREATION_TIME BIGINT NOT NULL,
    LAST_ACCESS_TIME BIGINT NOT NULL,
    MAX_INACTIVE_INTERVAL INT NOT NULL,
    EXPIRY_TIME BIGINT NOT NULL,
    PRINCIPAL_NAME VARCHAR(100),
    CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);

CREATE UNIQUE INDEX SPRING_SESSION_IX1 ON SPRING_SESSION (SESSION_ID);
CREATE INDEX SPRING_SESSION_IX2 ON SPRING_SESSION (EXPIRY_TIME);
CREATE INDEX SPRING_SESSION_IX3 ON SPRING_SESSION (PRINCIPAL_NAME);

CREATE TABLE SPRING_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36) NOT NULL,
    ATTRIBUTE_NAME VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES BLOB NOT NULL,
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK FOREIGN KEY (SESSION_PRIMARY_ID)
        REFERENCES SPRING_SESSION(PRIMARY_ID) ON DELETE CASCADE
);


-- Usersテーブルの作成
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    login_id VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(60) NOT NULL,
    role VARCHAR(8) NOT NULL,
    -- roleがとれる値の制約
    CONSTRAINT chk_role CHECK (role IN ('GENERAL', 'ADMIN'))
);


-- scheduleテーブルの作成（H2 Database Ver）
CREATE TABLE schedule (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    kind VARCHAR(8) NOT NULL,
    start_at TIMESTAMP,
    end_at TIMESTAMP,
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

-- calendar_eventテーブルの作成（H2 Database Ver）
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
