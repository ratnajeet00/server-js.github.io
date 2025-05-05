const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg"); // Replace sqlite3 with pg
const path = require("path");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors()); // Enable CORS for all routes

// PostgreSQL connection configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'myapp',
  password: 'Kashiba@00',
  port: 5432,
});

// Check and update table structure
async function checkAndUpdateTableStructure(tableName, tableStructure) {
  try {
    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `;
    const tableExists = await pool.query(tableExistsQuery, [tableName]);
    
    if (!tableExists.rows[0].exists) {
      console.log(`Creating ${tableName} table...`);
      await pool.query(tableStructure);
      console.log(`Created ${tableName} table successfully`);
      
      if (tableName === "users") {
        await createDefaultAdminUser();
      }
    } else {
      console.log(`${tableName} table already exists`);
      // In PostgreSQL, we'd typically use ALTER TABLE statements to modify tables
      // For simplicity in migration, we'll recreate the table if needed
      await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      await pool.query(tableStructure);
      console.log(`Updated ${tableName} table structure successfully`);
      
      if (tableName === "users") {
        await createDefaultAdminUser();
      }
    }
  } catch (err) {
    console.error(`Error managing ${tableName} table:`, err);
    throw err;
  }
}

// Define table structures
const tableStructures = [
  {
    tableName: "users",
    structure: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255),
        password VARCHAR(255),
        email VARCHAR(255)
      )
    `,
  },
  {
    tableName: "items",
    structure: `
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(255),
        quantity INTEGER,
        type VARCHAR(255)
      )
    `,
  },
  {
    tableName: "orders",
    structure: `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255),
        item_name VARCHAR(255),
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
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255),
        item_name VARCHAR(255),
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
async function createDefaultAdminUser() {
  try {
    // Check if admin exists
    const adminCheck = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      ["admin"]
    );
    
    if (adminCheck.rows.length === 0) {
      console.log("Creating default admin user...");
      await pool.query(
        "INSERT INTO users (username, password, email) VALUES ($1, $2, $3)",
        ["admin", "admin", "admin@example.com"]
      );
      console.log("Default admin user created successfully");
    } else {
      console.log("Default admin user already exists");
    }
  } catch (err) {
    console.error("Error creating default admin user:", err);
    throw err;
  }
}

// Middleware for handling errors
function errorHandler(err, req, res, next) {
  console.error("Internal server error:", err);
  res.status(500).json({ message: "Internal server error" });
}

// Remove an order
app.post("/deleteData", async (req, res) => {
  const { itemId } = req.body;
  if (itemId) {
    try {
      const result = await pool.query("DELETE FROM orders WHERE id = $1", [itemId]);
      if (result.rowCount > 0) {
        res.status(200).json({ message: "Data deleted successfully" });
      } else {
        res.status(404).json({ message: "Data not found" });
      }
    } catch (err) {
      console.error("Error during data deletion:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(400).json({ message: "Invalid item ID" });
  }
});

// Transfer selected order data from orders table to complete_order table
app.post("/transferData", async (req, res) => {
  const { itemId } = req.body;

  if (itemId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const transferQuery = `
        INSERT INTO complete_order (customer_name, item_name, date_of_order, quantity, date_of_delivery)
        SELECT customer_name, item_name, date_of_order, quantity, date_of_delivery
        FROM orders
        WHERE id = $1
      `;
      await client.query(transferQuery, [itemId]);
      
      const deleteQuery = "DELETE FROM orders WHERE id = $1";
      await client.query(deleteQuery, [itemId]);
      
      await client.query('COMMIT');
      res.status(200).json({ message: "Data transferred and deleted successfully" });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("Error during data transfer:", err);
      res.status(500).json({ message: "Internal server error" });
    } finally {
      client.release();
    }
  } else {
    res.status(400).json({ message: "Invalid item ID" });
  }
});

// User login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (username && password) {
    try {
      const result = await pool.query(
        "SELECT * FROM users WHERE username = $1 AND password = $2",
        [username, password]
      );
      
      if (result.rows.length > 0) {
        console.log(`User '${username}' logged in`);
        res.status(200).json({ message: "success" });
      } else {
        res.status(401).json({ message: "Invalid username or password" });
      }
    } catch (err) {
      console.error("Error during login:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(400).json({ message: "Invalid username or password" });
  }
});

// Retrieve the list of items
app.get("/itemList", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM items");
    res.json(result.rows);
  } catch (err) {
    console.error("Error retrieving item list:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update an item's quantity
app.post("/updateItem", async (req, res) => {
  const { id, quantity } = req.body;

  if (id && quantity) {
    try {
      const result = await pool.query(
        "UPDATE items SET quantity = $1 WHERE id = $2",
        [quantity, id]
      );
      
      if (result.rowCount > 0) {
        res.status(200).json({ message: "Item quantity updated successfully" });
      } else {
        res.status(404).json({ message: "Item not found" });
      }
    } catch (err) {
      console.error("Error during item update:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(400).json({ message: "Invalid item ID or quantity" });
  }
});

// Retrieve the list of orders
app.get("/orderList", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM orders");
    res.json(result.rows);
  } catch (err) {
    console.error("Error retrieving order list:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add a new order
app.post("/addOrder", async (req, res) => {
  const { customer_name, item_name, quantity } = req.body;

  if (customer_name && item_name && quantity) {
    const date_of_order = new Date().toISOString().split("T")[0]; // Get the current date in YYYY-MM-DD format
    const date_of_delivery = ""; // Set the date_of_delivery as empty for now

    try {
      await pool.query(
        "INSERT INTO orders (customer_name, item_name, date_of_order, quantity, date_of_delivery) VALUES ($1, $2, $3, $4, $5)",
        [customer_name, item_name, date_of_order, quantity, date_of_delivery]
      );
      res.status(200).json({ message: "Order created successfully" });
    } catch (err) {
      console.error("Error during order creation:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  } else {
    res.status(400).json({ message: "Invalid order details" });
  }
});

// Add a new order (duplicate route with different parameters)
app.post("/addOrder", async (req, res) => {
  const { customerName, chemicalName, dateOfOrder, dateOfDelivery } = req.body;

  if (customerName && chemicalName && dateOfOrder && dateOfDelivery) {
    try {
      await pool.query(
        "INSERT INTO orders (customer_name, chemical_name, date_of_order, date_of_delivery) VALUES ($1, $2, $3, $4)",
        [customerName, chemicalName, dateOfOrder, dateOfDelivery]
      );
      res.status(200).json({ message: "Order created successfully" });
    } catch (err) {
      console.error("Error during order creation:", err);
      res.status(500).json({ message: "Internal server error" });
    }
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
