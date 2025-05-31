const mongoose = require('mongoose');

const taxiSchema = new mongoose.Schema({
  taxiNumber: {
    type: String,
    required: [true, '택시 번호를 입력해주세요'],
    unique: true,
    trim: true
  },
  driverName: {
    type: String,
    required: [true, '운전자 이름을 입력해주세요'],
    trim: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  licenseNumber: {
    type: String,
    required: [true, '차량 번호를 입력해주세요'],
    trim: true
  },
  model: {
    type: String,
    required: [true, '차량 모델을 입력해주세요'],
    trim: true
  },
  color: {
    type: String,
    required: [true, '차량 색상을 입력해주세요'],
    trim: true
  },
  year: {
    type: Number,
    required: [true, '연식을 입력해주세요'],
    min: [2000, '2000년 이후 차량만 등록 가능합니다']
  },
  capacity: {
    type: Number,
    required: [true, '승차 정원을 입력해주세요'],
    min: [1, '최소 1명 이상이어야 합니다'],
    max: [8, '최대 8명까지 가능합니다']
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline'
  },
  currentLocation: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      default: [126.9668, 37.5729] // 은평구 기본 좌표
    }
  },
  lastUpdate: {
    type: Date,
    default: Date.now
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalTrips: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 지리공간 인덱스
taxiSchema.index({ currentLocation: '2dsphere' });
taxiSchema.index({ status: 1 });

// 가상 필드
taxiSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'taxi'
});

// 메서드
taxiSchema.methods.updateLocation = function(coordinates) {
  this.currentLocation.coordinates = coordinates;
  this.lastUpdate = Date.now();
  return this.save();
};

taxiSchema.methods.changeStatus = function(status) {
  this.status = status;
  this.lastUpdate = Date.now();
  return this.save();
};

// toJSON 설정
taxiSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Taxi', taxiSchema);