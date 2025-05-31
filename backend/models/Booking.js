const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '고객 정보가 필요합니다']
  },
  taxi: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Taxi',
    default: null
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null
  },
  pickupLocation: {
    type: String,
    required: [true, '픽업 위치를 입력해주세요']
  },
  pickupCoordinates: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  dropoffLocation: {
    type: String,
    required: [true, '하차 위치를 입력해주세요']
  },
  dropoffCoordinates: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  pickupTime: {
    type: Date,
    required: [true, '픽업 시간을 입력해주세요']
  },
  estimatedArrival: {
    type: Date
  },
  actualPickupTime: {
    type: Date
  },
  actualDropoffTime: {
    type: Date
  },
  fare: {
    type: Number,
    required: [true, '요금을 입력해주세요'],
    min: [0, '요금은 0원 이상이어야 합니다']
  },
  distance: {
    type: Number, // km 단위
    default: 0
  },
  duration: {
    type: Number, // 분 단위
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  cancelReason: {
    type: String,
    default: null
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  review: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'app'],
    default: 'cash'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  specialRequests: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// 인덱스
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ taxi: 1, status: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ pickupTime: 1 });
bookingSchema.index({ pickupCoordinates: '2dsphere' });
bookingSchema.index({ dropoffCoordinates: '2dsphere' });

// 미들웨어
bookingSchema.pre('save', function(next) {
  // 예상 도착 시간 계산
  if (this.pickupTime && this.duration && !this.estimatedArrival) {
    this.estimatedArrival = new Date(this.pickupTime.getTime() + this.duration * 60 * 1000);
  }
  
  // 완료 시간 설정
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// 가상 필드
bookingSchema.virtual('isActive').get(function() {
  return ['pending', 'confirmed', 'in-progress'].includes(this.status);
});

// 메서드
bookingSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.cancelReason = reason;
  return this.save();
};

bookingSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.actualDropoffTime = new Date();
  return this.save();
};

bookingSchema.methods.assignTaxi = function(taxiId) {
  this.taxi = taxiId;
  this.status = 'confirmed';
  return this.save();
};

// toJSON 설정
bookingSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Booking', bookingSchema);