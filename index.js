// ===============================
// 📦 WhatsApp Bot de Ventas
// ===============================

require('dotenv').config();

const mongoose = require('mongoose');

// 🔌 Conexión Mongo (solo para futuro / órdenes si querés)
mongoose.connect(process.env.MONGO_URI || '', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Mongo conectado'))
.catch(() => console.log('⚠️ Mongo no configurado (no pasa nada)'));

const qrcode = require('qrcode-terminal');
const fs = require('fs');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const axios = require('axios');

// ===============================
// 📦 CATÁLOGOS (API)
// ===============================
async function obtenerCatalogoVapes() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1uMDtmMct7PBreGaLtG3V8EMeOJTpJgUyYj67Vox05zk/Vapers'
    );

    return res.data
      .filter(i => i.stock?.toLowerCase() === 'en stock')
      .map((item, i) => ({
        id: item.id || `V${i + 1}`,
        nombre: item.nombre.trim(),
        precio: Number(item.precio),
        desc: item.descripcion || ''
      }));
  } catch {
    return [];
  }
}

async function obtenerCatalogoPerfumes() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/perfumes'
    );

    return res.data
      .filter(i => i.stock?.toLowerCase() === 'en stock')
      .map((item, i) => ({
        id: `P${i + 1}`,
        nombre: `${item.marca} ${item.modelo}`,
        precio: Number(item.precio),
        desc: `${item.genero} - ${item.descripcion}`
      }));
  } catch {
    return [];
  }
}

async function obtenerCatalogoSkincare() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/skincare'
    );

    return res.data
      .filter(i => i.stock?.toLowerCase() === 'en stock')
      .map((item, i) => ({
        id: `S${i + 1}`,
        nombre: item.producto,
        precio: Number(item.precio),
        desc: `${item.tipo} | ${item.para_que}`
      }));
  } catch {
    return [];
  }
}

// ===============================
// 🧠 ESTADOS
// ===============================
const usuarios = {};

// ===============================
// 🚚 ENVÍO
// ===============================
function calcularEnvio(ciudad) {
  return ciudad.toLowerCase().includes('capital') ? 3000 : 5000;
}

// ===============================
// 💾 GUARDAR ORDEN
// ===============================
function guardarOrden(orden) {
  const data = fs.existsSync('ordenes.json')
    ? JSON.parse(fs.readFileSync('ordenes.json'))
    : [];

  data.push(orden);
  fs.writeFileSync('ordenes.json', JSON.stringify(data, null, 2));
}

// ===============================
// 🚀 BOT
// ===============================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === 'open') console.log('✅ Bot conectado');
    if (connection === 'close') {
      console.log('🔄 Reconectando...');
      startBot();
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!texto) return;

    const input = texto.toLowerCase().trim();
    if (!usuarios[from]) usuarios[from] = { estado: 'inicio' };

    if (input === 'menu') usuarios[from] = { estado: 'inicio' };

    const user = usuarios[from];

    try {
      switch (user.estado) {

        case 'inicio':
          user.estado = 'categoria';
          await sock.sendMessage(from, {
            text: 'Hola 👋\n\n1. Vapes\n2. Skincare\n3. Perfumes'
          });
          break;

        case 'categoria':
          if (input === '1') {
            user.catalogoActual = await obtenerCatalogoVapes();
          } else if (input === '2') {
            user.catalogoActual = await obtenerCatalogoSkincare();
          } else if (input === '3') {
            user.catalogoActual = await obtenerCatalogoPerfumes();
          } else {
            return sock.sendMessage(from, { text: 'Elegí 1, 2 o 3' });
          }

          user.estado = 'producto';

          await sock.sendMessage(from, {
            text: `📦 Catálogo:
https://docs.google.com/

👉 Escribí el nombre del producto
👉 o "menu" para volver`
          });
          break;

        case 'producto':
          if (!user.catalogoActual) return;

          const prod = user.catalogoActual.find(p =>
            p.nombre.toLowerCase().includes(input)
          );

          if (!prod) {
            return sock.sendMessage(from, {
              text: '❌ No encontrado, probá otro nombre'
            });
          }

          user.producto = prod;
          user.estado = 'cantidad';

          await sock.sendMessage(from, {
            text: `Elegiste ${prod.nombre}\nPrecio: $${prod.precio}\n\nCantidad?`
          });
          break;

        case 'cantidad':
          const cant = parseInt(input);
          if (!cant) return;

          user.cantidad = cant;
          user.estado = 'nombre';

          await sock.sendMessage(from, { text: 'Nombre:' });
          break;

        case 'nombre':
          user.nombre = texto;
          user.estado = 'direccion';
          await sock.sendMessage(from, { text: 'Dirección:' });
          break;

        case 'direccion':
          user.direccion = texto;
          user.estado = 'ciudad';
          await sock.sendMessage(from, { text: 'Ciudad:' });
          break;

        case 'ciudad':
          user.ciudad = texto;
          user.envio = calcularEnvio(texto);
          user.estado = 'pago';

          const total = user.producto.precio * user.cantidad + user.envio;

          await sock.sendMessage(from, {
            text: `Total: $${total}\n\nAlias: ${process.env.ALIAS_PAGO}\n\nEscribí "pagado"`
          });
          break;

        case 'pago':
          if (!input.includes('pag')) return;

          guardarOrden(user);

          await sock.sendMessage(from, {
            text: '✅ Pedido confirmado!'
          });

          usuarios[from] = { estado: 'inicio' };
          break;
      }

    } catch (err) {
      console.error(err);
    }
  });
}

startBot();
