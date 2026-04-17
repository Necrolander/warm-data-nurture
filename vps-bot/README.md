# Truebox iFood Bot (Playwright + Docker)

Bot que abre o **Portal iFood** num navegador headless, faz login, lida com 2FA via SMS (você cola o código no painel `/admin/ifood-bot` da Lovable), captura pedidos e envia ao seu backend Lovable Cloud.

## Estrutura
```
vps-bot/
├── Dockerfile
├── docker-compose.yml
├── .env.example       ← copia pra .env e preenche
├── package.json
└── src/
    ├── index.js       ← loop principal
    ├── api.js         ← cliente HTTP do Lovable
    ├── ifood-login.js ← login + 2FA
    └── ifood-orders.js← extrai pedidos da tela
```

## Variáveis de ambiente (`.env`)
| Variável | O que é |
|---|---|
| `LOVABLE_FN_URL` | URL da edge function `ifood-bot-control` (já vem no exemplo) |
| `LOVABLE_INGEST_URL` | URL da edge `external-orders-ingest` |
| `BOT_TOKEN` | **Mesmo** valor que está em `IFOOD_BOT_TOKEN` no Lovable |
| `POLL_INTERVAL_MS` | Intervalo entre checagens (padrão 20s) |
| `HEADLESS` | `true` em produção, `false` se quiser ver o navegador |

## Subir na VPS
Veja o tutorial completo na **Parte 3** que a Lovable vai te mandar logo após.
Resumo:
```bash
git clone <seu-repo> truebox-bot
cd truebox-bot/vps-bot
cp .env.example .env
nano .env          # cola o BOT_TOKEN
docker compose up -d --build
docker compose logs -f
```

## Como funciona

```
┌──────────────┐  polls  ┌──────────────┐
│ Portal iFood │ ◀────── │  Bot (VPS)   │
└──────────────┘         └──────┬───────┘
                                │ HTTPS + Bearer
                                ▼
                        ┌──────────────────┐
                        │  Lovable Cloud   │
                        │  - get_creds     │
                        │  - request_2fa   │
                        │  - ingest_order  │
                        │  - heartbeat     │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Painel admin     │
                        │ /admin/ifood-bot │
                        └──────────────────┘
```

## Ajuste fino dos seletores
O arquivo `src/ifood-orders.js` tem **seletores genéricos** pra extrair os pedidos. Após colocar pra rodar, abra `/admin/ifood-bot` e veja os screenshots — provavelmente vai precisar mudar os seletores em `extractOrderCards()` pra bater com o HTML real do portal iFood.
