const express = require('express');
const mysql = require('mysql2/promise');  // Promise-baserad för async
const qrcode = require('qrcode');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Anslut till Oderlands MariaDB/MySQL (använd dina uppgifter)
const dbConfig = {
  host: 'localhost',  // Oderland: Oftast localhost
  user: 'johnnynu/lunchkuponger',  // Från phpMyAdmin
  password: 'Jk2025lunch',
  database: 'johnnynu_lunchkuponger_db',
  port: 3306
};

// Pool för bättre prestanda
const pool = mysql.createPool(dbConfig);

// Testa anslutning vid start
pool.getConnection().then(conn => {
  console.log('Ansluten till MariaDB!');
  conn.release();
}).catch(err => console.error('DB-fel:', err));

// === ADMIN: Lägg till kund ===
app.post('/admin/add', async (req, res) => {
  try {
    const pnr = req.body.pnr;
    const cleanPnr = pnr?.replace(/[-\s]/g, '');

    if (!cleanPnr || cleanPnr.length !== 12 || !/^\d+$/.test(cleanPnr)) {
      return res.status(400).json({ error: 'Ogiltigt personnummer – ange 12 siffror (t.ex. 197708251991)' });
    }

    const token = Math.random().toString(36).substr(2, 9);
    const [result] = await pool.execute(
      'INSERT INTO users (pnr, qr_token, saldo) VALUES (?, ?, 10)',
      [cleanPnr, token]
    );

    const qrUrl = `https://${req.get('host')}/qr/${token}`;
    const qrImage = await qrcode.toDataURL(qrUrl);

    res.send(`
      <h2>Kund tillagd!</h2>
      <p>Personnummer: ${cleanPnr}</p>
      <p>Saldo: 10 luncher</p>
      <img src="${qrImage}" alt="QR-kod">
      <p><a href="/qr/${token}" target="_blank">Öppna QR-sida</a></p>
      <hr><a href="/">Tillbaka</a>
    `);
  } catch (err) {
    res.status(500).send('Fel: ' + err.message);
  }
});

// === QR-sida ===
app.get('/qr/:token', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE qr_token = ?', [req.params.token]);
    const user = rows[0];
    if (!user) return res.send('<h3>Ogiltig QR-kod</h3>');

    res.send(`
      <!DOCTYPE html>
      <html><head><title>Lunchkupong</title></head>
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
              body: JSON.stringify({ userId: '${user.id}' })
            });
            const data = await res.json();
            document.getElementById('status').innerHTML = data.msg;
            if (data.msg.includes('Godkänd')) setTimeout(() => location.reload(), 1500);
          }
        </script>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('Fel: ' + err.message);
  }
});

// === Validera ===
app.post('/validate', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.body.userId]);
    const user = rows[0];
    if (!user) return res.json({ msg: 'Kund ej funnen' });

    if (user.saldo > 0) {
      await pool.execute('UPDATE users SET saldo = saldo - 1 WHERE id = ?', [req.body.userId]);
      res.json({ msg: `Godkänd! Nytt saldo: ${user.saldo - 1}` });
    } else {
      res.json({ msg: 'Inga kuponger kvar!' });
    }
  } catch (err) {
    res.status(500).json({ msg: 'Valideringsfel' });
  }
});

// === Startsida ===
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head><title>Lunchkupong Admin</title></head>
    <body style="font-family: sans-serif; max-width: 600px; margin: 2rem auto; padding: 1rem;">
      <h1>Lunchkupong MVP</h1>
      <form action="/admin/add" method="POST">
        <label>Personnummer (t.ex. 1977-08-25-1991):</label><br>
        <input name="pnr" type="text" required placeholder="197708251991" style="width: 100%; padding: 0.5rem; margin: 0.5rem 0;"><br>
        <button type="submit" style="padding: 0.8rem 1.5rem; background: #28a745; color: white; border: none; border-radius: 5px;">
          Lägg till kund (10 kuponger)
        </button>
      </form>
    </body></html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server kör på port ${PORT}`));
