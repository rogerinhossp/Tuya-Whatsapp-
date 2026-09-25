# 🤖 WhatsApp Tuya Bot

Bot de WhatsApp com integração à plataforma **Tuya / Smart Life** para controlar dispositivos inteligentes (luzes, tomadas, ar-condicionado etc.).

## ✨ Funcionalidades

- Conexão multi-device via Baileys
- Controle de dispositivos Tuya pela Cloud API
- Comandos em português
- Lista de números autorizados (segurança)
- Nomes amigáveis para dispositivos (`!ligar luz sala`)

## ⚠️ Aviso importante

Este bot usa a biblioteca **Baileys** (não oficial). Existe risco de banimento do número WhatsApp.  
**Use um número secundário.** Para uso profissional, prefira a WhatsApp Cloud API oficial da Meta.

## 📋 Pré-requisitos

- Node.js 18+ (recomendado 20+)
- Conta no [Tuya IoT Platform](https://iot.tuya.com)
- App Tuya Smart ou Smart Life com dispositivos já cadastrados

## 🚀 Instalação

```bash
# 1. Clone ou extraia o projeto
cd whatsapp-tuya-bot

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

### Configurando o Tuya

1. Acesse https://iot.tuya.com e faça login
2. Vá em **Cloud → Project Management → Create Cloud Project**
   - Development Method: **Smart Home**
3. Anote o **Access ID / Client ID** e **Access Secret / Client Secret**
4. Em **Devices → Link App Account**, escaneie o QR Code com o app Tuya/Smart Life
5. Copie o **Device ID** de qualquer dispositivo (opcional, mas útil)

Preencha o `.env`:

```env
TUYA_ACCESS_ID=seu_client_id
TUYA_ACCESS_SECRET=seu_client_secret
TUYA_REGION=us          # us | eu | cn | in | etc.
TUYA_DEVICE_ID=        # opcional
ALLOWED_NUMBERS=5511999999999
PREFIX=!
```

### Mapeando dispositivos

Edite o arquivo `index.js` e preencha o objeto `DEVICES`:

```js
const DEVICES = {
  'luz sala': 'bfxxxxxxxxxxxxxxxxxx',
  'tomada quarto': 'bfyyyyyyyyyyyyyyyyyy',
  'ar condicionado': 'bfzzzzzzzzzzzzzzzzzz',
};
```

## ▶️ Executando

```bash
npm start
```

Escaneie o QR Code que aparecer no terminal com o WhatsApp do número que será o bot.

## 📱 Comandos

| Comando | Descrição |
|---------|-----------|
| `!ajuda` | Mostra a lista de comandos |
| `!ping` | Testa se o bot está online |
| `!dispositivos` | Lista dispositivos mapeados |
| `!status <id\|nome>` | Mostra status do dispositivo |
| `!ligar <id\|nome>` | Liga o dispositivo |
| `!desligar <id\|nome>` | Desliga o dispositivo |
| `!toggle <id\|nome>` | Alterna o estado |

### Exemplos

```
!ligar luz sala
!desligar bfxxxxxxxxxxxxxxxxxx
!status tomada quarto
!toggle ar condicionado
```

## 📁 Estrutura

```
whatsapp-tuya-bot/
├── package.json
├── .env.example
├── index.js          # Bot principal (WhatsApp + comandos)
├── tuya.js           # Cliente da API Cloud Tuya
├── auth/             # Credenciais WhatsApp (gerado automaticamente)
└── README.md
```

## 🔧 Personalização

- **Códigos de comando Tuya**: a maioria das tomadas/luzes usa `switch_1`. Lâmpadas RGB usam códigos diferentes (`switch_led`, `bright_value`, etc.). Ajuste em `tuya.js` se necessário.
- **Mais comandos**: adicione novos `case` no `switch` do `index.js`.

## 📄 Licença

MIT
