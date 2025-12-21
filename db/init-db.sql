-- Tabla principal de usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    wallet_address VARCHAR(100), -- Dirección USDT BEP-20 para recibir comisiones
    sponsor_id INTEGER REFERENCES users(id), -- Referencia al patrocinador
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, expired, removed
    last_paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de suscripciones mensuales
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, expired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de transacciones en USDT (blockchain)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id), -- Quién pagó
    sponsor_id INTEGER REFERENCES users(id), -- Quién recibe los 10 USDT
    tx_hash_sponsor VARCHAR(200) NOT NULL, -- Hash del pago al patrocinador
    tx_hash_system VARCHAR(200) NOT NULL, -- Hash del pago al sistema
    sponsor_share_usdt NUMERIC(10,2) DEFAULT 10.00,
    system_share_usdt NUMERIC(10,2) DEFAULT 5.00,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, invalid
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial de referidos (opcional pero útil)
CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id), -- Usuario referido
    sponsor_id INTEGER REFERENCES users(id), -- Patrocinador
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuración global del sistema
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(200) NOT NULL
);

-- Valores iniciales recomendados
INSERT INTO system_config (key, value) VALUES
('SYSTEM_USER_ID', '1'),
('SYSTEM_USDT_ADDRESS', 'TU_DIRECCION_USDT'),
('SUBSCRIPTION_PRICE', '15'),
('SPONSOR_SHARE', '10'),
('SYSTEM_SHARE', '5'),
('GRACE_PERIOD_DAYS', '30'),
('MAX_UNPAID_DAYS', '90');
