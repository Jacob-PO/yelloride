const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const dataPath = path.join(__dirname, 'data', 'products.json');

function loadProducts() {
  try {
    const json = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function saveProducts(products) {
  fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('/api/products', (req, res) => {
  const products = loadProducts();
  res.json({ success: true, data: products });
});

app.post('/api/products', (req, res) => {
  const products = loadProducts();
  const product = { id: Date.now(), ...req.body };
  products.push(product);
  saveProducts(products);
  res.status(201).json({ success: true, data: product });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
