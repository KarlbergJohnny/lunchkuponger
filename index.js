const express = require('express');
const mongoose = require('mongoose');
const qrcode = require('qrcode');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Anslut till MongoDB (gratis Atlas)
mongoose.connect(process.env.MONGO_URL || 'mongodb+srv://test:test@cluster0.mongodb.net/lunch?retryWrites=true&w=majority')
  .then(() => console.log('MongoDB ansluten'))
  .catch(err => console.log('MongoDB fel:', err));

// Kundmodell
const User = mongoose.model('User', new mongoose.Schema({
  pnr: String,
  saldo: { type: Number, default: 10 },
  qrToken: String
}));

// === ADMIN: Lägg till kund ===
app.post('/admin/add', async (req, res) => {
  const { pnr } = req.body;
  if (!pnr || pnr.length < 10) return res.status(400).json({ error: 'Ogiltigt personnummer' });

  const token = Math.random().toString(36).substr(2, 9);
  const user = new User({ pnr, qrToken: token });
  await user.save();

  const qrUrl = `https://${req.headers.host}/qr/${token}`;
  const qrImage = await qrcode.toDataURL(qrUrl);

  res.send(`
    <h2>Kund tillagd!</h2>
    <p>Personnummer: ${pnr}</p>
    <p>Saldo: 10 luncher</p>
    <img src="${qrImage}" alt="QR-kod">
    <p><a href="/qr/${token}" target="_blank">Öppna QR-sida</a></p>
    <hr>
    <a href="/">Tillbaka</a>
  `);
});

// === QR-sida för kund ===
app.get('/qr/:token', async (req, res) => {
  const user = await User.findOne({ qrToken: req.params.token });
  if (!user) return res.send('<h3>Ogiltig QR-kod</h3>');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Lunchkupong</title></head>
    <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
      <h2>Saldo: <strong>${user.saldo}</strong> luncher</h2>
      <button onclick="useCoupon()" style="padding: 1rem 2rem; font-size: 1.2rem; background: #007bff; color: white; border: none; border-radius: 8px;">
        Använd 1 kupong
      </button>
      <p id="status" style="margin-top: 1rem; font-weight: bold;"></p>
      <script>
        async function useCoupon() {
          const res = await fetch('/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: '${user._id}' })
          });
          const data = await res.json();
          document.getElementById('status').innerHTML = data.msg;
          if (data.msg.includes('Godkänd')) {
            setTimeout(() => location.reload(), 1500);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// === Validera kupong ===
app.post('/validate', async (req, res) => {
  const user = await User.findById(req.body.userId);
  if (!user) return res.json({ msg: 'Kund ej funnen' });

  if (user.saldo > 0) {
    user.saldo -= 1;
    await user.save();
    res.json({ msg: `Godkänd! Nytt saldo: ${user.saldo}` });
  } else {
    res.json({ msg: 'Inga kuponger kvar!' });
  }
});

// === Startsida ===
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Lunchkupong Admin</title></head>
    <body style="font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem;">
      <h1>Lunchkupong MVP</h1>
      <form action="/admin/add" method="POST">
        <label>Personnummer (t.ex. 199001011234):</label><br>
        <input name="pnr" type="text" required style="width: 100%; padding: 0.5rem; margin: 0.5rem 0;"><br>
        <button type="submit" style="padding: 0.8rem 1.5rem; background: #28a745; color: white; border: none; border-radius: 5px;">
          Lägg till kund (10 kuponger)
        </button>
      </form>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kör på port ${PORT}`));
