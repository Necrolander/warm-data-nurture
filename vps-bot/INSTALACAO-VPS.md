# 📦 Parte 3 — Tutorial: Instalar o Bot iFood na VPS Ubuntu (do zero)

> Este guia assume **Ubuntu 22.04 LTS** ou mais novo, com acesso `root` ou `sudo`.  
> Tempo total: ~15 minutos.

---

## 🎯 Visão geral do que vamos fazer

1. Conectar na VPS via SSH
2. Instalar Docker + Docker Compose
3. Copiar a pasta `vps-bot/` pra VPS
4. Configurar o arquivo `.env` (cola o `BOT_TOKEN`)
5. Subir o container com `docker compose up -d`
6. Acompanhar os logs e fazer o **primeiro login + 2FA** via painel `/admin/ifood-bot`
7. Verificar que pedidos aparecem no painel

---

## 1️⃣ Conectar na VPS

No seu PC (Windows PowerShell, Mac Terminal ou Linux):

```bash
ssh root@SEU_IP_VPS
# ou, se for outro usuário:
ssh ubuntu@SEU_IP_VPS
```

Se for primeira vez, aceita a fingerprint digitando `yes`.

---

## 2️⃣ Instalar Docker + Docker Compose

Cola **tudo isso de uma vez** no terminal da VPS:

```bash
# Atualiza pacotes
sudo apt update && sudo apt upgrade -y

# Pré-requisitos
sudo apt install -y ca-certificates curl gnupg git

# Repositório oficial Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instala Docker Engine + Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verifica
sudo docker --version
sudo docker compose version
```

**Saída esperada:**
```
Docker version 27.x.x, build xxxx
Docker Compose version v2.x.x
```

(Opcional) Pra rodar `docker` sem `sudo`:
```bash
sudo usermod -aG docker $USER
# saia e entre de novo no SSH
```

---

## 3️⃣ Copiar a pasta `vps-bot/` pra VPS

Você tem **2 opções**:

### Opção A — via Git (recomendado se seu projeto Lovable está no GitHub)

```bash
cd /opt
sudo git clone https://github.com/SEU_USUARIO/SEU_REPO.git truebox
cd truebox/vps-bot
```

### Opção B — via SCP (sem git, copia do seu PC pra VPS)

**No seu PC** (não na VPS), na pasta do projeto:

```bash
# Linux/Mac
scp -r vps-bot/ root@SEU_IP_VPS:/opt/truebox-bot/

# Windows PowerShell (com OpenSSH habilitado)
scp -r .\vps-bot\ root@SEU_IP_VPS:/opt/truebox-bot/
```

Depois, **na VPS**:
```bash
cd /opt/truebox-bot
```

---

## 4️⃣ Configurar o `.env`

Ainda na pasta `vps-bot` da VPS:

```bash
cp .env.example .env
nano .env
```

Vai abrir um editor. Edite **APENAS a linha** `BOT_TOKEN`:

```env
BOT_TOKEN=cole_aqui_o_mesmo_token_que_voce_salvou_em_IFOOD_BOT_TOKEN_no_lovable
```

> ⚠️ **MUITO IMPORTANTE:** este valor tem que ser **idêntico** ao que você salvou em `IFOOD_BOT_TOKEN` no Lovable Cloud. Se não bater, o bot leva 401 Unauthorized.

Salvar e sair: `Ctrl+O` → `Enter` → `Ctrl+X`.

Confere se ficou certo:
```bash
cat .env | grep BOT_TOKEN
```

---

## 5️⃣ Subir o container

```bash
docker compose up -d --build
```

Primeira vez demora ~3-5 minutos baixando a imagem do Playwright (~1.5GB).

Quando terminar:
```bash
docker compose ps
```

Deve aparecer `truebox-ifood-bot` com status `Up`.

---

## 6️⃣ Acompanhar logs (primeiro login + 2FA)

```bash
docker compose logs -f
```

