const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

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
    const { departure, arrival } = req.query;
    const filter = {};
    if (departure) filter.departure_kor = departure;
    if (arrival) filter.arrival_kor = arrival;
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
