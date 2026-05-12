# OpsReport

![status](https://img.shields.io/badge/status-pronto%20para%20uso-00d68f) ![docker](https://img.shields.io/badge/docker--compose-v3.9-2496ed) ![license](https://img.shields.io/badge/license-MIT-555)

> Aplicação web moderna para **automatizar a leitura, tratamento e exportação de chamados operacionais** copiados do Microsoft Teams (formato Splunk ITSI ou similar). Estética NOC/SRE, parser inteligente expansível, dashboard de métricas, exportação XLSX/CSV.

---

## 📋 Sumário

- [Stack](#stack)
- [Subindo o projeto](#-subindo-o-projeto-em-3-passos)
- [Estrutura](#-estrutura-do-repositório)
- [Funcionalidades](#-funcionalidades)
- [Como o parser funciona](#-como-o-parser-funciona)
- [Regras inteligentes](#-regras-inteligentes-do-parser)
- [API REST](#-api-rest)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Banco de dados](#-banco-de-dados)
- [Expandindo o parser](#-expandindo-o-parser)
- [Troubleshooting](#-troubleshooting)

---

## Stack

| Camada | Tecnologia |
|---|---|
| **Frontend** | HTML5, TailwindCSS (via CSS tokens), Vanilla JS, Axios, Grid.js, Chart.js |
| **Backend** | Node.js 20, Express, Prisma ORM, JWT, Helmet, ExcelJS, Papaparse |
| **Banco** | PostgreSQL 16 |
| **Infra** | Docker Compose (3 containers: frontend / backend / postgres) |
| **Servidor web** | nginx Alpine (frontend + proxy reverso para a API) |

---

## 🚀 Subindo o projeto em 3 passos

### Pré-requisitos
- Docker e Docker Compose instalados
- Portas livres: **8080** (frontend), **3001** (backend), **5432** (postgres)

### Passos

```bash
# 1. Copiar variáveis de ambiente (opcional - tem defaults)
cp .env.example .env

# 2. Subir tudo
docker compose up -d --build

# 3. Acessar
# Frontend: http://localhost:8080
# Backend:  http://localhost:3001/api/health
```

### Credenciais padrão

```
Email:  admin@opsreport.local
Senha:  admin123
```

> Customize via variáveis `SEED_USER_EMAIL` e `SEED_USER_PASSWORD` no `.env`.

### Verificar saúde

```bash
curl http://localhost:3001/api/health
# {"ok":true,"ts":"..."}

docker compose ps
docker compose logs -f backend
```

### Parar

```bash
docker compose down              # mantém o volume do banco
docker compose down -v           # apaga tudo, inclusive os dados
```

---

## 📁 Estrutura do repositório

```
opsreport/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   │       └── 20250101000000_init/migration.sql
│   └── src/
│       ├── app.js                    # config Express
│       ├── server.js                 # entry point
│       ├── routes/                   # /auth /tickets /dashboard /imports
│       ├── controllers/
│       ├── services/                 # regra de negócio
│       ├── parsers/                  # ⭐ coração da aplicação
│       │   ├── patterns.js           #   regex centralizadas
│       │   ├── normalizers.js        #   mapas MSE→Weblogic etc.
│       │   ├── ticket.parser.js      #   orquestração
│       │   └── index.js
│       ├── middlewares/              # auth JWT, erro, upload Multer
│       ├── utils/                    # logger, jwt, prisma, errors
│       └── exports/                  # geração XLSX/CSV (em services/)
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html                    # login
│   ├── dashboard.html                # SPA principal (4 abas)
│   └── assets/
│       ├── css/styles.css            # tema escuro NOC + light
│       └── js/
│           ├── config.js
│           ├── api.js                # cliente Axios
│           ├── app.js                # bootstrap
│           ├── parser-ui.js          # aba "Processar"
│           ├── tickets-ui.js         # aba "Chamados"
│           ├── dashboard.js          # gráficos
│           ├── history.js            # aba "Histórico"
│           └── components/
│               ├── sidebar.js
│               ├── theme.js          # dark/light
│               └── toast.js
│
└── docs/
    └── exemplos-chamados.txt
```

---

## ✨ Funcionalidades

### Tela "Processar Chamados"
- Área grande para colar texto bruto vindo do Teams
- Botão **Processar Chamados** que dispara o parser
- **Upload** de arquivos `.txt`, `.csv`, `.xlsx` (até 5MB)
- Tabela **editável** (Grid.js) com todos os campos extraídos
- **Logs de parsing** com avisos por bloco
- Exportação direta de XLSX/CSV
- Botão "Salvar no banco" para persistir a importação

### Dashboard
- Cards de métricas: total de incidentes, restarts, sistemas distintos, P1/P2
- Gráfico de barras por sistema
- Doughnut por tecnologia e status
- Bar por prioridade (cores P1→P5)
- Linha de tendência últimos 30 dias

### Chamados
- Pesquisa por **ID, sistema, hostname, data**
- Listagem paginada e ordenável
- Exportação do resultado filtrado para XLSX/CSV

### Histórico de Importações
- Lista de todas as importações com data, origem, arquivo, qtd, erros
- Remoção em cascata (apaga a importação e seus chamados)

### Outros
- Login JWT simples
- **Dark mode / Light mode** (persistido em localStorage)
- Toast notifications
- Loading states em todas as ações assíncronas
- Health check em tempo real no topbar
- Layout responsivo (sidebar colapsa em mobile)

---

## 🧠 Como o parser funciona

O parser opera em **pipeline**:

```
texto bruto
   │
   ▼
┌─────────────────┐
│  splitBlocks()  │   Divide por "Alert", "#NNN:", linhas em branco
└─────────────────┘
   │
   ▼ (array de blocos)
┌─────────────────┐
│  parseBlock()   │   Para cada bloco aplica todos os extractors
└─────────────────┘
   │
   ▼ (ticket parcial)
┌─────────────────────────────────────┐
│ Pós-processamento:                  │
│  - parseDateLoose() → Date          │
│  - mapTechnology() → Weblogic etc.  │
│  - detectSolverGroup() → Prod-*     │
│  - RESTART regex → isRestart        │
└─────────────────────────────────────┘
   │
   ▼
ticket completo + logs de validação
```

**Extractors disponíveis** (em `backend/src/parsers/ticket.parser.js`):

- `extractTicketId` — busca `#NNNNN`
- `extractRawDate` — vários formatos (dd/mm, dd/mm/yyyy, iso)
- `extractInlineHeader` — padrão `PRD | MOVEL | MSE host`
- `extractHostname` — heurística com blocklist (evita falsos positivos como "P1")
- `extractPriority` — bloco `Priority\nP1` ou inline
- `extractStatus` — palavras-chave normalizadas
- `extractResponders` / `extractTags` / `extractDescription` / `extractUrls`

---

## 🎯 Regras inteligentes do parser

### Grupo solucionador
| Texto contém | Resultado |
|---|---|
| `prod integração` ou `PROD.INTEGRACAO` ou `PROD-INTEGRACAO` (case insensitive) | `Prod-Integracao` |
| Caso contrário | `Prod-Web` |

> Verifica primeiro o campo `Responders`; depois o texto completo do bloco.

### Tecnologia
| Sistema | Tecnologia |
|---|---|
| `MSE` | Weblogic |
| `BPEL` | SOA Suite |
| `OSB` | Oracle Service Bus |
| `EDOC` | Weblogic |
| `SPG` | Wildfly |
| `WPP` | Weblogic |

### Sistema operacional
- **Default**: `Linux/Unix` em todos os tickets.

### Status
| Texto contém | Status normalizado |
|---|---|
| `Normalizado` | Resolvido |
| `Sem atuação` | Resolvido |
| `Encaminhar para equipe responsável` | Direcionado |
| `Em monitoramento` | Em Monitoramento |
| `Open` / `Aberto` | Aberto |
| `Closed` / `Resolved` | Resolvido |

### Hostnames
Detecta automaticamente padrões como `BRUX1047`, `BRUX1608`, `CLMSELX7352`, `CLNETSMSLX6445`. Regex: `[A-Z]{2,}[A-Z0-9]*\d{3,}` com blocklist de termos comuns (PRD, MSE, P1 etc.) para evitar falsos positivos.

### Restart
- Regex `/(restart|reiniciado?|reboot)/i` → `isRestart: true`

---

## 🔌 API REST

Base: `http://localhost:3001/api` (proxied no frontend como `/api`).

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/auth/login` | — | `{email, password}` → `{token, user}` |
| POST | `/auth/register` | — | Cadastro |
| GET | `/auth/me` | ✓ | Usuário logado |
| POST | `/tickets/preview` | ✓ | `{text}` → parse SEM salvar |
| POST | `/tickets/preview-file` | ✓ | Multipart `file` (.txt/.csv/.xlsx) |
| POST | `/tickets` | ✓ | `{tickets, source, fileName, rawSize}` → salva |
| GET | `/tickets` | ✓ | Filtros: `q`, `system`, `hostname`, `ticketId`, `dateFrom`, `dateTo`, `page`, `pageSize` |
| GET | `/tickets/:id` | ✓ | Detalhe |
| PATCH | `/tickets/:id` | ✓ | Atualiza campos |
| DELETE | `/tickets/:id` | ✓ | Remove |
| POST | `/tickets/export?format=xlsx\|csv` | ✓ | `{tickets}` no body, ou vazio = exporta tudo (com filtros) |
| GET | `/dashboard/metrics` | ✓ | Agregações para o dashboard |
| GET | `/imports` | ✓ | Histórico de importações |
| GET | `/imports/:id/tickets` | ✓ | Tickets de uma importação |
| DELETE | `/imports/:id` | ✓ | Remove importação + chamados |

### Exemplo: parsing via cURL

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@opsreport.local","password":"admin123"}' | jq -r .token)

curl -s -X POST http://localhost:3001/api/tickets/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"30/03 - Alert\n#520992: PRD | MOVEL | MSE brux1044 - Realizado o restart. Normalizado."}' | jq
```

---

## 🔧 Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `POSTGRES_USER` | `opsreport` | Usuário do banco |
| `POSTGRES_PASSWORD` | `opsreport` | Senha |
| `POSTGRES_DB` | `opsreport` | Database |
| `POSTGRES_PORT` | `5432` | Porta exposta |
| `BACKEND_PORT` | `3001` | Porta do backend |
| `FRONTEND_PORT` | `8080` | Porta do frontend |
| `NODE_ENV` | `development` | `development` ou `production` |
| `JWT_SECRET` | `change-me…` | **Mude em produção** |
| `JWT_EXPIRES_IN` | `7d` | Expiração do JWT |
| `CORS_ORIGIN` | `http://localhost:8080` | Origens permitidas (separadas por vírgula) |
| `SEED_USER_EMAIL` | `admin@opsreport.local` | Usuário criado no seed |
| `SEED_USER_PASSWORD` | `admin123` | Senha do seed |

---

## 🗄 Banco de dados

Schema gerenciado por Prisma. Três modelos:

```
User      ─┬─< Import  ─┬─< Ticket
           │            │
        cria            agrupa
```

A primeira inicialização roda automaticamente:
1. `prisma migrate deploy` — aplica `migrations/20250101000000_init/migration.sql`
2. `prisma/seed.js` — cria usuário admin + 4 chamados de exemplo

### Acessar o Postgres direto

```bash
docker compose exec postgres psql -U opsreport -d opsreport
\dt
SELECT COUNT(*) FROM tickets;
```

### Prisma Studio (UI gráfica)

```bash
docker compose exec backend npx prisma studio
# acesse http://localhost:5555
```

---

## 🔨 Expandindo o parser

O parser foi projetado para ser **modular e expansível**. Para adicionar suporte a um novo formato:

### Formatos suportados

| Formato | Descrição |
|---|---|
| **Inline simples** | `30/03 - Alert / #520992: PRD \| MOVEL \| MSE brux1044 - Descrição` |
| **Splunk ITSI multilinha** | Blocos com `Alert / #ID / Priority / Status / Responders / Description` |
| **COTI INFORMA** | `COTI INFORMA - ALERTA CRITICO - PDST-XXXXXXX` com tabela de alarmes do Orquestrador/Cockpit |

### Campo "Analista Responsável"

Após o processamento de chamados, a coluna **Analista** aparece na tabela editável. Basta digitar o nome do analista diretamente na célula. O campo é salvo junto com o chamado e exportado no XLSX/CSV.



### Adicionar nova tecnologia
Edite `backend/src/parsers/normalizers.js`:

```js
const TECHNOLOGY_MAP = {
  MSE: 'Weblogic',
  // ...
  NOVO_SISTEMA: 'Tomcat',   // ← adicione aqui
};
```

### Adicionar novo padrão de status
Edite `backend/src/parsers/patterns.js`:

```js
const STATUS_KEYWORDS = [
  { match: /normalizado/i, value: 'Resolvido' },
  // ...
  { match: /aguardando aprova[cç][aã]o/i, value: 'Aguardando Aprovação' }, // ← novo
];
```

### Adicionar um novo extractor
1. Crie a função em `ticket.parser.js`:
```js
function extractEnvironmentRegion(text) {
  const m = text.match(/Region:\s*([A-Z]+)/);
  return m ? m[1] : null;
}
```
2. Chame em `parseBlock()`:
```js
ticket.region = extractEnvironmentRegion(block);
```
3. Adicione o campo no schema Prisma (`schema.prisma`) e crie uma migration.

### Reiniciar após mudanças

```bash
docker compose restart backend
# ou para mudanças no schema:
docker compose exec backend npx prisma migrate dev --name nova_feature
```

---

## 🩹 Troubleshooting

### "Cannot connect to postgres"
Aguarde o healthcheck do banco. O backend tem `depends_on` com `condition: service_healthy`, mas em máquinas lentas pode levar 10-15s na primeira subida.

### "Token inválido ou expirado"
Limpe `localStorage` no console do navegador:
```js
localStorage.clear(); location.reload();
```

### "Failed to fetch Prisma engine"
Acontece em ambientes offline. Garanta acesso a `https://binaries.prisma.sh` durante o build.

### Resetar tudo
```bash
docker compose down -v
docker compose up -d --build
```

### Logs em tempo real
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

---

## 📜 Licença

MIT — sinta-se à vontade para adaptar.

---

**Construído para times de NOC/SRE que estão cansados de copiar e colar chamados em planilhas manualmente.** 💚