Você vai ver algo assim:
```
🚀 Truebox iFood Bot iniciando
🌐 Indo para https://portal.ifood.com.br
🔐 Tela de login detectada — buscando credenciais
⏳ Aguardando resposta do login...
📱 2FA detectado — solicitando código ao admin
```

### 🔑 Agora vai no painel!

1. Abra `https://SEU_DOMINIO/admin/ifood-bot` no navegador
2. Vai aparecer um **banner vermelho pulsante**: "Bot iFood pediu código 2FA"
3. Verifica seu **celular** (SMS do iFood com código de 6 dígitos)
4. Cola o código no campo e clica **"Enviar"**
5. Volte ao terminal SSH — vai aparecer:
   ```
   ⌨️  Digitando código 2FA
   ✅ Login concluído
   📦 0/0 pedido(s) enviados
   ```

🎉 **Pronto!** A sessão fica salva em `/opt/truebox-bot/vps-bot/browser-data` — você só vai precisar refazer 2FA quando o iFood pedir de novo (geralmente 7-30 dias).

Sai dos logs com `Ctrl+C` (não para o container, só fecha o tail).

---

## 7️⃣ Verificar funcionamento

No painel `/admin/ifood-bot` deve mostrar:

- 🟢 **Bot Online** (último ping < 90s)
- Contador de pedidos capturados crescendo conforme chegam pedidos no iFood
- Screenshots da tela do bot na seção "Tela do bot"

E os pedidos novos aparecem em `/admin` (Meus Pedidos), origem `ifood`.

---

## 🛠️ Comandos úteis do dia-a-dia

```bash
cd /opt/truebox-bot/vps-bot   # ou /opt/truebox/vps-bot

docker compose logs -f              # ver logs ao vivo
docker compose logs --tail=100      # últimas 100 linhas
docker compose restart              # reiniciar bot
docker compose down                 # parar
docker compose up -d                # subir de novo
docker compose pull && docker compose up -d --build   # atualizar
```

Pra **resetar a sessão do navegador** (forçar re-login + novo 2FA):
```bash
docker compose down
sudo rm -rf browser-data
docker compose up -d
```

---

## 🐛 Problemas comuns

### ❌ "401 unauthorized" nos logs
→ `BOT_TOKEN` no `.env` da VPS não bate com `IFOOD_BOT_TOKEN` no Lovable. Confere os dois e reinicia.

### ❌ Bot mostra "offline" no painel mas tá rodando
→ Verifica se a VPS tem internet: `curl https://yxmirlnvrrintrvicqic.supabase.co`. Se falhar, problema de DNS/firewall na VPS.

### ❌ "Tela de login detectada" infinitamente
→ As credenciais `IFOOD_PORTAL_EMAIL` ou `IFOOD_PORTAL_PASSWORD` no Lovable estão erradas. Vai em **Lovable Cloud → Secrets → Update** e corrige.

### ❌ Pedidos não aparecem mesmo com bot online
→ O iFood mudou o HTML do portal. Vai no painel `/admin/ifood-bot`, abre os screenshots, e me manda um print → eu ajusto os seletores em `src/ifood-orders.js`.

### ❌ Container morre toda hora (Out of memory)
→ Sua VPS tem menos de 1GB de RAM livre. Sobe pra plano com 2GB+ ou diminui o limite no `docker-compose.yml` (mas não recomendo abaixo de 768M).

---

## 🔒 Segurança

- ✅ Credenciais do iFood **nunca ficam na VPS** — são puxadas via API toda inicialização
- ✅ Comunicação bot↔Lovable é HTTPS + Bearer token
- ✅ A VPS só precisa de **saída HTTPS** (não precisa abrir portas)
- ✅ Pra trocar a senha do iFood, basta atualizar no Lovable Cloud → Secrets

---

## 📞 Se travar
1. `docker compose logs --tail=200` → me cola aqui
2. Print do painel `/admin/ifood-bot` (status + último screenshot do bot)
3. A gente ajusta de lá
