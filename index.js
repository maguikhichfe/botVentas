// ===============================
// 📦 WhatsApp Bot de Ventas
// Stack: Node.js + Baileys
// ===============================

// 👉 INSTALAR DEPENDENCIAS:
// npm init -y
// npm install @whiskeysockets/baileys dotenv fs

// 👉 CREAR .env:
// SELLER_NUMBER=549XXXXXXXXXX
// ALIAS_PAGO=tu.alias.mp

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI);

const sessionSchema = new mongoose.Schema({
  _id: String,
  data: Object
});

const Session = mongoose.model('Session', sessionSchema);

require('dotenv').config();
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const axios = require('axios');

async function obtenerCatalogoVapes() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1uMDtmMct7PBreGaLtG3V8EMeOJTpJgUyYj67Vox05zk/Vapers'
    );

    return res.data
    .filter(item => item.stock?.toLowerCase() === 'en stock')
    .map((item, index) => ({
        id: item.id || `V${index + 1}`,
        nombre: item.nombre.trim(),
        precio: Number(item.precio),
        desc: item.descripcion || ''
    }));
  } catch (error) {
    console.error('Error cargando catálogo:', error);
    return [];
  }
}

async function obtenerCatalogoPerfumes() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/perfumes'
    );

    return res.data
      .filter(item => item.stock?.toLowerCase() === 'en stock')
      .map((item, index) => ({
        id: `P${index + 1}`,
        nombre: `${item.marca} ${item.modelo}`,
        precio: Number(item.precio),
        desc: `${item.genero} - ${item.descripcion}`
      }));

  } catch (error) {
    console.error('Error cargando perfumes:', error);
    return [];
  }
}

async function obtenerCatalogoSkincare() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/skincare'
    );

    return res.data
      .filter(item => item.stock?.toLowerCase() === 'en stock')
      .map((item, index) => ({
        id: `S${index + 1}`,
        nombre: item.producto,
        precio: Number(item.precio),
        desc: `${item.tipo} | ${item.para_que} | ${item.destacado || ''}`
      }));

  } catch (error) {
    console.error('Error cargando skincare:', error);
    return [];
  }
}
// ===============================
// 📦 CATÁLOGO
// ===============================
const catalogo = {
  vapes: [
    { id: 'V1', nombre: 'Vape Elfbar', precio: 15000, desc: '5000 puffs' },
    { id: 'V2', nombre: 'Vape Ignite', precio: 18000, desc: '6000 puffs' }
  ],
  skincare: [
    { id: 'S1', nombre: 'Serum Vitamina C', precio: 12000, desc: 'Coreano' },
    { id: 'S2', nombre: 'Crema Snail', precio: 14000, desc: 'Hidratante' }
  ],
  perfumes: [
    { id: 'P1', nombre: 'Perfume Oud', precio: 25000, desc: 'Árabe intenso' },
    { id: 'P2', nombre: 'Perfume Musk', precio: 22000, desc: 'Dulce' }
  ]
};

// ===============================
// 🧠 ESTADOS
// ===============================
const usuarios = {};

// ===============================
// 🚚 ENVÍO
// ===============================
function calcularEnvio(ciudad) {
  if (ciudad.toLowerCase().includes('capital')) return 3000;
  return 5000;
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
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    printQRInTerminal: true,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    });
  sock.ev.on('connection.update', (update) => {
    const { qr } = update;
    if (qr) {
        qrcode.generate(qr, { small: true });
    }
    });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;

  const msg = messages[0];
  if (!msg.message) return;
  if (msg.key.fromMe) return;

  const from = msg.key.remoteJid;
  const texto =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text;

  if (!texto) return;

  const input = texto.toLowerCase().trim();
  if (!usuarios[from]) usuarios[from] = { estado: 'inicio' };

