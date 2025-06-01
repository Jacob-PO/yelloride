const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  origin: String,
  destination: String,
});

const Product = mongoose.model('Product', productSchema);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json({ success: true, data: products });
});

app.post('/api/products', async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, data: product });
});

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
