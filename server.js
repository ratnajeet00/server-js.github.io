const http = require('http');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const dbPath = './database.db';
const db = new sqlite3.Database(dbPath);

// Create the user table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT
  )`);

  // Check if the admin user exists, if not, create it
  db.get('SELECT * FROM users WHERE username = ?', 'admin', (err, row) => {
    if (!row) {
      const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
      stmt.run('admin', 'admin');
      stmt.finalize();
    }
  });
});

const server = http.createServer((req, res) => {
  // Parse JSON request bodies
  bodyParser.json()(req, res, () => {
    const { url, method, body } = req;

    if (url === '/login' && method === 'POST') {
      const { username, password } = body;

      db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (row) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Login successful' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Invalid username or password' }));
        }
      });
    } else if (url === '/addUser' && method === 'POST') {
      const { username, password } = body;

      db.get('SELECT * FROM users WHERE username = ?', username, (err, row) => {
        if (row) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Username already exists' }));
        } else {
          const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
          stmt.run(username, password);
          stmt.finalize();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'User created successfully' }));
        }
      });
    } else if (url === '/userList' && method === 'GET') {
      db.all('SELECT * FROM users', (err, rows) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows));
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not found' }));
    }
  });
});

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
