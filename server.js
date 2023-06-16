const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
    if (row) {
      res.status(200).json({ message: 'Login successful' });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  });
});

app.post('/addUser', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', username, (err, row) => {
    if (row) {
      res.status(400).json({ message: 'Username already exists' });
    } else {
      const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
      stmt.run(username, password);
      stmt.finalize();

      res.status(200).json({ message: 'User created successfully' });
    }
  });
});

app.get('/userList', (req, res) => {
  db.all('SELECT * FROM users', (err, rows) => {
    res.json(rows);
  });
});

const PORT = 3000;

const server = app.listen(PORT, () => {
  const host = server.address().address;
  const port = server.address().port;
  console.log(`Server is running on http://${host}:${port}`);
});
