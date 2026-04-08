// testQR.js
const qrcode = require('qrcode-terminal');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

async function startTestQR() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    printQRInTerminal: true
  });

  sock.ev.on('connection.update', (update) => {
    if (update.qr) {
      console.log('📲 QR generado:');
      qrcode.generate(update.qr, { small: true });
    }
    if (update.connection) {
      console.log('🔗 Conexión:', update.connection);
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

startTestQR().catch(err => console.error(err));
