const express = require("express");
const bodyParser = require("body-parser");
const Adodb = require("node-adodb");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const dbPath = path.join(__dirname, "data.accdb"); // Path to the Access database file

const connection = Adodb.open(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${dbPath};`);

// Function to check and update table structure
function checkAndUpdateTableStructure(tableName, tableStructure) {
  const existingTableStructureQuery = `SELECT TOP 1 * FROM ${tableName}`;

  connection
    .query(existingTableStructureQuery)
    .then(() => {
      console.log(`${tableName} table exists.`);
      // Table structure is up to date or cannot be modified in Access.
      // Add your logic here if needed.
    })
    .catch(() => {
      console.log(`Creating ${tableName} table...`);
      const createTableQuery = tableStructure;

      connection
        .execute(createTableQuery)
        .then(() => {
          console.log(`Created ${tableName} table successfully`);
          createDefaultAdminUser(); // Call the function to create the default admin user
        })
        .catch((error) => {
          console.error(`Error creating ${tableName} table:`, error);
        });
    });
}

checkAndUpdateTableStructure(
  "users",
  `
  CREATE TABLE IF NOT EXISTS users (
    id AUTOINCREMENT PRIMARY KEY,
    username TEXT,
    password TEXT,
    email TEXT
  )
`
);

checkAndUpdateTableStructure(
  "items",
  `
  CREATE TABLE IF NOT EXISTS items (
    id AUTOINCREMENT PRIMARY KEY,
    item_name TEXT,
    quantity INTEGER,
    date_of_expiry DATE,
    date_of_manufacture DATE,
    type TEXT
  )
`
);

checkAndUpdateTableStructure(
  "orders",
  `
  CREATE TABLE IF NOT EXISTS orders (
    id AUTOINCREMENT PRIMARY KEY,
    customer_name TEXT,
    item_name TEXT,
    date_of_order DATE,
    quantity INTEGER,
    date_of_delivery DATE
  )
`
);

// Function to create the default admin user
function createDefaultAdminUser() {
  // Add default admin user if it doesn't exist
  connection
    .query("SELECT * FROM users WHERE username = 'admin'")
    .then((row) => {
      if (!row || row.length === 0) {
        console.log("Creating default admin user...");
        connection
          .execute(
            "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
            ["admin", "admin", "admin@example.com"]
          )
          .then(() => {
            console.log("Default admin user created successfully");
          })
          .catch((error) => {
            console.error("Error creating default admin user:", error);
          });
      } else {
        console.log("Default admin user already exists");
      }
    })
    .catch((error) => {
      console.error("Error checking admin user:", error);
    });
}

// Rest of the code...

// Add a new user
app.post("/addUser", (req, res) => {
  const { username, password, email } = req.body;

  if (username && password && email) {
    connection
      .execute(
        "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
        [username, password, email]
      )
      .then(() => {
        res.status(200).json({ message: "User created successfully" });
      })
      .catch((error) => {
        console.error("Error during user creation:", error);
        res.status(500).json({ message: "Internal server error" });
      });
  } else {
    res.status(400).json({ message: "Invalid username, password, or email" });
  }
});

// View orders
app.get("/viewOrders", (req, res) => {
  connection
    .query("SELECT * FROM orders")
    .then((rows) => {
      res.status(200).json(rows);
    })
    .catch((error) => {
      console.error("Error retrieving orders:", error);
      res.status(500).json({ message: "Internal server error" });
    });
});

// Add a new order
app.post("/addOrder", (req, res) => {
  const { customer_name, item_name, date_of_order, quantity, date_of_delivery } = req.body;

  if (customer_name && item_name && date_of_order && quantity && date_of_delivery) {
    connection
      .execute(
        "INSERT INTO orders (customer_name, item_name, date_of_order, quantity, date_of_delivery) VALUES (?, ?, ?, ?, ?)",
        [customer_name, item_name, date_of_order, quantity, date_of_delivery]
      )
      .then(() => {
        res.status(200).json({ message: "Order created successfully" });
      })
      .catch((error) => {
        console.error("Error during order creation:", error);
        res.status(500).json({ message: "Internal server error" });
      });
  } else {
    res.status(400).json({ message: "Invalid order details" });
  }
});

// User login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username && password) {
    connection
      .query("SELECT * FROM users WHERE username = ? AND password = ?", [
        username,
        password,
      ])
      .then((row) => {
        if (row && row.length > 0) {
          console.log(`User '${username}' logged in`);
          res.status(200).json({ message: "success" });
        } else {
          res.status(401).json({ message: "Invalid username or password" });
        }
      })
      .catch((error) => {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
      });
  } else {
    res.status(400).json({ message: "Invalid username or password" });
  }
});

// Retrieve the list of users
app.get("/userList", (req, res) => {
  connection
    .query("SELECT * FROM users")
    .then((rows) => {
      res.status(200).json(rows);
    })
    .catch((error) => {
      console.error("Error retrieving user list:", error);
      res.status(500).json({ message: "Internal server error" });
    });
});

// Remove a user
app.post("/removeUser", (req, res) => {
  const { username } = req.body;

  connection
    .execute("DELETE FROM users WHERE username = ?", [username])
    .then(({ affectedRows }) => {
      if (affectedRows > 0) {
        res.status(200).json({ message: "User removed successfully" });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    })
    .catch((error) => {
      console.error("Error during user removal:", error);
      res.status(500).json({ message: "Internal server error" });
    });
});

// Add a new item
app.post("/addItem", (req, res) => {
  const { item_name, quantity, date_of_expiry, date_of_manufacture, type } = req.body;

  if (item_name && quantity && date_of_expiry && date_of_manufacture && type) {
    connection
      .execute(
        "INSERT INTO items (item_name, quantity, date_of_expiry, date_of_manufacture, type) VALUES (?, ?, ?, ?, ?)",
        [item_name, quantity, date_of_expiry, date_of_manufacture, type]
      )
      .then(() => {
        res.status(200).json({ message: "Item created successfully" });
      })
      .catch((error) => {
        console.error("Error during item creation:", error);
        res.status(500).json({ message: "Internal server error" });
      });
  } else {
    res.status(400).json({ message: "Invalid item details" });
  }
});

// Retrieve the list of items
app.get("/itemList", (req, res) => {
  connection
    .query("SELECT * FROM items")
    .then((rows) => {
      res.status(200).json(rows);
    })
    .catch((error) => {
      console.error("Error retrieving item list:", error);
      res.status(500).json({ message: "Internal server error" });
    });
});

// Remove an item
app.post("/removeItem", (req, res) => {
  const { id } = req.body;

  connection
    .execute("DELETE FROM items WHERE id = ?", [id])
    .then(({ affectedRows }) => {
      if (affectedRows > 0) {
        res.status(200).json({ message: "Item removed successfully" });
      } else {
        res.status(404).json({ message: "Item not found" });
      }
    })
    .catch((error) => {
      console.error("Error during item removal:", error);
      res.status(500).json({ message: "Internal server error" });
    });
});

// Update an item
app.post("/updateItem", (req, res) => {
  const { id, item_name, quantity, date_of_expiry, date_of_manufacture, type } = req.body;

  if (id && item_name && quantity && date_of_expiry && date_of_manufacture && type) {
    connection
      .execute(
        "UPDATE items SET item_name = ?, quantity = ?, date_of_expiry = ?, date_of_manufacture = ?, type = ? WHERE id = ?",
        [item_name, quantity, date_of_expiry, date_of_manufacture, type, id]
      )
      .then(({ affectedRows }) => {
        if (affectedRows > 0) {
          res.status(200).json({ message: "Item updated successfully" });
        } else {
          res.status(404).json({ message: "Item not found" });
        }
      })
      .catch((error) => {
        console.error("Error during item update:", error);
        res.status(500).json({ message: "Internal server error" });
      });
  } else {
    res.status(400).json({ message: "Invalid item ID, name, or quantity" });
  }
});

// Add a new order
app.post("/addOrder", (req, res) => {
  const { customer_name, item_name, date_of_order, quantity, date_of_delivery } = req.body;

  if (customer_name && item_name && date_of_order && quantity && date_of_delivery) {
    connection
      .execute(
        "INSERT INTO orders (customer_name, item_name, date_of_order, quantity, date_of_delivery) VALUES (?, ?, ?, ?, ?)",
        [customer_name, item_name, date_of_order, quantity, date_of_delivery]
      )
      .then(() => {
        res.status(200).json({ message: "Order created successfully" });
      })
      .catch((error) => {
        console.error("Error during order creation:", error);
        res.status(500).json({ message: "Internal server error" });
      });
  } else {
    res.status(400).json({ message: "Invalid order details" });
  }
});

// Retrieve the list of orders
app.get("/orderList", (req, res) => {
  connection
    .query("SELECT * FROM orders")
    .then((rows) => {
      res.status(200).json(rows);
    })
    .catch((error) => {
      console.error("Error retrieving order list:", error);
      res.status(500).json({ message: "Internal server error" });
    });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
