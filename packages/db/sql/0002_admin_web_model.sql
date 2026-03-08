-- Clientes: novos campos de cadastro detalhado
ALTER TABLE clients ADD COLUMN IF NOT EXISTS trade_name varchar(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsible_name varchar(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsible_role varchar(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS zip_code varchar(12);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS street varchar(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS number varchar(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS complement varchar(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS district varchar(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city varchar(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state varchar(2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS country varchar(60) DEFAULT 'Brasil';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS observations text;

-- Orçamentos: campos completos
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS technician_id uuid;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS issue_date timestamp;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS valid_until timestamp;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_total numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS grand_total numeric(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS materials_included boolean DEFAULT false NOT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes text;

-- Itens do orçamento
CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) DEFAULT 1 NOT NULL,
  unit_value numeric(12,2) NOT NULL,
  discount numeric(12,2) DEFAULT 0 NOT NULL,
  line_total numeric(12,2) NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
