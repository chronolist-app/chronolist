-- 終日予定の終了日は範囲に含まないため、開始日より後であることを保証する。
ALTER TABLE schedule ADD CONSTRAINT chk_all_day_nonempty
    CHECK (kind <> 'ALL_DAY' OR start_date < end_date);
