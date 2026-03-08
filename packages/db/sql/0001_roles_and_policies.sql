-- Ativando RLS nas tabelas primárias
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_maintenances ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_resolution_log ENABLE ROW LEVEL SECURITY;

----------------------------------------------------------------------------------------------------------------
-- 1. ISOLAMENTO SINGLE-TENANT BASEADO EM ROLE (RBAC)
----------------------------------------------------------------------------------------------------------------

-- Admin (Bypass Global): Usado por Gestores
-- Verificamos tanto o claim direto quanto dentro de app_metadata para maior compatibilidade
CREATE POLICY "Admin All Access" ON clients FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON technical_units FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON systems FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON components FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON attendances FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON system_maintenances FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON occurrences FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON quotes FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON financial_executions FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON audit_logs FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);
CREATE POLICY "Admin All Access" ON conflict_resolution_log FOR ALL USING (
  (auth.jwt() ->> 'role' = 'admin') OR 
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
);

-- Técnicos (Leitura Aberta nos Cadastros Básicos):
CREATE POLICY "Technician Read Clients" ON clients FOR SELECT USING (((auth.jwt() ->> 'role')::text = 'technician'));
CREATE POLICY "Technician Read Units" ON technical_units FOR SELECT USING (((auth.jwt() ->> 'role')::text = 'technician'));
CREATE POLICY "Technician Read Systems" ON systems FOR SELECT USING (((auth.jwt() ->> 'role')::text = 'technician'));
CREATE POLICY "Technician Read Components" ON components FOR SELECT USING (((auth.jwt() ->> 'role')::text = 'technician'));

-- Técnicos na Operação (Attendances, Ocorrências, Maintenances)
CREATE POLICY "Technician Read Attendances" ON attendances FOR SELECT USING (((auth.jwt() ->> 'role')::text = 'technician'));
CREATE POLICY "Technician Insert Attendances" ON attendances FOR INSERT WITH CHECK (((auth.jwt() ->> 'role')::text = 'technician'));
CREATE POLICY "Technician Update Attendances" ON attendances FOR UPDATE USING (((auth.jwt() ->> 'role')::text = 'technician'));

CREATE POLICY "Technician Read Occurrences" ON occurrences FOR SELECT USING (((auth.jwt() ->> 'role')::text = 'technician'));
CREATE POLICY "Technician Insert Occurrences" ON occurrences FOR INSERT WITH CHECK (((auth.jwt() ->> 'role')::text = 'technician'));
CREATE POLICY "Technician Update Occurrences" ON occurrences FOR UPDATE USING (((auth.jwt() ->> 'role')::text = 'technician'));

CREATE POLICY "Technician Read Quotes" ON quotes FOR SELECT USING (((auth.jwt() ->> 'role')::text = 'technician'));
CREATE POLICY "Technician Insert Quotes" ON quotes FOR INSERT WITH CHECK (((auth.jwt() ->> 'role')::text = 'technician'));

----------------------------------------------------------------------------------------------------------------
-- 2. INTERVENÇÕES DE MANUTENÇÃO E LOCKS (system_maintenances)
----------------------------------------------------------------------------------------------------------------

CREATE POLICY "Technician Read Maintenances" ON system_maintenances FOR SELECT USING (((auth.jwt() ->> 'role')::text = 'technician'));

CREATE POLICY "Technician Insert Maintenances" ON system_maintenances
  FOR INSERT
  WITH CHECK (((auth.jwt() ->> 'role')::text = 'technician'));

CREATE POLICY "Technician Update Maintenances IF NOT LOCKED" ON system_maintenances
  FOR UPDATE
  USING (
    ((auth.jwt() ->> 'role')::text = 'technician')
    AND locked = false
  );

----------------------------------------------------------------------------------------------------------------
-- 3. IMUTABILIDADE ESTREITA (AUDIT_LOGS)
----------------------------------------------------------------------------------------------------------------

-- Técnicos só fazem INSERTS de logs de auditoria
CREATE POLICY "Audit Logs APPEND-ONLY by Techs" ON audit_logs
  FOR INSERT
  WITH CHECK (((auth.jwt() ->> 'role')::text = 'technician'));
