const mongoose = require('mongoose');

const taxiItemSchema = new mongoose.Schema({
  region: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  departure_kor: {
    type: String,
    required: true,
    trim: true
  },
  departure_eng: {
    type: String,
    required: true,
    trim: true
  },
  departure_is_airport: {
    type: String,
    enum: ['Y', 'N'],
    required: true
  },
  arrival_kor: {
    type: String,
    required: true,
    trim: true
  },
  arrival_eng: {
    type: String,
    required: true,
    trim: true
  },
  arrival_is_airport: {
    type: String,
    enum: ['Y', 'N'],
    required: true
  },
  reservation_fee: {
    type: Number,
    required: true,
    min: 0
  },
  local_payment_fee: {
    type: Number,
    required: true,
    min: 0
  },
  priority: {
    type: Number,
    default: 99,
    min: 1
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'taxiitems'
});

// 인덱스 설정
taxiItemSchema.index({ region: 1, priority: 1 });
taxiItemSchema.index({ departure_kor: 1, arrival_kor: 1 });
taxiItemSchema.index({ departure_eng: 1, arrival_eng: 1 });
taxiItemSchema.index({ departure_is_airport: 1 });
taxiItemSchema.index({ arrival_is_airport: 1 });

// 가상 필드: 총 요금
taxiItemSchema.virtual('total_fee').get(function() {
  return this.reservation_fee + this.local_payment_fee;
});

// JSON 변환 시 가상 필드 포함
taxiItemSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('TaxiItem', taxiItemSchema);