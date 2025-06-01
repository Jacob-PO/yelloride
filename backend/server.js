const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

console.log('Loaded MONGODB_URI:', process.env.MONGODB_URI);
const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error', err));

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

// 예약 스키마 및 모델
const bookingSchema = new mongoose.Schema({
  booking_number: { type: String, unique: true },
  customer_info: {
    name: String,
    phone: String,
    kakao_id: String
  },
  service_info: {
    type: String,
    region: String
  },
  trip_details: {
    departure: {
      location: String,
      datetime: Date
    },
    arrival: {
      location: String
    }
  },
  vehicles: [
    {
      type: String,
      passengers: Number,
      luggage: Number
    }
  ],
  passenger_info: {
    total_passengers: Number,
    total_luggage: Number
  },
  flight_info: {
    flight_number: String,
    terminal: String
  },
  pricing: {
    reservation_fee: Number,
    service_fee: Number,
    vehicle_upgrade_fee: Number,
    total_amount: Number
  },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'bookings' });

const Booking = mongoose.model('Booking', bookingSchema);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
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
  try {
    const data = req.body;
    // 기본 예약 번호 생성
    if (!data.booking_number) {
      // 생성 시 중복 가능성을 줄이기 위해 UUID 기반 번호 사용
      const uniquePart = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
      data.booking_number = 'YR' + uniquePart;
    }
    const booking = new Booking(data);
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate booking number' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
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
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
