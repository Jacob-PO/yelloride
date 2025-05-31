const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const TaxiItem = require('../models/TaxiItem');

// 전체 상품 조회
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ is_active: true }).populate('taxiItem');
    res.json({ success: true, data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '상품 조회 오류' });
  }
});

// 상품 생성
router.post('/', async (req, res) => {
  try {
    const { name, taxiItemId, price, description } = req.body;
    const taxiItem = await TaxiItem.findById(taxiItemId);
    if (!taxiItem) {
      return res.status(404).json({ success: false, message: '노선을 찾을 수 없습니다.' });
    }
    const product = await Product.create({ name, taxiItem: taxiItemId, price, description });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '상품 생성 오류' });
  }
});

module.exports = router;
