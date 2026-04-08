// ===============================
// 📦 WhatsApp Bot de Ventas
// Stack: Node.js + Baileys
// ===============================
import qrcode from "qrcode-terminal"
require('dotenv').config();
const qrcode = require('qrcode-terminal');
const fs = require('fs');

console.log('📁 auth existe:', fs.existsSync('./auth'));
console.log('📁 creds existe:', fs.existsSync('./auth/creds.json'));
const axios = require('axios');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

// ===============================
// ⏱️ TIMEOUT DE SESIÓN (30 min)
// ===============================
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function sesionExpirada(user) {
  if (!user.ultimaActividad) return false;
  return Date.now() - user.ultimaActividad > SESSION_TIMEOUT_MS;
}

// ===============================
// 📦 OBTENER CATÁLOGOS
// ===============================
async function obtenerCatalogoVapes() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1uMDtmMct7PBreGaLtG3V8EMeOJTpJgUyYj67Vox05zk/Vapers'
    );
    return res.data
      .filter(item => item.stock?.toLowerCase() === 'en stock')
      .map((item, index) => ({
        id: `V${index + 1}`,
        nombre: item.nombre.trim(),
        precio: Number(item.precio),
        desc: item.descripcion || ''
      }));
  } catch (error) {
    console.error('Error cargando catálogo de vapes:', error);
    return catalogo.vapes; // fallback local
  }
}

async function obtenerCatalogoPerfumes() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/perfumes'
    );
    return res.data
      .filter(item => item.stock?.trim().toUpperCase() === 'EN STOCK')
      .map((item, index) => ({
        id: `P${index + 1}`,
        nombre: `${item.marca} ${item.modelo}`.trim(),
        // FIX: regex global para reemplazar TODOS los puntos de miles
        precio: Number(item.precio.replace(/\./g, '').replace(',', '.')),
        desc: `${item.genero} | Imita a: ${item['Imita al perfume'] || '-'}`
      }));
  } catch (error) {
    console.error('Error cargando perfumes:', error);
    return catalogo.perfumes; // fallback local
  }
}

async function obtenerCatalogoSkincare() {
  try {
    const res = await axios.get(
      'https://opensheet.elk.sh/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/skincare'
    );
    return res.data
      .filter(item => item.stock?.trim() === '1')
      .map((item, index) => ({
        id: `S${index + 1}`,
        nombre: item.producto.trim(),
        // FIX: regex global para reemplazar TODOS los puntos de miles
        precio: Number(item.precio.replace(/\./g, '').replace(',', '.')),
        desc: `${item.tipo} | ${item['¿para qué sirve?']} | ${item['tipo de piel']} | ${item.destacado || ''}`
      }));
  } catch (error) {
    console.error('Error cargando skincare:', error);
    return catalogo.skincare; // fallback local
  }
}

// ===============================
// 📦 CATÁLOGO ESTÁTICO (fallback)
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
// 🔄 RESETEAR SESIÓN (sin romper referencia)
// ===============================
function resetearSesion(user) {
  // FIX: mutamos el objeto en lugar de reemplazarlo,
  // para que la referencia local `user` siga siendo válida
  // (evita que user.procesando = false en el finally quede huérfano)
  Object.keys(user).forEach(k => delete user[k]);
  user.estado = 'inicio';
  user.ultimaActividad = Date.now();
}

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
  data.push({ ...orden, fecha: new Date().toISOString() });
  fs.writeFileSync('ordenes.json', JSON.stringify(data, null, 2));
}

