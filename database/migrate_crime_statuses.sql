-- Chay mot lan tren database crime_db_new de mo rong danh sach trang thai ho so.
-- Tuong thich MySQL 8 / MariaDB.
USE crime_db_new;
ALTER TABLE crime_records
    MODIFY COLUMN status VARCHAR(40) NOT NULL DEFAULT 'under_investigation';

-- Cac gia tri duoc ho tro:
-- under_investigation, wanted, detained, arrested, prosecuted, awaiting_trial,
-- convicted, serving_sentence, released, acquitted, case_suspended, case_closed, deceased
