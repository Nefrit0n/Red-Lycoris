-- Admin v2 access model: teams + product access matrix bound by tenant_id

-- Composite uniqueness needed for tenant-scoped foreign keys.
ALTER TABLE users
    ADD CONSTRAINT users_tenant_id_id_unique UNIQUE (tenant_id, id);

ALTER TABLE products
    ADD CONSTRAINT products_tenant_id_id_unique UNIQUE (tenant_id, id);

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT teams_tenant_name_unique UNIQUE (tenant_id, name),
    CONSTRAINT teams_tenant_id_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX idx_teams_tenant_created_at
    ON teams (tenant_id, created_at DESC);

CREATE TABLE team_members (
    tenant_id UUID NOT NULL,
    team_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id),
    CONSTRAINT team_members_tenant_team_fk
        FOREIGN KEY (tenant_id, team_id)
        REFERENCES teams (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT team_members_tenant_user_fk
        FOREIGN KEY (tenant_id, user_id)
        REFERENCES users (tenant_id, id)
        ON DELETE CASCADE
);

CREATE INDEX idx_team_members_tenant_user
    ON team_members (tenant_id, user_id);

CREATE INDEX idx_team_members_tenant_team
    ON team_members (tenant_id, team_id);

CREATE TABLE product_team_roles (
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL,
    team_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('maintainer', 'engineer', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, team_id),
    CONSTRAINT product_team_roles_tenant_product_fk
        FOREIGN KEY (tenant_id, product_id)
        REFERENCES products (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT product_team_roles_tenant_team_fk
        FOREIGN KEY (tenant_id, team_id)
        REFERENCES teams (tenant_id, id)
        ON DELETE CASCADE
);

CREATE INDEX idx_product_team_roles_tenant_product
    ON product_team_roles (tenant_id, product_id);

CREATE INDEX idx_product_team_roles_tenant_team
    ON product_team_roles (tenant_id, team_id);

CREATE TABLE product_user_roles (
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('maintainer', 'engineer', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, user_id),
    CONSTRAINT product_user_roles_tenant_product_fk
        FOREIGN KEY (tenant_id, product_id)
        REFERENCES products (tenant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT product_user_roles_tenant_user_fk
        FOREIGN KEY (tenant_id, user_id)
        REFERENCES users (tenant_id, id)
        ON DELETE CASCADE
);

CREATE INDEX idx_product_user_roles_tenant_product
    ON product_user_roles (tenant_id, product_id);

CREATE INDEX idx_product_user_roles_tenant_user
    ON product_user_roles (tenant_id, user_id);

-- Minimal seed for root user within its tenant.
WITH root_user AS (
    SELECT id, tenant_id
    FROM users
    WHERE username = 'root'
    LIMIT 1
), seeded_team AS (
    INSERT INTO teams (tenant_id, name, description)
    SELECT tenant_id, 'Основная команда', 'Команда по умолчанию для администрирования доступа'
    FROM root_user
    ON CONFLICT (tenant_id, name) DO UPDATE SET description = EXCLUDED.description
    RETURNING id, tenant_id
), resolved_team AS (
    SELECT id, tenant_id FROM seeded_team
    UNION ALL
    SELECT t.id, t.tenant_id
    FROM teams t
    JOIN root_user ru ON ru.tenant_id = t.tenant_id
    WHERE t.name = 'Основная команда'
    LIMIT 1
)
INSERT INTO team_members (tenant_id, team_id, user_id)
SELECT ru.tenant_id, rt.id, ru.id
FROM root_user ru
JOIN resolved_team rt ON rt.tenant_id = ru.tenant_id
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Optional seed: assign team access to one existing product in the same tenant.
WITH root_team AS (
    SELECT t.id, t.tenant_id
    FROM teams t
    JOIN users u ON u.tenant_id = t.tenant_id
    WHERE u.username = 'root' AND t.name = 'Основная команда'
    LIMIT 1
), one_product AS (
    SELECT p.id, p.tenant_id
    FROM products p
    JOIN root_team rt ON rt.tenant_id = p.tenant_id
    ORDER BY p.created_at ASC
    LIMIT 1
)
INSERT INTO product_team_roles (tenant_id, product_id, team_id, role)
SELECT op.tenant_id, op.id, rt.id, 'maintainer'
FROM one_product op
JOIN root_team rt ON rt.tenant_id = op.tenant_id
ON CONFLICT (product_id, team_id) DO NOTHING;
