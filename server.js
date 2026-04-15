// server.js
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = 5000;

// ===== Middlewares =====
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// ===== MySQL Connection =====
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Admin@00",
  database: "data_dashboard"
});

db.connect(err => {
  if (err) return console.error("❌ DB connection error:", err);
  console.log(`✅ Connected to DB: ${db.config.database}`);
});

// ===== API Routes =====

// ---- Products ----
// Get all products
app.get("/api/products", (req, res) => {
  const sql = "SELECT * FROM products";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(result);
  });
});

// Add new product
app.post("/api/products", (req, res) => {
  const { name, price, cost } = req.body;

  if (!name || !price || !cost) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const sql = "INSERT INTO products (name, price, cost) VALUES (?, ?, ?)";

  db.query(sql, [name, price, cost], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.sqlMessage });
    }

    return res.status(200).json({
      success: true,
      message: "Product added!",
      id: result.insertId
    });
  });
});

// جلب أعلى المنتجات مبيعًا مع فلتر بالشهر
app.get("/api/top_products", (req, res) => {
  const { month } = req.query; // Jan, Feb, ... أو undefined

  const sql = `
    SELECT p.id, p.name, 
           IFNULL(SUM(s.quantity), 0) AS total_sold, 
           IFNULL(SUM(s.quantity * (p.price - p.cost)), 0) AS total_profit
    FROM products p
    LEFT JOIN sales s 
      ON s.product_id = p.id 
      AND (? IS NULL OR DATE_FORMAT(s.sale_date,'%b') = ?)
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT 5
  `;

  const params = [month || null, month || null];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
    res.json(result);
  });
});



// Delete product
app.delete("/api/products/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM products WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json({ message: "Product deleted!" });
  });
});

// ---- Sales ----
// Add sale
app.post("/api/sales", (req, res) => {
  const { product_id, quantity, sale_date } = req.body;
  if (!product_id || !quantity || !sale_date) return res.status(400).json({ error: "Missing fields" });

  const sql = "INSERT INTO sales (product_id, quantity, sale_date) VALUES (?, ?, ?)";
  db.query(sql, [product_id, quantity, sale_date], (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json({ message: "Sale added!", id: result.insertId });
  });
});

// ---- Dashboard ----
// Total Sales
app.get("/api/total_sales", (req, res) => {
  const sql = "SELECT SUM(p.price * s.quantity) AS total_sales FROM sales s JOIN products p ON s.product_id = p.id";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json({ total_sales: result[0]?.total_sales || 0 });
  });
});

// Total Profit
app.get("/api/total_profit", (req, res) => {
  const sql = "SELECT SUM((p.price - p.cost) * s.quantity) AS total_profit FROM sales s JOIN products p ON s.product_id = p.id";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json({ total_profit: result[0]?.total_profit || 0 });
  });
});

// Total Customers
app.get("/api/customers_count", (req, res) => {
  const sql = "SELECT COUNT(*) AS total_customers FROM users";
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json({ total_customers: result[0]?.total_customers || 0 });
  });
});

// Monthly Sales / Profit
app.get("/api/monthly_sales", (req, res) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const sql = `
    SELECT m.month,
           IFNULL(SUM(s.quantity * p.price),0) AS sales,
           IFNULL(SUM((p.price - p.cost) * s.quantity),0) AS profit,
           IFNULL(COUNT(DISTINCT s.id),0) AS customers
    FROM (SELECT 'Jan' AS month UNION ALL SELECT 'Feb' UNION ALL SELECT 'Mar' UNION ALL
          SELECT 'Apr' UNION ALL SELECT 'May' UNION ALL SELECT 'Jun' UNION ALL SELECT 'Jul' UNION ALL
          SELECT 'Aug' UNION ALL SELECT 'Sep' UNION ALL SELECT 'Oct' UNION ALL SELECT 'Nov' UNION ALL SELECT 'Dec') AS m
    LEFT JOIN sales s ON DATE_FORMAT(s.sale_date,'%b') = m.month
    LEFT JOIN products p ON s.product_id = p.id
    GROUP BY m.month
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ error: err.sqlMessage });
    res.json(result);
  });
});

// Test Route
app.get("/", (req, res) => res.send("Server is running!"));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running"));