// ===============================
// 📋 FORMATEAR CATÁLOGO
// ===============================
function formatearCatalogo(items) {
  return items
    .map(p => `• [${p.id}] ${p.nombre} — $${p.precio.toLocaleString('es-AR')}\n  ${p.desc}`)
    .join('\n\n');
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
    markOnlineOnConnect: false
  });

  sock.ev.on("connection.update", ({ connection, qr }) => {
    if (qr) {
      console.log("📱 ESCANEÁ ESTE QR:")
      qrcode.generate(qr, { small: true })
    }
  
    if (connection === "open") {
      console.log("✅ CONECTADO")
    }
  
    if (connection === "close") {
      console.log("❌ Conexión cerrada, reconectando...")
      conectar() // tu función
    }
  })
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!texto) return;
    const input = texto.toLowerCase().trim();

    // Inicializar usuario nuevo
    if (!usuarios[from]) {
      usuarios[from] = { estado: 'inicio', ultimaActividad: Date.now() };
    }

    const user = usuarios[from];

    // FIX: evitar procesamiento doble (concurrencia)
    if (user.procesando) return;
    user.procesando = true;

    try {
      // FIX: sesión expirada → resetear y avisar
      if (sesionExpirada(user)) {
        resetearSesion(user);
        await sock.sendMessage(from, {
          text: '⏱️ Tu sesión expiró por inactividad. Volvemos al inicio...'
        });
      }

      // Actualizar timestamp de actividad
      user.ultimaActividad = Date.now();

      // FIX: "menu" resetea correctamente sin romper la referencia
      if (input === 'menu') {
        resetearSesion(user);
        // Dejamos que el switch maneje el estado 'inicio' a continuación
      }

      switch (user.estado) {

        // ===============================
        // FIX: case 'inicio' ahora existe
        // ===============================
        case 'inicio': {
          user.estado = 'categoria';
          await sock.sendMessage(from, {
            text:
              '👋 ¡Bienvenido! ¿Qué categoría te interesa?\n\n' +
              '1️⃣ Vapes\n' +
              '2️⃣ Skincare\n' +
              '3️⃣ Perfumes\n\n' +
              'Respondé con el número o el nombre.'
          });
          break;
        }

        // ===============================
        case 'categoria': {
          let nombreCat = '';
          let emoji = '';

          const links = {
            vapes:    'https://docs.google.com/spreadsheets/d/1uMDtmMct7PBreGaLtG3V8EMeOJTpJgUyYj67Vox05zk/edit?gid=0#gid=0',
            skincare: 'https://docs.google.com/spreadsheets/d/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/edit?gid=2060260992#gid=2060260992',
            perfumes: 'https://docs.google.com/spreadsheets/d/1G3wiI8DPC_yZnnbrMgT-A2f_kVzpea_4VEOnLdZoX6k/edit?gid=0#gid=0'
          };
          let linkCat = '';

          if (input === '1' || input.includes('vape')) {
            user.cat = 'vapes';
            nombreCat = 'Vapes';
            emoji = '💨';
            linkCat = links.vapes;
            user.catalogoActual = await obtenerCatalogoVapes();
          } else if (input === '2' || input.includes('skin')) {
            user.cat = 'skincare';
            nombreCat = 'Skincare';
            emoji = '🧴';
            linkCat = links.skincare;
            user.catalogoActual = await obtenerCatalogoSkincare();
          } else if (input === '3' || input.includes('perfume')) {
            user.cat = 'perfumes';
            nombreCat = 'Perfumes';
            emoji = '🌸';
            linkCat = links.perfumes;
            user.catalogoActual = await obtenerCatalogoPerfumes();
          } else {
            await sock.sendMessage(from, {
              text: '❓ No entendí. Respondé 1 (Vapes), 2 (Skincare) o 3 (Perfumes).'
            });
            break;
          }

          if (!user.catalogoActual || user.catalogoActual.length === 0) {
            await sock.sendMessage(from, {
              text: `😕 El catálogo de ${nombreCat} no está disponible ahora. Intentá de nuevo en unos minutos o escribí *menu*.`
            });
            user.estado = 'inicio';
            break;
          }

          user.estado = 'producto';

          await sock.sendMessage(from, {
            text:
              `${emoji} *Catálogo de ${nombreCat}:*\n\n` +
              `📄 Podés ver todos los productos disponibles acá:\n${linkCat}\n\n` +
              `✏️ Cuando elijas, escribime el nombre (o parte del nombre) del producto.\n\n` +
              `💬 También podés escribir *asesor* para hablar con una persona o *menu* para volver al inicio.`
          });
          break;
        }

        // ===============================
        case 'producto': {
          if (input.includes('asesor') || input.includes('humano')) {
            await sock.sendMessage(from, {
              text: '👤 En breve te atiende una persona 😊'
            });
            await sock.sendMessage(process.env.SELLER_NUMBER + '@s.whatsapp.net', {
              text: `📲 Cliente solicita atención humana: ${from}`
            });
            break;
          }

          // Buscar producto por coincidencia parcial
          const prod = user.catalogoActual.find(p =>
            p.nombre.toLowerCase().includes(input) ||
            input.split(' ').some(word => word.length > 2 && p.nombre.toLowerCase().includes(word))
          );

          if (!prod) {
            const sugerencias = user.catalogoActual
              .filter(p =>
                input.split(' ').some(word => word.length > 2 && p.nombre.toLowerCase().includes(word.slice(0, 4)))
              )
              .slice(0, 3)
              .map(p => `• ${p.nombre}`)
              .join('\n');

            await sock.sendMessage(from, {
              text:
                `❌ No encontré ese producto.\n\n` +
                (sugerencias ? `Quizás quisiste decir:\n${sugerencias}` : 'Probá con otro nombre o parte del nombre.') +
                `\n\nPodés ver el catálogo completo escribiendo *menu* y eligiendo la categoría de nuevo.`
            });
            break;
          }

          user.producto = prod;
          user.estado = 'cantidad';
          await sock.sendMessage(from, {
            text:
              `✨ Elegiste: *${prod.nombre}*\n` +
              `📝 ${prod.desc}\n` +
              `💰 Precio: $${prod.precio.toLocaleString('es-AR')}\n\n` +
              `¿Cuántas unidades querés? (máximo 10)`
          });
          break;
        }

        // ===============================
        case 'cantidad': {
          const cantidad = parseInt(input);
          if (isNaN(cantidad) || cantidad <= 0 || cantidad > 10) {
            await sock.sendMessage(from, {
              text: '⚠️ Ingresá una cantidad válida entre 1 y 10.'
            });
            break;
          }
          user.cantidad = cantidad;
          user.estado = 'nombre';
          await sock.sendMessage(from, { text: '👤 ¿Cuál es tu nombre completo?' });
          break;
        }

        // ===============================
        case 'nombre': {
          // FIX: validación mínima
          if (texto.trim().length < 2) {
            await sock.sendMessage(from, { text: '⚠️ Por favor ingresá tu nombre completo.' });
            break;
          }
          user.nombre = texto.trim();
          user.estado = 'direccion';
          await sock.sendMessage(from, { text: '📍 ¿Cuál es tu dirección de entrega? (calle, número, piso/depto)' });
          break;
        }

        // ===============================
        case 'direccion': {
          if (texto.trim().length < 5) {
            await sock.sendMessage(from, { text: '⚠️ Por favor ingresá una dirección válida.' });
            break;
          }
          user.direccion = texto.trim();
          user.estado = 'ciudad';
          await sock.sendMessage(from, { text: '🏙️ ¿En qué ciudad estás?' });
          break;
        }

        // ===============================
        case 'ciudad': {
          if (texto.trim().length < 2) {
            await sock.sendMessage(from, { text: '⚠️ Por favor ingresá una ciudad válida.' });
            break;
          }
          user.ciudad = texto.trim();
          user.envio = calcularEnvio(texto);
          user.estado = 'cp';
          await sock.sendMessage(from, { text: '📮 ¿Cuál es tu código postal?' });
          break;
        }

        // ===============================
        case 'cp': {
          if (!/^\d{4,8}$/.test(input.replace(/\s/g, ''))) {
            await sock.sendMessage(from, { text: '⚠️ Por favor ingresá un código postal válido (solo números).' });
            break;
          }
          user.cp = texto.trim();

          const totalProd = user.producto.precio * user.cantidad;
          const totalFinal = totalProd + user.envio;
          user.total = totalFinal;
          user.estado = 'pago';

          await sock.sendMessage(from, {
            text:
              `📋 *Resumen de tu pedido:*\n\n` +
              `🛍️ Producto: ${user.producto.nombre}\n` +
              `🔢 Cantidad: ${user.cantidad}\n` +
              `💵 Subtotal: $${totalProd.toLocaleString('es-AR')}\n` +
              `🚚 Envío: $${user.envio.toLocaleString('es-AR')}\n` +
              `💰 *TOTAL: $${totalFinal.toLocaleString('es-AR')}*\n\n` +
              `📍 Dirección: ${user.direccion}, ${user.ciudad} (CP: ${user.cp})\n\n` +
              `───────────────────\n` +
              `💳 Realizá tu pago al alias: *${process.env.ALIAS_PAGO}*\n` +
              `Cuando lo hagas, escribí: *He pagado*`
          });
          break;
        }

        // ===============================
        case 'pago': {
          if (!input.includes('pag')) {
            await sock.sendMessage(from, {
              text: '⏳ Cuando realices el pago escribí *He pagado* para confirmar tu pedido.'
            });
            break;
          }

          const orden = {
            cliente: user.nombre,
            telefono: from,
            direccion: user.direccion,
            ciudad: user.ciudad,
            cp: user.cp,
            producto: user.producto.nombre,
            cantidad: user.cantidad,
            envio: user.envio,
            total: user.total,
            fecha: new Date().toISOString()
          };

          // 💾 Guardar en archivo
          guardarOrden(orden);

          // 📲 Notificar al vendedor
          await sock.sendMessage(process.env.SELLER_NUMBER + '@s.whatsapp.net', {
            text:
              `🛒 *NUEVA VENTA*\n\n` +
              `👤 Cliente: ${orden.cliente}\n` +
              `📞 Teléfono: ${orden.telefono}\n` +
              `📦 Producto: ${orden.producto}\n` +
              `🔢 Cantidad: ${orden.cantidad}\n` +
              `🚚 Envío: $${orden.envio.toLocaleString('es-AR')}\n` +
              `💰 Total: $${orden.total.toLocaleString('es-AR')}\n\n` +
              `📍 Dirección: ${orden.direccion}\n` +
              `🏙️ Ciudad: ${orden.ciudad}\n` +
              `📮 CP: ${orden.cp}`
          });

          // ✅ Confirmar al cliente
          await sock.sendMessage(from, {
            text:
              `✅ *¡Pedido confirmado!*\n\n` +
              `Gracias por tu compra, ${user.nombre} 🎉\n` +
              `Te avisaremos cuando tu pedido esté en camino.\n\n` +
              `Si tenés alguna consulta escribí *menu* para volver al inicio.`
          });

          // Resetear sesión al terminar
          resetearSesion(user);
          break;
        }

        default: {
          // Estado desconocido: resetear
          resetearSesion(user);
          await sock.sendMessage(from, {
            text: '🔄 Algo salió mal. Volvemos al inicio...'
          });
          break;
        }
      }

    } catch (err) {
      console.error('Error en el bot:', err);
      await sock.sendMessage(from, {
        text: '⚠️ Ocurrió un error inesperado. Escribí *menu* para reiniciar.'
      });
    } finally {
      // FIX: esto siempre se ejecuta, incluso si hubo return dentro del switch
      // (en JS, finally corre siempre, pero usando break en vez de return
      // lo hacemos más predecible y mantenible)
      user.procesando = false;
    }
  });
}

// ===============================
// INICIAR BOT
// ===============================
startBot();
