# SolarEcoHeat — Sistema de Gestão de Manutenções

> Sistema SaaS mobile-first com PWA offline-first para técnicos de campo

## Stack

- **Frontend:** Next.js 14 + Tailwind CSS + React Query + Zustand
- **Backend:** Fastify + Drizzle ORM + BullMQ + Redis
- **Banco:** Supabase (PostgreSQL 16 + Auth + RLS + Realtime)
- **Deploy:** Vercel (frontend) + AWS EC2 t2.micro (backend)
- **PDF:** Gotenberg (Docker)

## Estrutura do Monorepo

```
/
├── apps/
│   ├── web/          # Next.js 14 (PWA + portal + admin)
│   └── api/          # Fastify backend
├── packages/
│   ├── validators/   # Schemas Zod compartilhados
│   ├── types/        # Tipos TypeScript compartilhados
│   └── db/           # Drizzle schema + client
├── docker/
│   └── gotenberg/    # Config do serviço PDF
└── infra/
    ├── setup.sh      # Script de provisionamento EC2
    └── nginx/        # Configuração Nginx + SSL
```

## Setup Local

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env

# Subir Gotenberg local para PDFs
docker compose -f docker/gotenberg/docker-compose.yml up -d

# Iniciar backend
npm run dev --workspace @solarecoheat/api

# Iniciar frontend
npm run dev --workspace @solarecoheat/web
```

Sem o Gotenberg, a API faz fallback para um PDF simples em texto.

## Documentação

- **Regras do Projeto:** `.amazonq/rules/project-rules.md`
- **Banco de Memórias:** `docs/memory-bank.md`
- **Próximos Passos:** `docs/next-steps.md`
- **Guia UI/UX:** `docs/ui-ux-guide.md`
- **Auth e Acessos Supabase:** `docs/auth-supabase-acessos.md`
- **Deploy API em EC2:** `docs/deploy-api-ec2.md`

## Fase Atual

**Fase 1 — Foundation** ✅ Em andamento
- [x] Setup do ambiente
- [x] Estrutura de monorepo
- [x] Validators Zod
- [x] Types compartilhados
- [ ] Configuração do Supabase
- [ ] Backend Fastify base
- [ ] Configuração da AWS EC2

## Licença

Proprietary
