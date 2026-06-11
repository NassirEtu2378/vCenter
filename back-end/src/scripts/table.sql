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

CREATE INDEX idx_vm_uid ON vm_snapshot(vm_uid);
CREATE INDEX idx_snapshot_date ON vm_snapshot(snapshot_date);

