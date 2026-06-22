DROP TABLE IF EXISTS vm_snapshot CASCADE;
DROP TABLE IF EXISTS vcenter CASCADE;

CREATE TABLE vcenter (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(255) NOT NULL
);

CREATE TABLE vm_snapshot (
    id SERIAL PRIMARY KEY,

    vm_uid VARCHAR(100) NOT NULL,
    vcenter_id INTEGER NOT NULL,

    name VARCHAR(255),
    os VARCHAR(255),
    cluster_name VARCHAR(255),

    cpu INTEGER,
    memory_mb NUMERIC(10,2),
    storage_gb NUMERIC(10,2),

    creation_date TIMESTAMP,

    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (vcenter_id) REFERENCES vcenter(id)
);

CREATE TABLE vm_historique_changement (
    id SERIAL PRIMARY KEY,

    vm_uid VARCHAR(100) NOT NULL,
    vcenter_id INTEGER NOT NULL,

    vm_name VARCHAR(255),

    libelle VARCHAR(100) NOT NULL,

    old_value TEXT,
    new_value TEXT,

    change_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (vcenter_id) REFERENCES vcenter(id)
);
CREATE INDEX idx_historique_vm_uid ON vm_historique_changement(vm_uid);
CREATE INDEX idx_history_date ON vm_historique_changement(change_date);
CREATE INDEX idx_history_vcenter ON vm_historique_changement(vcenter_id);

CREATE INDEX idx_vm_uid ON vm_snapshot(vm_uid);
CREATE INDEX idx_snapshot_date ON vm_snapshot(snapshot_date);

INSERT INTO vm_historique_changement (vm_uid, date_changement, modifications)
VALUES
('vm-101', '2026-06-15 08:10:00', 'CPU augmente de 2 a 4 cores'),
('vm-101', '2026-06-15 10:45:00', 'RAM augmente de 4GB a 8GB'),
('vm-101', '2026-06-15 14:20:00', 'Disque ajoute de 50GB'),
('vm-102', '2026-06-15 09:00:00', 'VM demarree'),
('vm-102', '2026-06-15 12:30:00', 'OS mis a jour');

DELETE FROM vm_snapshot WHERE snapshot_date::date = CURRENT_DATE;

DELETE FROM  vm_historique_changement WHERE change_date::date = CURRENT_DATE;

SELECT COUNT(*) FROM vm_snapshot WHERE snapshot_date::date = CURRENT_DATE;

SELECT * FROM vm_snapshot WHERE name ILIKE '%';
SELECT * FROM vm_snapshot WHERE name='';

DELETE FROM vm_snapshot WHERE snapshot_date >= '2026-06-15 16:00:00' AND snapshot_date <  '2026-06-15 17:00:00';