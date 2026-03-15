# Plano de Acao para Producao (Mar/2026)

Este plano consolida o hardening tecnico para producao com foco em:
- estabilidade na EC2 `t2.micro`,
- uso pontual de Gotenberg,
- RLS para visibilidade de dados de clientes,
- evolucao do PWA offline-first sem regressao operacional.

## Contexto Confirmado

- API Fastify em EC2 Ubuntu + Nginx + PM2.
- Redis externo (`redis.io`), via `REDIS_URL` / `BULLMQ_REDIS_URL`.
- Gotenberg local em container na EC2 (`127.0.0.1:3001`).
- Banco no Supabase (pooler), acesso da API via Drizzle.
- Multi-tenant completo nao e requisito imediato de negocio.
- RLS para cliente final permanece requisito de seguranca de leitura.

## Execucao ja iniciada

1. [x] Gotenberg mudou para modo sob demanda:
- Endpoint `GET /api/admin/quotes/:id/pdf` agora usa Gotenberg apenas quando solicitado.
- Padrao atual: fallback para `makeSimplePdf` (baixo custo de CPU/memoria).
- Novas opcoes:
  - `GOTENBERG_MODE=on_demand|always|disabled` (default: `on_demand`).
  - Query para forcar render: `?renderEngine=gotenberg` ou `?useGotenberg=1`.
  - Header de diagnostico: `X-PDF-Engine` (`gotenberg` ou `simple`).
  - Protecao de capacidade: `GOTENBERG_MAX_CONCURRENT` (default `1`) para evitar sobrecarga em `t2.micro`.

2. [x] Primeira camada de RLS para clientes:
- Migration criada: `infra/sql/0011_client_visibility_rls.sql`.
- Regras de cliente: `SELECT` apenas para dados vinculados ao `client_id` do JWT.
- Regras de admin: `ALL` nas tabelas cobertas na migration.

3. [x] Hardening inicial de endpoints para contexto de cliente:
- `/api/app` agora bloqueia com `403` quando `role=client` sem `client_id` valido.
- `/api/reports` tambem bloqueia cliente sem `client_id` e impede cliente de acessar job/download de tipo diferente de `client`.

4. [x] Diagnostico e correcao de fallback silencioso no PDF completo:
- Quando `renderEngine=gotenberg` e o servico falha/esta ocupado, a API agora responde erro explicito (`502/503`) em vez de retornar PDF simples sem aviso.
- Frontend passou a exibir mensagem de erro retornada pela API ao gerar PDF.

## Backlog Priorizado

### P0 (bloqueia estabilidade/seguranca)

1. Aplicar migration `0011` no Supabase e validar com usuarios reais:
- cliente com `client_id` valido.
- cliente sem `client_id`.
- admin.
Status: [x] Concluido (smoke test validado no Supabase).

2. Ajustar endpoint de download no frontend:
- PDF rapido (simples) por padrao.
- botao secundario "Gerar PDF completo (Gotenberg)" usando query `renderEngine=gotenberg`.
Status: [x] Concluido.

3. Definir politica operacional de Gotenberg:
- `GOTENBERG_MODE=on_demand` em producao.
- uso completo apenas em tarefas pontuais (documentos finais, envio formal).
Status: [x] Concluido.

### P1 (reduz risco de incidente em t2.micro)

1. Criar limites de concorrencia para rotas pesadas:
- PDF, relatorios, consultas grandes.

2. Adicionar observabilidade minima:
- monitorar CPU/RAM/disco/swap,
- contador de requests PDF por engine,
- alertas basicos de indisponibilidade.

3. Revisar retries/fila:
- Redis externo ja reduz carga local.
- limitar throughput de jobs criticos em horarios de pico.

### P2 (evolucao de produto sem pressao de infraestrutura)

1. PWA offline-first robusto:
- mover sync para Workbox Background Sync quando viavel.
- melhorar UX de conflito e fila pendente.

2. Politica de soft-delete:
- padronizar `status/is_active` onde faltar.
- eliminar delete fisico nas entidades criticas.

## Checklist de Validacao

1. PDF simples:
- `GET /api/admin/quotes/:id/pdf` retorna 200 com `X-PDF-Engine: simple`.

2. PDF via Gotenberg (pontual):
- `GET /api/admin/quotes/:id/pdf?renderEngine=gotenberg` retorna 200 com `X-PDF-Engine: gotenberg`.

3. RLS cliente:
- cliente A nao enxerga dados do cliente B.
- cliente sem `client_id` nao enxerga dados protegidos.

4. RLS admin:
- admin continua com acesso operacional.
