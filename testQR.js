// ===============================
// Test QR WhatsApp con Baileys
// ===============================
console.log('🟢 testQR.js cargado correctamente');

const makeWASocket = require('@whiskeysockets/baileys').default;
const { useSingleFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { toFile } = require('qrcode');

// Archivo de sesión
const { state, saveCreds } = useSingleFileAuthState('auth_test.json');

async function start() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false // vamos a manejar QR manual
  });

  sock.ev.on('connection.update', async (update) => {
    if (update.qr) {
      // 🔹 Mostrar QR en terminal
      console.log('🔹 Escaneá este QR con WhatsApp:');
      qrcode.generate(update.qr, { small: true });

      // 🔹 Guardar QR en PNG
      try {
        await toFile('qr.png', update.qr);
        console.log('📌 QR guardado en qr.png, abrilo con tu computadora o celular');
      } catch (err) {
        console.error('❌ Error guardando QR en PNG:', err);
      }
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
