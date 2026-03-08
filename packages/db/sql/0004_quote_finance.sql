CREATE TABLE IF NOT EXISTS quote_payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE UNIQUE,
  payment_method varchar(30) NOT NULL,
  installments integer DEFAULT 1 NOT NULL,
  entry_amount numeric(12,2) DEFAULT 0 NOT NULL,
  first_due_date timestamp DEFAULT now() NOT NULL,
  interval_days integer DEFAULT 30 NOT NULL,
  notes text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  payment_term_id uuid NOT NULL REFERENCES quote_payment_terms(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date timestamp NOT NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
