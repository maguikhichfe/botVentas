// ===============================
// 🟢 Test QR WhatsApp
// ===============================
console.log('🚀 Ejecutando testQR.js');
const qrcode = require('qrcode-terminal');
const makeWASocket = require('@whiskeysockets/baileys').default;

// Forzamos NO usar credenciales guardadas para que genere QR siempre
async function startTestQR() {
  const sock = makeWASocket({
    printQRInTerminal: true,
    browser: ['Test', 'Chrome', '1.0']
  });

  sock.ev.on('connection.update', (update) => {
    console.log('🟢 Evento connection.update:', update);

    const { qr, connection } = update;

    if (qr) {
      console.log('🔹 Generando QR...');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Conectado a WhatsApp!');
    }
  });
}

startTestQR();
