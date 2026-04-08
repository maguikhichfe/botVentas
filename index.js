import fetch from 'node-fetch';

const token = 'TU_TOKEN';
const phoneId = 'TU_PHONE_ID';
const recipient = '5491123456789'; // número con código de país
const message = 'Hola desde tu VPS!';

const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messaging_product: "whatsapp",
    to: recipient,
    text: { body: message }
  })
});

const data = await res.json();
console.log(data);
