export type UserRole = 'TÉCNICO' | 'ADMIN' | 'CLIENTE'
export type SystemType =
  | 'solar'
  | 'gas'
  | 'eletrico'
  | 'piscina'
  | 'sauna'
  | 'misto_tipo_1'
  | 'misto_tipo_2'
  | 'misto_tipo_3'
  // compatibilidade com dados legados
  | 'AQUECIMENTO SOLAR'
  | 'BOMBAS HIDRÁULICAS'
  | 'CALDEIRAS A GÁS'
  | 'SISTEMA DE INCÊNDIO'
export type ComponentState = 'OK' | 'ATENÇÃO' | 'CRÍTICO'
export type AttendanceStatus = 'AGENDADO' | 'EM_ANDAMENTO' | 'FINALIZADO' | 'CANCELADO'
export type OccurrenceSeverity = 'OK' | 'ATENÇÃO' | 'CRÍTICO'
export type QuoteStatus = 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'RECUSADO'

export interface Client {
  id: string
  name: string
  document: string
  contacts: Contact[]
  status: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface User {
  id: string
  client_id: string
  email: string
  name: string
  role: UserRole
  status: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface TechnicalUnit {
  id: string
  client_id: string
  name: string
  address: Address
  maintenance_days: number[]
  notes?: string
  status: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface System {
  id: string
  client_id: string
  unit_id: string
  name: string
  type: SystemType
  heat_sources: string[]
  priority: number
  volume?: number
  state_derived: ComponentState
  status: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface Component {
  id: string
  client_id: string
  system_id: string
  type: string
  capacity?: number
  quantity: number
  function?: string
  state: ComponentState
  status: string
  created_at: string
  updated_at: string
  deleted_at?: string
}

export interface Attendance {
  id: string
  client_id: string
  unit_id: string
  technician_id: string
  started_at?: string
  finished_at?: string
  type: string
  status: AttendanceStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface SystemMaintenance {
  id: string
  client_id: string
  attendance_id: string
  system_id: string
  checklist: Record<string, any>
  final_state?: ComponentState
  notes?: string
  locked: boolean
  locked_at?: string
  locked_by?: string
  created_at: string
  updated_at: string
}

export interface Occurrence {
  id: string
  client_id: string
  system_id: string
  attendance_id?: string
  description: string
  severity: OccurrenceSeverity
  status: string
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  client_id: string
  occurrence_id?: string
  description: string
  value: number
  status: QuoteStatus
  locked_at?: string
  approved_by?: string
  created_at: string
  updated_at: string
}

export interface FinancialExecution {
  id: string
  client_id: string
  quote_id: string
  executed_at: string
  real_cost: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface Address {
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  zip_code: string
}

export interface Contact {
  name: string
  phone: string
  email?: string
  role?: string
}
