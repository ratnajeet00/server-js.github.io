import sqlite3 from "sqlite3";
import { open } from "sqlite";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end(); // Method Not Allowed
    return;
  }

  const { username, password } = req.body;

  // Connect to the SQLite database
  const db = await open({
    filename: "./database.db",
    driver: sqlite3.Database,
  });

  // Check if the username already exists
  const existingUser = await db.get(
    "SELECT * FROM users WHERE username = ?",
    username
  );

  if (existingUser) {
    res.status(400).json({ message: "Username already exists" });
  } else {
    await db.run(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      username,
      password
    );
    res.status(200).json({ message: "User created successfully" });
  }

  await db.close();
}
