-- ============================================
-- SAQR Source Database Mock Schema
-- Simulates a SAMA-regulated bank's core tables
-- ============================================

-- Consumer disclosures table (SAMA compliance target)
CREATE TABLE consumer_disclosures (
    id              SERIAL PRIMARY KEY,
    product_id      VARCHAR(50) NOT NULL,
    product_name    VARCHAR(200) NOT NULL,
    disclosure_text TEXT NOT NULL,
    font_size_pt    INTEGER NOT NULL DEFAULT 12,
    language        VARCHAR(5) NOT NULL DEFAULT 'ar',
    channel         VARCHAR(50) NOT NULL DEFAULT 'branch',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fee schedule table (SAMA fee cap compliance)
CREATE TABLE fee_schedule (
    id              SERIAL PRIMARY KEY,
    product_id      VARCHAR(50) NOT NULL,
    fee_type        VARCHAR(100) NOT NULL,
    fee_amount_sar  DECIMAL(10,2) NOT NULL,
    effective_date  DATE NOT NULL,
    expiry_date     DATE,
    approved_by     VARCHAR(200),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cooling-off period records
CREATE TABLE cooling_off_periods (
    id              SERIAL PRIMARY KEY,
    contract_id     VARCHAR(50) NOT NULL,
    customer_id     VARCHAR(50) NOT NULL,
    product_type    VARCHAR(100) NOT NULL,
    start_date      TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date        TIMESTAMP WITH TIME ZONE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    cancellation_requested BOOLEAN DEFAULT false,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branch compliance status (MOMAH municipal target)
CREATE TABLE branch_compliance (
    id              SERIAL PRIMARY KEY,
    branch_code     VARCHAR(20) NOT NULL,
    branch_name     VARCHAR(200) NOT NULL,
    municipality    VARCHAR(100) NOT NULL,
    signage_status  VARCHAR(50) DEFAULT 'unchecked',
    lighting_status VARCHAR(50) DEFAULT 'unchecked',
    partition_status VARCHAR(50) DEFAULT 'unchecked',
    last_audit_date DATE,
    license_expiry  DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert seed data for testing
INSERT INTO consumer_disclosures (product_id, product_name, disclosure_text, font_size_pt, language, channel)
VALUES
    ('PL-001', 'Personal Loan', 'معدل الفائدة السنوي: 7.5% - الرسوم الإدارية: 1%', 12, 'ar', 'branch'),
    ('CC-001', 'Credit Card Platinum', 'رسوم سنوية: 500 ريال - حد السحب النقدي: 30%', 11, 'ar', 'digital'),
    ('ML-001', 'Mortgage - Fixed Rate', 'Rate: 4.2% fixed for 5 years. Early settlement fee: 3 months interest.', 10, 'en', 'branch');

INSERT INTO fee_schedule (product_id, fee_type, fee_amount_sar, effective_date)
VALUES
    ('PL-001', 'admin_fee', 1500.00, '2026-01-01'),
    ('PL-001', 'late_payment', 300.00, '2026-01-01'),
    ('CC-001', 'annual_fee', 500.00, '2026-01-01'),
    ('CC-001', 'cash_advance', 75.00, '2026-01-01');

INSERT INTO branch_compliance (branch_code, branch_name, municipality, signage_status, lighting_status, license_expiry)
VALUES
    ('RUH-001', 'Riyadh Main Branch', 'Riyadh', 'compliant', 'non_compliant', '2026-06-30'),
    ('JED-001', 'Jeddah Corniche', 'Jeddah', 'non_compliant', 'compliant', '2026-03-15'),
    ('DMM-001', 'Dammam Business District', 'Dammam', 'compliant', 'compliant', '2027-01-01');

-- Grant Debezium replication permission
ALTER TABLE consumer_disclosures REPLICA IDENTITY FULL;
ALTER TABLE fee_schedule REPLICA IDENTITY FULL;
ALTER TABLE cooling_off_periods REPLICA IDENTITY FULL;
ALTER TABLE branch_compliance REPLICA IDENTITY FULL;
