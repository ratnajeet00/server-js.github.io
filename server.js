const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const dataFilePath = './user-data.json';

// Check if the user data file exists, if not, create it with default admin credentials
if (!fs.existsSync(dataFilePath)) {
  const defaultUser = { username: 'admin', password: 'admin' };
  const defaultUserList = [defaultUser];
  fs.writeFileSync(dataFilePath, JSON.stringify(defaultUserList));
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Read the user data from the file
  const data = fs.readFileSync(dataFilePath, 'utf8');
  const userList = JSON.parse(data);

  const user = userList.find(user => user.username === username && user.password === password);

  if (user) {
    // Successful login
    res.status(200).json({ message: 'Login successful' });
  } else {
    // Invalid credentials
    res.status(401).json({ message: 'Invalid username or password' });
  }
});

app.post('/addUser', (req, res) => {
  const { username, password } = req.body;

  if (username && password) {
    // Read the user data from the file
    const data = fs.readFileSync(dataFilePath, 'utf8');
    const userList = JSON.parse(data);

    // Check if the username already exists
    const existingUser = userList.find(user => user.username === username);
    if (existingUser) {
      res.status(400).json({ message: 'Username already exists' });
    } else {
      // Add the new user to the user list
      userList.push({ username, password });

      // Save the updated user list to the file
      fs.writeFileSync(dataFilePath, JSON.stringify(userList));

      res.status(200).json({ message: 'User created successfully' });
    }
  } else {
    // Invalid data
    res.status(400).json({ message: 'Invalid username or password' });
  }
});

app.get('/userList', (req, res) => {
  // Read the user data from the file
  const data = fs.readFileSync(dataFilePath, 'utf8');
  const userList = JSON.parse(data);

  res.json(userList);
});

const PORT = 3000;

const server = app.listen(PORT, () => {
  const host = server.address().address;
  const port = server.address().port;
  console.log(`Server is running on http://${host}:${port}`);
});
