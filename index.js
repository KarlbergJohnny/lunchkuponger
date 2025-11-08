const express = require('express');
const app = express();

// ENKEL TEST – cPanel måste se detta
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html><head><title>Test</title></head>
    <body style="font-family:Arial;text-align:center;padding:2rem;">
      <h1>Node.js fungerar!</h1>
      <p>cPanel-check: <strong>OK</strong></p>
    </body></html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server kör på port ' + PORT);
});