// 🔄 REINICIAR
  if (input === 'menu') {
    usuarios[from] = { estado: 'inicio' };
  }

  const user = usuarios[from];
  try {

    if (user.procesando) return;
    user.procesando = true;

    switch (user.estado) {

    case 'inicio':
        user.estado = 'categoria';
        await sock.sendMessage(from, {
          text: 'Hola! 👋 Bienvenido/a. ¿Qué estás buscando?\n\n1. Vapes\n2. Skincare coreano\n3. Perfumes árabes'
        });
        break;

    case 'categoria':

        if (input === '1' || input.includes('vape')) {
            user.cat = 'vapes';
            user.catalogoActual = await obtenerCatalogoVapes();
            await sock.sendMessage(from, {
            text: `💨 Catálogo de Vapes:
        https://docs.google.com/spreadsheets/d/1uMDtmMct7PBreGaLtG3V8EMeOJTpJgUyYj67Vox05zk

        👉 Escribí el nombre del modelo que te gustó
        👉 O escribí "menu" para ver otras categorías`
            });

        } 
        else if (input === '2' || input.includes('skin')) {
            user.cat = 'skincare';
            user.catalogoActual = await obtenerCatalogoSkincare();

            await sock.sendMessage(from, {
            text: `🧴 Catálogo Skincare:
        https://docs.google.com/spreadsheets/d/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/edit?gid=2060260992#gid=2060260992

        👉 Escribí el nombre del producto que te gustó
        👉 O escribí "menu" para ver otras categorías`
            });

        } 
        else if (input === '3' || input.includes('perfume')) {
            user.cat = 'perfumes';
            user.catalogoActual = await obtenerCatalogoPerfumes();

            await sock.sendMessage(from, {
            text: `🌸 Catálogo Perfumes:
        https://docs.google.com/spreadsheets/d/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/edit?gid=0#gid=0
        👉 Escribí el modelo que te gustó (ej: Yara Pink, Khamrah)
        👉 O escribí "menu" para volver`
            });

        } 
        else {
            await sock.sendMessage(from, { text: 'Elegí una opción válida.' });
            return;
        }

        // 🔥 IMPORTANTE: ahora pasa a estado producto
        user.estado = 'producto';
        break;


    case 'producto':
        if (!user.catalogoActual) {
            await sock.sendMessage(from, {
                text: 'Error cargando productos. Escribí "menu" para reiniciar.'
            });
            user.estado = 'inicio';
            return;
        }



        const prod = user.catalogoActual.find(p =>
            p.nombre.toLowerCase().includes(input) ||
            input.split(' ').some(word => p.nombre.toLowerCase().includes(word))
        );

        if (input === 'menu') {
            user.estado = 'inicio';
            return await sock.sendMessage(from, {
                text: 'Volviendo al menú...'
            });
        }
        if (input.includes('asesor') || input.includes('humano')) {
            await sock.sendMessage(from, {
                text: 'En breve te atiende una persona 😊'
            });

            await sock.sendMessage(
                process.env.SELLER_NUMBER + '@s.whatsapp.net',
                {
                text: `📲 Cliente solicita atención humana: ${from}`
                }
            );

            return;
            }

       if (!prod) {
        const sugerencias = user.catalogoActual
            .filter(p => p.nombre.toLowerCase().includes(input.slice(0, 3)))
            .slice(0, 3)
            .map(p => `• ${p.nombre}`)
            .join('\n');

        await sock.sendMessage(from, { 
            text: `❌ No encontré ese modelo.\n\nQuizás quisiste decir:\n${sugerencias || 'Probá con otro nombre'}` 
        });
        return;
        }

        user.producto = prod;
        user.estado = 'cantidad';

        await sock.sendMessage(from, {
            text: `✨ Elegiste: ${prod.nombre}\n💰 Precio: $${prod.precio}\n\n¿Cuántas unidades querés?`
        });

        break;

      case 'cantidad':
        const cantidad = parseInt(input);

        if (isNaN(cantidad) || cantidad <= 0 || cantidad > 10) {
            await sock.sendMessage(from, { 
                text: 'Ingresá una cantidad válida (1 a 10).' 
            });
            return;
            }

        user.cantidad = cantidad;
        user.estado = 'nombre';

        await sock.sendMessage(from, { text: 'Nombre completo:' });
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
        user.estado = 'cp';
        await sock.sendMessage(from, { text: 'Código postal:' });
        break;

      case 'cp':
        user.cp = texto;

        const totalProd = user.producto.precio * user.cantidad;
        const totalFinal = totalProd + user.envio;

        user.total = totalFinal;
        user.estado = 'pago';

        await sock.sendMessage(from, {
          text: `Resumen:\nProducto: ${user.producto.nombre}\nCantidad: ${user.cantidad}\nSubtotal: $${totalProd}\nEnvío: $${user.envio}\nTotal: $${totalFinal}\n\nPagá a alias: ${process.env.ALIAS_PAGO}\nLuego escribí: He pagado`
        });
        break;

        case 'pago':
        if (!input.includes('pag')) {
            await sock.sendMessage(from, {
            text: 'Cuando pagues escribí "He pagado"'
            });
            return;
        }

        const orden = {
            cliente: user.nombre,
            direccion: user.direccion,
            ciudad: user.ciudad,
            cp: user.cp,
            producto: user.producto.nombre,
            cantidad: user.cantidad,
            total: user.total
        };

        // 💾 guardar en archivo
        guardarOrden(orden);

        // 📲 MENSAJE PARA VOS (VENDEDORA)
        await sock.sendMessage(
            process.env.SELLER_NUMBER + '@s.whatsapp.net',
            {
            text:
                `🛒 NUEVA VENTA\n\n` +
                `👤 Cliente: ${orden.cliente}\n` +
                `📦 Producto: ${orden.producto}\n` +
                `🔢 Cantidad: ${orden.cantidad}\n` +
                `💰 Total: $${orden.total}\n\n` +
                `📍 Dirección: ${orden.direccion}\n` +
                `🏙 Ciudad: ${orden.ciudad}\n` +
                `📮 CP: ${orden.cp}`
            }
        );

        // ✅ RESPUESTA AL CLIENTE
        await sock.sendMessage(from, {
            text: '✅ Pedido confirmado! Gracias por tu compra.'
        });

        usuarios[from] = { estado: 'inicio' };
        break;
    }
  } catch (err) {
    console.error(err);
    await sock.sendMessage(from, {
      text: 'Error. Escribí "menu" para reiniciar.'
    });
  }finally {
  user.procesando = false;
}
});
}

startBot();

// ===============================
// 📘 INSTRUCCIONES
// ===============================
// 1. node index.js
// 2. Escanear QR
// 3. Listo!

// ===============================
// ✏️ EDITAR PRECIOS
// ===============================
// Modificar valores en objeto "catalogo"

// ===============================
// 💡 SIGUIENTES MEJORAS
// ===============================
// - Integrar MercadoPago
// - Usar MongoDB
// - Botones interactivos
// ===============================
