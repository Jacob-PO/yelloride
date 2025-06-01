const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
require('dotenv').config();

console.log('Loaded MONGODB_URI:', process.env.MONGODB_URI);
const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.path.includes('booking')) {
    console.log('Query:', req.query);
    console.log('Params:', req.params);
    if (req.method === 'POST') {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
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

// 엑셀 또는 JSON 파일 업로드
app.post('/api/taxi/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file && !req.body.data) {
      return res.status(400).json({ success: false, message: '파일이 업로드되지 않았습니다' });
    }

    let items = [];

    if (req.file) {
      if (req.file.mimetype === 'application/json') {
        items = JSON.parse(req.file.buffer.toString());
      } else {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
        if (rows.length === 0) {
          return res.status(400).json({ success: false, message: '엑셀 파일이 비어 있습니다' });
        }
        items = rows.map(r => ({
          region: r.region || r['지역'] || '',
          departure_kor: r.departure_kor || r['departure_kor'] || r['출발지'] || '',
          departure_eng: r.departure_eng || r['departure_eng'] || '',
          departure_is_airport: r.departure_is_airport || r['departure_is_airport'] || r['출발지공항'] || '',
          arrival_kor: r.arrival_kor || r['arrival_kor'] || r['도착지'] || '',
          arrival_eng: r.arrival_eng || r['arrival_eng'] || '',
          arrival_is_airport: r.arrival_is_airport || r['arrival_is_airport'] || r['도착지공항'] || '',
          reservation_fee: Number(r.reservation_fee || r['reservation_fee'] || r['예약료'] || 0),
          local_payment_fee: Number(r.local_payment_fee || r['local_payment_fee'] || r['현지료'] || 0),
          priority: Number(r.priority || r['priority'] || 99)
        }));
      }
    } else {
      items = Array.isArray(req.body.data) ? req.body.data : JSON.parse(req.body.data);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '데이터가 비어 있습니다' });
    }

    await TaxiItem.insertMany(items, { ordered: false });

    res.json({ success: true, inserted: items.length });
  } catch (err) {
    console.error('업로드 오류:', err);
    res.status(500).json({ success: false, message: '업로드 실패', error: err.message });
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

// 예약 조회 (검색)
// GET /api/bookings/search?booking_number=XXXXXX
app.get('/api/bookings/search', async (req, res) => {
  console.log('=== 예약 검색 API 호출 ===');
  console.log('검색 번호:', req.query.booking_number);

  try {
    const { booking_number } = req.query;

    if (!booking_number) {
      return res.status(400).json({
        success: false,
        message: '예약번호를 입력해주세요'
      });
    }

    const booking = await Booking.findOne({
      booking_number: booking_number.toUpperCase().trim()
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: '예약을 찾을 수 없습니다'
      });
    }

    // 전체 예약 정보 반환
    res.json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('예약 검색 에러:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    if (typeof updateData.service_info === 'string') {
      try {
        updateData.service_info = JSON.parse(updateData.service_info);
      } catch (e) {
        console.error('Invalid service_info JSON string:', updateData.service_info);
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

// 예약 목록 조회
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 예약 생성
app.post('/api/bookings', async (req, res) => {
  try {
    console.log('예약 요청 받음:', new Date().toISOString());

    const data = req.body;

    if (typeof data.vehicles === 'string') {
      try {
        data.vehicles = JSON.parse(data.vehicles);
      } catch (e) {
        console.error('Invalid vehicles JSON string:', data.vehicles);
      }
    }

    if (typeof data.service_info === 'string') {
      try {
        data.service_info = JSON.parse(data.service_info);
      } catch (e) {
        console.error('Invalid service_info JSON string:', data.service_info);
      }
    }

    if (!data.booking_number) {
      try {
        data.booking_number = 'YR' + crypto.randomUUID().slice(0, 6).toUpperCase();
      } catch (e) {
        data.booking_number = 'YR' + Date.now().toString(36).toUpperCase().slice(-6);
      }
    }

    if (data.trip_details?.departure?.datetime) {
      data.trip_details.departure.datetime = new Date(data.trip_details.departure.datetime);
    }

    const booking = new Booking(data);
    await booking.save();

    res.json({ success: true, data: booking });

  } catch (err) {
    console.error('❌ 예약 생성 에러:', err);
    console.error('에러 스택:', err.stack);

    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? {
        name: err.name,
        message: err.message,
        stack: err.stack
      } : undefined
    });
  }
});

const PORT = process.env.PORT || 5001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ 서버가 포트 ${PORT}에서 실행 중입니다`);
    console.log(`✅ MongoDB URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride'}`);
    console.log(`✅ 환경: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
