require('dotenv').config();
const mongoose = require('mongoose');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const makeWASocket = require('@whiskeysockets/baileys').default;
const axios = require('axios');

// ===============================
// 🧠 MONGO (SESIONES)
// ===============================
mongoose.connect(process.env.MONGO_URI);

const sessionSchema = new mongoose.Schema({
  _id: String,
  value: Object
});

const Session = mongoose.model('Session', sessionSchema);

// 👉 IMPLEMENTACIÓN CLAVE
const useMongoAuthState = async () => {
  const writeData = async (id, value) => {
    await Session.findByIdAndUpdate(
      id,
      { value },
      { upsert: true }
    );
  };

  const readData = async (id) => {
    const data = await Session.findById(id);
    return data?.value || null;
  };

  const removeData = async (id) => {
    await Session.findByIdAndDelete(id);
  };

  return {
    state: {
      creds: (await readData('creds')) || {},
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (let id of ids) {
            const value = await readData(`${type}-${id}`);
            if (value) data[id] = value;
          }
          return data;
        },
        set: async (data) => {
          for (let category in data) {
            for (let id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;

              if (value) await writeData(key, value);
              else await removeData(key);
            }
          }
        }
      }
    },
    saveCreds: async () => {
      await writeData('creds', state.creds);
    }
  };
};

// ===============================
// 📦 CATÁLOGOS
// ===============================
async function obtenerCatalogoVapes() {
  const res = await axios.get('https://opensheet.elk.sh/1uMDtmMct7PBreGaLtG3V8EMeOJTpJgUyYj67Vox05zk/Vapers');
  return res.data
    .filter(x => x.stock?.toLowerCase() === 'en stock')
    .map((x, i) => ({
      id: `V${i+1}`,
      nombre: x.nombre.trim(),
      precio: Number(x.precio)
    }));
}

async function obtenerCatalogoPerfumes() {
  const res = await axios.get('https://opensheet.elk.sh/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/perfumes');
  return res.data
    .filter(x => x.stock?.toLowerCase() === 'en stock')
    .map((x,i) => ({
      id: `P${i+1}`,
      nombre: `${x.marca} ${x.modelo}`,
      precio: Number(x.precio)
    }));
}

async function obtenerCatalogoSkincare() {
  const res = await axios.get('https://opensheet.elk.sh/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/skincare');
  return res.data
    .filter(x => x.stock?.toLowerCase() === 'en stock')
    .map((x,i) => ({
      id: `S${i+1}`,
      nombre: x.producto,
      precio: Number(x.precio)
    }));
}

// ===============================
// 🧠 ESTADOS
// ===============================
const usuarios = {};

// ===============================
function calcularEnvio(ciudad) {
  return ciudad.toLowerCase().includes('capital') ? 3000 : 5000;
}

// ===============================
async function startBot() {
  const { state, saveCreds } = await useMongoAuthState();

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === 'close') {
      console.log('🔄 Reconectando...');
      startBot();
    }

    if (connection === 'open') {
      console.log('✅ Conectado');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!texto) return;

    const input = texto.toLowerCase().trim();
    if (!usuarios[from]) usuarios[from] = { estado: 'inicio' };

    const user = usuarios[from];

    try {
      switch(user.estado) {

        case 'inicio':
          user.estado = 'categoria';
          return sock.sendMessage(from, {
            text: `Hola 👋\n\n1. Vapes\n2. Skincare\n3. Perfumes`
          });

        case 'categoria':
          if (input === '1') {
            user.catalogoActual = await obtenerCatalogoVapes();
            user.estado = 'producto';
            return sock.sendMessage(from, {
              text: `💨 Catálogo:\nhttps://docs.google.com/spreadsheets/d/1uMD...\n\nEscribí el modelo`
            });
          }

          if (input === '2') {
            user.catalogoActual = await obtenerCatalogoSkincare();
            user.estado = 'producto';
            return sock.sendMessage(from, {
              text: `🧴 Catálogo:\nhttps://docs.google.com/spreadsheets/d/1G3wi...\n\nEscribí el producto`
            });
          }

          if (input === '3') {
            user.catalogoActual = await obtenerCatalogoPerfumes();
            user.estado = 'producto';
            return sock.sendMessage(from, {
              text: `🌸 Catálogo:\nhttps://docs.google.com/spreadsheets/d/1G3wi...\n\nEscribí el modelo`
            });
          }

          return sock.sendMessage(from, { text: 'Elegí 1, 2 o 3' });

        case 'producto':
          if (!user.catalogoActual) {
            user.estado = 'inicio';
            return sock.sendMessage(from, { text: 'Error. Escribí menu' });
          }

          const prod = user.catalogoActual.find(p =>
            p.nombre.toLowerCase().includes(input)
          );

          if (!prod) {
            return sock.sendMessage(from, {
              text: 'No encontré ese modelo. Probá de nuevo.'
            });
          }

          user.producto = prod;
          user.estado = 'cantidad';

          return sock.sendMessage(from, {
            text: `${prod.nombre} - $${prod.precio}\n\nCantidad?`
          });

        case 'cantidad':
          user.cantidad = parseInt(input);
          user.estado = 'nombre';
          return sock.sendMessage(from, { text: 'Nombre:' });

        case 'nombre':
          user.nombre = texto;
          user.estado = 'direccion';
          return sock.sendMessage(from, { text: 'Dirección:' });

        case 'direccion':
          user.direccion = texto;
          user.estado = 'ciudad';
          return sock.sendMessage(from, { text: 'Ciudad:' });

        case 'ciudad':
          user.ciudad = texto;
          user.envio = calcularEnvio(texto);
          user.estado = 'pago';

          const total = user.producto.precio * user.cantidad + user.envio;

          return sock.sendMessage(from, {
            text: `Total: $${total}\nAlias: ${process.env.ALIAS_PAGO}\n\nEscribí "pagado"`
          });

        case 'pago':
          return sock.sendMessage(from, {
            text: '✅ Pedido confirmado!'
          });
      }

    } catch(err) {
      console.error(err);
      sock.sendMessage(from, { text: 'Error. Escribí menu' });
    }
  });
}

startBot();
