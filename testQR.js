const makeWASocket = require('@whiskeysockets/baileys').default;
const { useSingleFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

const { state, saveCreds } = useSingleFileAuthState('auth_test.json');

async function start() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('connection.update', (update) => {
    if (update.qr) {
      console.log('🔹 Escaneá este QR con WhatsApp:');
      qrcode.generate(update.qr, { small: true });
    }
    if (update.connection === 'open') {
      console.log('✅ Conectado a WhatsApp!');
    }
    if (update.connection === 'close') {
      console.log('❌ Conexión cerrada:', update.lastDisconnect?.error || '');
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

start();
