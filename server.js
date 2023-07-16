const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors()); // Enable CORS for all routes

const dbPath = path.join(__dirname, "data.db"); // Path to the SQLite database file

const db = new sqlite3.Database(dbPath);

// Check and update table structure
function checkAndUpdateTableStructure(tableName, tableStructure) {
  const existingTableStructureQuery = `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`;

  return new Promise((resolve, reject) => {
    db.get(existingTableStructureQuery, (err, row) => {
      if (err) {
        console.error(`Error checking if ${tableName} table exists:`, err);
        reject(err);
      } else {
        const existingTableStructure =
          row && row.sql ? row.sql.toLowerCase() : "";
        const newTableStructure = tableStructure.toLowerCase();

        if (existingTableStructure !== newTableStructure) {
          console.log(`Updating ${tableName} table structure...`);
          const dropTableQuery = `DROP TABLE IF EXISTS ${tableName}`;

          db.run(dropTableQuery, (err) => {
            if (err) {
              console.error(`Error dropping ${tableName} table:`, err);
              reject(err);
            } else {
              const createTableQuery = tableStructure;

              db.run(createTableQuery, (err) => {
                if (err) {
                  console.error(`Error creating ${tableName} table:`, err);
                  reject(err);
                } else {
                  console.log(
                    `Updated ${tableName} table structure successfully`
                  );
                  if (tableName === "users") {
                    createDefaultAdminUser().then(resolve).catch(reject);
                  } else {
                    resolve();
                  }
                }
              });
            }
          });
        } else {
          console.log(`${tableName} table structure is up to date`);
          resolve();
        }
      }
    });
  });
}

