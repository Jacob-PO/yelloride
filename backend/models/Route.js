const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '노선 이름을 입력해주세요'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startPoint: {
    name: {
      type: String,
      required: [true, '출발지를 입력해주세요']
    },
    coordinates: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        required: true
      }
    }
  },
  endPoint: {
    name: {
      type: String,
      required: [true, '도착지를 입력해주세요']
    },
    coordinates: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        required: true
      }
    }
  },
  waypoints: [{
    name: String,
    coordinates: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        required: true
      }
    }
  }],
  estimatedTime: {
    type: Number, // 분 단위
    required: true
  },
  estimatedDistance: {
    type: Number, // km 단위
    required: true
  },
  baseFare: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 지리공간 인덱스
routeSchema.index({ 'startPoint.coordinates': '2dsphere' });
routeSchema.index({ 'endPoint.coordinates': '2dsphere' });

module.exports = mongoose.model('Route', routeSchema);