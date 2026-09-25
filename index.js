import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import dotenv from 'dotenv';
import * as tuya from './tuya.js';

dotenv.config();

const PREFIX = process.env.PREFIX || '!';
const ALLOWED = (process.env.ALLOWED_NUMBERS || '')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);

const logger = pino({ level: 'silent' });

// ============================================================
// Mapeamento de nomes amigáveis → deviceId
// Edite aqui com os seus dispositivos Tuya
// ============================================================
const DEVICES = {
  // Exemplos (substitua pelos seus IDs reais):
  // 'luz sala': 'bfxxxxxxxxxxxxxxxxxx',
  // 'tomada quarto': 'bfyyyyyyyyyyyyyyyyyy',
  // 'ar condicionado': 'bfzzzzzzzzzzzzzzzzzz',
};

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['TuyaBot', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escaneie o QR Code abaixo com o WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
          : true;

      console.log('Conexão fechada. Reconectando?', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot conectado ao WhatsApp!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const number = from.replace('@s.whatsapp.net', '').replace('@g.us', '');

      // Segurança: só responde números autorizados
      if (ALLOWED.length && !ALLOWED.includes(number)) {
        continue;
      }

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      if (!text.startsWith(PREFIX)) continue;

      const args = text.slice(PREFIX.length).trim().split(/\s+/);
      const command = args.shift()?.toLowerCase();

      try {
        let reply = '';

        switch (command) {
          case 'ping':
            reply = '🏓 Pong! Bot Tuya online.';
            break;

          case 'ajuda':
          case 'help':
            reply =
              `*🤖 Bot Tuya - Comandos*\n\n` +
              `*${PREFIX}dispositivos* – lista dispositivos mapeados\n` +
              `*${PREFIX}status <id|nome>* – status de um dispositivo\n` +
              `*${PREFIX}ligar <id|nome>* – liga dispositivo\n` +
              `*${PREFIX}desligar <id|nome>* – desliga dispositivo\n` +
              `*${PREFIX}toggle <id|nome>* – alterna estado\n` +
              `*${PREFIX}ping* – testa se o bot está vivo\n\n` +
              `_Dica: você pode usar o nome amigável ou o device ID_`;
            break;

          case 'dispositivos':
          case 'devices':
            reply = '*Seus dispositivos Tuya:*\n\n';
            const entries = Object.entries(DEVICES);
            if (entries.length === 0) {
              reply +=
                '_Nenhum dispositivo mapeado ainda._\n\n' +
                'Edite o objeto `DEVICES` no arquivo `index.js`:\n' +
                '```js\n' +
                "const DEVICES = {\n  'luz sala': 'bfxxxxxxxxxx',\n};\n```";
            } else {
              for (const [name, id] of entries) {
                reply += `• *${name}* → \`${id}\`\n`;
              }
            }
            break;

          case 'status': {
            if (!args[0]) {
              reply = `Uso: ${PREFIX}status <device_id ou nome>`;
              break;
            }
            const deviceId = resolveDevice(args.join(' '));
            if (!deviceId) {
              reply = `❌ Dispositivo não encontrado: ${args.join(' ')}`;
              break;
            }
            const status = await tuya.getDeviceStatus(deviceId);
            reply =
              `*Status de \`${deviceId}\`:*\n\`\`\`\n` +
              JSON.stringify(status, null, 2) +
              '\n```';
            break;
          }

          case 'ligar':
          case 'on': {
            if (!args[0]) {
              reply = `Uso: ${PREFIX}ligar <device_id ou nome>`;
              break;
            }
            const deviceId = resolveDevice(args.join(' '));
            if (!deviceId) {
              reply = `❌ Dispositivo não encontrado: ${args.join(' ')}`;
              break;
            }
            await tuya.turnOn(deviceId);
            reply = `✅ Dispositivo \`${deviceId}\` ligado!`;
            break;
          }

          case 'desligar':
          case 'off': {
            if (!args[0]) {
              reply = `Uso: ${PREFIX}desligar <device_id ou nome>`;
              break;
            }
            const deviceId = resolveDevice(args.join(' '));
            if (!deviceId) {
              reply = `❌ Dispositivo não encontrado: ${args.join(' ')}`;
              break;
            }
            await tuya.turnOff(deviceId);
            reply = `🛑 Dispositivo \`${deviceId}\` desligado!`;
            break;
          }

          case 'toggle': {
            if (!args[0]) {
              reply = `Uso: ${PREFIX}toggle <device_id ou nome>`;
              break;
            }
            const deviceId = resolveDevice(args.join(' '));
            if (!deviceId) {
              reply = `❌ Dispositivo não encontrado: ${args.join(' ')}`;
              break;
            }
            await tuya.toggle(deviceId);
            reply = `🔄 Estado do dispositivo \`${deviceId}\` alternado!`;
            break;
          }

          default:
            reply = `Comando desconhecido. Digite *${PREFIX}ajuda*`;
        }

        if (reply) {
          await sock.sendMessage(from, { text: reply });
        }
      } catch (err) {
        console.error(err);
        await sock.sendMessage(from, {
          text: `❌ Erro: ${err.message || 'Falha ao executar comando'}`
        });
      }
    }
  });
}

/**
 * Resolve nome amigável ou device ID
 */
function resolveDevice(input) {
  const key = input.toLowerCase().trim();
  // Procura por nome amigável
  if (DEVICES[key]) return DEVICES[key];
  // Procura parcial
  for (const [name, id] of Object.entries(DEVICES)) {
    if (name.includes(key) || key.includes(name)) return id;
  }
  // Assume que é um device ID direto
  if (input.length > 10) return input;
  return null;
}

startBot().catch(console.error);