// Define table structures
const tableStructures = [
  {
    tableName: "users",
    structure: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR,
        password VARCHAR,
        email VARCHAR
      )
    `,
  },
  {
    tableName: "items",
    structure: `
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name VARCHAR,
        quantity INTEGER,
        type VARCHAR
      )
    `,
  },
  {
    tableName: "orders",
    structure: `
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name VARCHAR,
        item_name VARCHAR,
        date_of_order DATE,
        quantity INTEGER,
        date_of_delivery DATE
      )
    `,
  },
  {
    tableName: "complete_order",
    structure: `
      CREATE TABLE IF NOT EXISTS complete_order (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name VARCHAR,
        item_name VARCHAR,
        date_of_order DATE,
        quantity INTEGER,
        date_of_delivery DATE
      )
    `,
  },
];

// Create or update table structures
async function createOrUpdateTableStructures() {
  try {
    for (const { tableName, structure } of tableStructures) {
      await checkAndUpdateTableStructure(tableName, structure);
    }
  } catch (err) {
    console.error("Error creating or updating table structures:", err);
  }
}

// Function to create the default admin user
function createDefaultAdminUser() {
  return new Promise((resolve, reject) => {
    // Add default admin user if it doesn't exist
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
      if (err) {
        console.error("Error checking admin user:", err);
        reject(err);
      } else if (!row) {
        console.log("Creating default admin user...");
        db.run(
          "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
          ["admin", "admin", "admin@example.com"],
          function (err) {
            if (err) {
              console.error("Error creating default admin user:", err);
              reject(err);
            } else {
              console.log("Default admin user created successfully");
              resolve();
            }
          }
        );
      } else {
        console.log("Default admin user already exists");
        resolve();
      }
    });
  });
}

// Middleware for handling errors
function errorHandler(err, req, res, next) {
  console.error("Internal server error:", err);
  res.status(500).json({ message: "Internal server error" });
}




// Remove an order
app.post("/deleteData", (req, res) => {
  const { itemId } = req.body;
  if (itemId) {
    db.run("DELETE FROM orders WHERE id = ?", [itemId], function (err) {
      if (err) {
        console.error("Error during data deletion:", err);
        res.status(500).json({ message: "Internal server error" });
      } else if (this.changes > 0) {
        res.status(200).json({ message: "Data deleted successfully" });
      } else {
        res.status(404).json({ message: "Data not found" });
      }
    });
  } else {
    res.status(400).json({ message: "Invalid item ID" });
  }
});



// Transfer selected order data from orders table to complete_order table
app.post("/transferData", (req, res) => {
  const { itemId } = req.body;

  if (itemId) {
    const transferQuery = `
      INSERT INTO complete_order (customer_name, item_name, date_of_order, quantity, date_of_delivery)
      SELECT customer_name, item_name, date_of_order, quantity, date_of_delivery
      FROM orders
      WHERE id = ?
    `;

    const deleteQuery = `
      DELETE FROM orders
      WHERE id = ?
    `;

    db.serialize(async () => {
      try {
        db.run("BEGIN TRANSACTION");
        await new Promise((resolve, reject) => {
          db.run(transferQuery, [itemId], (transferErr) => {
            if (transferErr) {
              console.error("Error transferring data:", transferErr);
              reject(transferErr);
            } else {
              resolve();
            }
          });
        });
        await new Promise((resolve, reject) => {
          db.run(deleteQuery, [itemId], (deleteErr) => {
            if (deleteErr) {
              console.error("Error deleting data:", deleteErr);
              reject(deleteErr);
            } else {
              resolve();
            }
          });
        });
        db.run("COMMIT");
        res
          .status(200)
          .json({ message: "Data transferred and deleted successfully" });
      } catch (err) {
        console.error("Error during data transfer:", err);
        db.run("ROLLBACK");
        res.status(500).json({ message: "Internal server error" });
      }
    });
  } else {
    res.status(400).json({ message: "Invalid item ID" });
  }
});



// User login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username && password) {
    db.get(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password],
      (err, row) => {
        if (err) {
          console.error("Error during login:", err);
          res.status(500).json({ message: "Internal server error" });
        } else if (row) {
          console.log(`User '${username}' logged in`);
          res.status(200).json({ message: "success" });
        } else {
          res.status(401).json({ message: "Invalid username or password" });
        }
      }
    );
  } else {
    res.status(400).json({ message: "Invalid username or password" });
  }
});

// Retrieve the list of items
app.get("/itemList", (req, res) => {
  db.all("SELECT * FROM items", (err, rows) => {
    if (err) {
      console.error("Error retrieving item list:", err);
      res.status(500).json({ message: "Internal server error" });
    } else {
      res.json(rows);
    }
  });
});




// Update an item's quantity
app.post("/updateItem", (req, res) => {
  const { id, quantity } = req.body;

  if (id && quantity) {
    db.run(
      "UPDATE items SET quantity = ? WHERE id = ?",
      [quantity, id],
      function (err) {
        if (err) {
          console.error("Error during item update:", err);
          res.status(500).json({ message: "Internal server error" });
        } else if (this.changes > 0) {
          res
            .status(200)
            .json({ message: "Item quantity updated successfully" });
        } else {
          res.status(404).json({ message: "Item not found" });
        }
      }
    );
  } else {
    res.status(400).json({ message: "Invalid item ID or quantity" });
  }
});

// Retrieve the list of orders
app.get("/orderList", (req, res) => {
  db.all("SELECT * FROM orders", (err, rows) => {
    if (err) {
      console.error("Error retrieving order list:", err);
      res.status(500).json({ message: "Internal server error" });
    } else {
      res.json(rows);
    }
  });
});



// Add a new order
app.post("/addOrder", (req, res) => {
  const { customer_name, item_name, quantity } = req.body;

  if (customer_name && item_name && quantity) {
    const date_of_order = new Date().toISOString().split("T")[0]; // Get the current date in YYYY-MM-DD format
    const date_of_delivery = ""; // Set the date_of_delivery as empty for now

    db.run(
      "INSERT INTO orders (customer_name, item_name, date_of_order, quantity, date_of_delivery) VALUES (?, ?, ?, ?, ?)",
      [customer_name, item_name, date_of_order, quantity, date_of_delivery],
      function (err) {
        if (err) {
          console.error("Error during order creation:", err);
          res.status(500).json({ message: "Internal server error" });
        } else {
          res.status(200).json({ message: "Order created successfully" });
        }
      }
    );
  } else {
    res.status(400).json({ message: "Invalid order details" });
  }
});



// Add a new order
app.post("/addOrder", (req, res) => {
  const { customerName, chemicalName, dateOfOrder, dateOfDelivery } = req.body;

  if (customerName && chemicalName && dateOfOrder && dateOfDelivery) {
    db.run(
      "INSERT INTO orders (customer_name, chemical_name, date_of_order, date_of_delivery) VALUES (?, ?, ?, ?)",
      [customerName, chemicalName, dateOfOrder, dateOfDelivery],
      function (err) {
        if (err) {
          console.error("Error during order creation:", err);
          res.status(500).json({ message: "Internal server error" });
        } else {
          res.status(200).json({ message: "Order created successfully" });
        }
      }
    );
  } else {
    res.status(400).json({ message: "Invalid order details" });
  }
});



// Start the server
const port = process.env.PORT || 3000;

createOrUpdateTableStructures()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Error initializing the server:", err);
  });

// Error handling middleware
app.use(errorHandler);
