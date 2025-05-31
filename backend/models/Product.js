const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  taxiItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaxiItem',
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    default: '',
  },
  is_active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  collection: 'products',
});

module.exports = mongoose.model('Product', productSchema);
