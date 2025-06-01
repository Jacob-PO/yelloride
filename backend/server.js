const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

console.log('Loaded MONGODB_URI:', process.env.MONGODB_URI);
const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.method === 'POST' && req.path === '/api/bookings') {
    console.log('예약 요청 바디:', JSON.stringify(req.body, null, 2));
  }
  next();
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error', err));

// MongoDB connection event logging
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB 연결 성공");
});
mongoose.connection.on('error', err => {
  console.error('MongoDB 연결 에러:', err);
});

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB 연결 끊김');
});

const taxiItemSchema = new mongoose.Schema({
  region: String,
  departure_kor: String,
  departure_eng: String,
  departure_is_airport: String,
  arrival_kor: String,
  arrival_eng: String,
  arrival_is_airport: String,
  reservation_fee: Number,
  local_payment_fee: Number,
  priority: Number
}, { collection: 'taxi_item' });

const TaxiItem = mongoose.model('TaxiItem', taxiItemSchema);

// 예약 모델
const Booking = require('./models/Booking');

app.get('/api/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();

    res.json({
      status: 'healthy',
      mongodb: {
        connected: mongoose.connection.readyState === 1,
        state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
        host: mongoose.connection.host,
        database: mongoose.connection.name
      },
      server: {
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

// MongoDB connection status check
app.get('/api/db-status', (req, res) => {
  res.json({
    mongoStatus: mongoose.connection.readyState,
    mongoStatusText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
  });
});

// 목록 조회 with pagination
app.get('/api/taxi', async (req, res) => {
  try {
    const { region, departure, arrival, page = 1, limit = 20, sort } = req.query;
    const filter = {};
    if (region) filter.region = region;
    if (departure) filter.departure_kor = departure;
    if (arrival) filter.arrival_kor = arrival;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOption = sort ? { [sort]: 1 } : { priority: 1 };

    const [total, items] = await Promise.all([
      TaxiItem.countDocuments(filter),
      TaxiItem.find(filter).sort(sortOption).skip(skip).limit(Number(limit))
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 간단한 예약 생성 테스트 엔드포인트
app.post('/api/bookings/test', async (req, res) => {
  try {
    const Booking = require('./models/Booking');

    const testData = {
      booking_number: 'TEST' + Date.now(),
      customer_info: {
        name: 'Test User',
        phone: '010-1234-5678'
      },
      service_info: {
        type: 'airport',
        region: 'NY'
      },
      trip_details: {
        departure: {
          location: 'Test Location',
          datetime: new Date()
        }
      },
      vehicles: [{
        type: 'standard',
        passengers: 1,
        luggage: 0
      }],
      pricing: {
        total_amount: 100
      }
    };

    const booking = new Booking(testData);
    await booking.save();

    res.json({
      success: true,
      message: '테스트 예약 생성 성공',
      id: booking._id
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      validation: err.errors
    });
  }
});

// 전체 데이터
app.get('/api/taxi/all', async (req, res) => {
  try {
    const items = await TaxiItem.find().sort({ priority: 1 });
    res.json({ success: true, data: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 경로 검색
app.get('/api/taxi/route', async (req, res) => {
  try {
    const { departure, arrival, lang = 'kor' } = req.query;
    const filter = {};

    if (departure) {
      const depKey = lang === 'eng' ? 'departure_eng' : 'departure_kor';
      filter[depKey] = departure;
    }
    if (arrival) {
      const arrKey = lang === 'eng' ? 'arrival_eng' : 'arrival_kor';
      filter[arrKey] = arrival;
    }

    const item = await TaxiItem.findOne(filter);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 출발지 목록
app.get('/api/taxi/departures', async (req, res) => {
  try {
    const { region } = req.query;
    const match = region ? { region } : {};
    const results = await TaxiItem.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$departure_kor',
          eng: { $first: '$departure_eng' },
          is_airport: { $first: '$departure_is_airport' }
        }
      },
      { $project: { _id: 0, full_kor: '$_id', name_kor: '$_id', name_eng: '$eng', is_airport: '$is_airport' } }
    ]);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 도착지 목록
app.get('/api/taxi/arrivals', async (req, res) => {
  try {
    const { region, departure } = req.query;
    const match = {};
    if (region) match.region = region;
    if (departure) match.departure_kor = departure;
    const results = await TaxiItem.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$arrival_kor',
          eng: { $first: '$arrival_eng' },
          is_airport: { $first: '$arrival_is_airport' }
        }
      },
      { $project: { _id: 0, full_kor: '$_id', name_kor: '$_id', name_eng: '$eng', is_airport: '$is_airport' } }
    ]);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 지역 목록
app.get('/api/taxi/regions', async (req, res) => {
  try {
    const regions = await TaxiItem.aggregate([
      {
        $group: {
          _id: '$region',
          airports: {
            $addToSet: {
              name_kor: '$departure_kor',
              name_eng: '$departure_eng',
              is_airport: '$departure_is_airport'
            }
          },
          places: {
            $addToSet: {
              name_kor: '$arrival_kor',
              name_eng: '$arrival_eng',
              is_airport: '$arrival_is_airport'
            }
          }
        }
      }
    ]);
    res.json({ success: true, data: regions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 간단한 통계
app.get('/api/taxi/stats', async (req, res) => {
  try {
    const regionStats = await TaxiItem.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } }
    ]);
    const total = regionStats.reduce((sum, r) => sum + r.count, 0);
    res.json({ success: true, data: { totalRoutes: total, regions: regionStats } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ----- 예약 API -----

// 예약 생성
app.post('/api/bookings', async (req, res) => {
  console.log('\n========== 예약 생성 시작 ==========');
  console.log('시간:', new Date().toISOString());
  console.log('요청 데이터:', JSON.stringify(req.body, null, 2));

  try {
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ MongoDB 연결 안됨. readyState:', mongoose.connection.readyState);
      return res.status(500).json({
        success: false,
        message: 'Database not connected',
        mongoState: mongoose.connection.readyState
      });
    }

    const data = req.body;

    const requiredFields = [
      'customer_info.name',
      'customer_info.phone',
      'service_info.type',
      'service_info.region',
      'trip_details.departure.location',
      'trip_details.departure.datetime',
      'vehicles',
      'pricing.total_amount'
    ];

    for (const field of requiredFields) {
      const value = field.split('.').reduce((obj, key) => obj?.[key], data);
      if (!value) {
        console.error(`❌ 필수 필드 누락: ${field}`);
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`
        });
      }
    }

    if (!Array.isArray(data.vehicles)) {
      if (typeof data.vehicles === 'string') {
        try {
          data.vehicles = JSON.parse(data.vehicles);
          console.log('✅ vehicles 문자열을 배열로 변환');
        } catch (e) {
          console.error('❌ vehicles 파싱 실패:', e);
          return res.status(400).json({
            success: false,
            message: 'Invalid vehicles format'
          });
        }
      }
    }

    console.log('datetime 변환 전:', data.trip_details?.departure?.datetime);
    if (data.trip_details?.departure?.datetime) {
      data.trip_details.departure.datetime = new Date(data.trip_details.departure.datetime);
      console.log('datetime 변환 후:', data.trip_details.departure.datetime);
    }

    if (!data.booking_number) {
      try {
        const uniquePart = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
        data.booking_number = 'YR' + uniquePart;
        console.log('✅ 예약 번호 생성:', data.booking_number);
      } catch (cryptoErr) {
        console.error('❌ crypto 에러:', cryptoErr);
        data.booking_number = 'YR' + Date.now().toString(36).toUpperCase();
      }
    }

    console.log('Booking 모델 생성 시도...');
    const booking = new Booking(data);
    console.log('✅ Booking 인스턴스 생성 성공');

    console.log('MongoDB 저장 시도...');
    const savedBooking = await booking.save();
    console.log('✅ 예약 저장 성공:', savedBooking._id);

    res.json({
      success: true,
      data: savedBooking,
      booking_number: savedBooking.booking_number
    });

  } catch (err) {
    console.error('\n❌❌❌ 예약 생성 실패 ❌❌❌');
    console.error('에러 타입:', err.name);
    console.error('에러 메시지:', err.message);
    console.error('에러 스택:', err.stack);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors || {}).map(e => ({
        field: e.path,
        message: e.message,
        value: e.value
      }));
      console.error('검증 실패 상세:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
        details: err.message
      });
    }

    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
      errorType: err.name,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// 예약 조회 (ID)
app.get('/api/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 예약 조회 (예약 번호)
app.get('/api/bookings/number/:bookingNumber', async (req, res) => {
  try {
    const booking = await Booking.findOne({ booking_number: req.params.bookingNumber });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 예약 수정
app.patch('/api/bookings/:id', async (req, res) => {
  try {
    const updateData = req.body;
    if (typeof updateData.vehicles === 'string') {
      try {
        updateData.vehicles = JSON.parse(updateData.vehicles);
      } catch (e) {
        console.error('Invalid vehicles JSON string:', updateData.vehicles);
      }
    }
    const booking = await Booking.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 예약 취소
app.post('/api/bookings/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled', cancel_reason: req.body.reason || '' },
      { new: true }
    );
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const PORT = process.env.PORT || 5001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
