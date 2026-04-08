// index.js
import makeWASocket, { useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

async function startWhatsApp() {
    // Obtener la última versión de WhatsApp Web
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Usando WhatsApp Web v${version.join('.')}, ¿es la última?: ${isLatest}`);

    const conn = makeWASocket({
        version,
        printQRInTerminal: false, // deprecated, no se usa
        auth: state,
        browser: ['BotVentas', 'NodeJS', '1.0']
    });

    // Guardar cambios de autenticación
    conn.ev.on('creds.update', saveState);

    // Manejo de conexión
    conn.ev.on('connection.update', update => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📷 Escanea este QR con tu WhatsApp:');
            console.log(qr); // puedes usar una librería para mostrarlo como imagen en consola
        }

        if (connection === 'open') {
            console.log('✅ Conectado a WhatsApp!');
        }

        if (connection === 'close') {
            const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
            console.log('❌ Conexión cerrada, código:', reason);
            // Reintento automático
            if (reason !== DisconnectReason.loggedOut) {
                startWhatsApp();
            }
        }
    });

    // Ejemplo de recibir mensajes
    conn.ev.on('messages.upsert', m => {
        console.log('📩 Mensaje recibido:', m);
    });
}

startWhatsApp();
