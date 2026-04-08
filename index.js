import express from "express";

const app = express();
app.use(express.urlencoded({ extended: false }));

const usuarios = {};

// ===============================
// 📩 WEBHOOK TWILIO
// ===============================
app.post("/webhook", (req, res) => {
  const mensaje = req.body.Body.toLowerCase().trim();
  const numero = req.body.From;

  if (!usuarios[numero]) {
    usuarios[numero] = { estado: "inicio" };
  }

  const user = usuarios[numero];

  let respuesta = "";

  switch (user.estado) {
    case "inicio":
      user.estado = "categoria";
      respuesta = "👋 Hola!\n\n1️⃣ Vapes\n2️⃣ Perfumes";
      break;

    case "categoria":
      if (mensaje === "1") {
        user.cat = "vapes";
      } else if (mensaje === "2") {
        user.cat = "perfumes";
      } else {
        respuesta = "Elegí 1 o 2";
        break;
      }

      user.estado = "producto";
      respuesta = "Escribí el producto";
      break;

    case "producto":
      user.producto = mensaje;
      user.estado = "pago";
      respuesta = "💰 Pagá y escribí 'pagado'";
      break;

    case "pago":
      if (!mensaje.includes("pag")) {
        respuesta = "Escribí 'pagado'";
        break;
      }

      respuesta = "✅ Pedido confirmado!";
      delete usuarios[numero];
      break;
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(respuesta);

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

// ===============================
app.listen(3000, () => console.log("🚀 Server listo"));
