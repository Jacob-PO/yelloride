const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const TaxiItem = require('../models/TaxiItem');

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Excel 파일만 업로드 가능합니다.'));
    }
    cb(null, true);
  }
});

// 엑셀 파일 업로드 및 데이터 임포트
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '엑셀 파일이 필요합니다.'
      });
    }

    const xlsx = require('xlsx');
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // 기존 데이터 삭제 옵션
    if (req.body.clearExisting === 'true') {
      await TaxiItem.deleteMany({});
    }

    // 데이터 임포트
    const taxiItems = data.map(row => ({
      region: row.region || row.지역,
      departure_kor: row.departure_kor || row.출발지_한글,
      departure_eng: row.departure_eng || row.출발지_영문,
      departure_is_airport: row.departure_is_airport || row.출발지_공항여부 || 'N',
      arrival_kor: row.arrival_kor || row.도착지_한글,
      arrival_eng: row.arrival_eng || row.도착지_영문,
      arrival_is_airport: row.arrival_is_airport || row.도착지_공항여부 || 'N',
      reservation_fee: Number(row.reservation_fee || row.예약료 || 0),
      local_payment_fee: Number(row.local_payment_fee || row.현지지불료 || 0),
      priority: Number(row.priority || row.우선순위 || 99),
      is_active: true
    }));

    const result = await TaxiItem.insertMany(taxiItems);

    // 업로드된 파일 삭제
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `${result.length}개의 택시 노선이 등록되었습니다.`,
      count: result.length
    });
  } catch (error) {
    console.error('업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: '파일 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 택시 노선 목록 조회
router.get('/', async (req, res) => {
  try {
    const {
      region,
      departure_is_airport,
      arrival_is_airport,
      search,
      page = 1,
      limit = 50,
      sort = 'priority'
    } = req.query;

    // 필터 조건 구성
    const filter = { is_active: true };
    
    if (region) {
      filter.region = region.toUpperCase();
    }
    
    if (departure_is_airport) {
      filter.departure_is_airport = departure_is_airport;
    }
    
    if (arrival_is_airport) {
      filter.arrival_is_airport = arrival_is_airport;
    }
    
    if (search) {
      filter.$or = [
        { departure_kor: { $regex: search, $options: 'i' } },
        { departure_eng: { $regex: search, $options: 'i' } },
        { arrival_kor: { $regex: search, $options: 'i' } },
        { arrival_eng: { $regex: search, $options: 'i' } }
      ];
    }

    // 정렬 옵션
    let sortOption = {};
    switch (sort) {
      case 'priority':
        sortOption = { priority: 1, region: 1 };
        break;
      case 'fee':
        sortOption = { reservation_fee: 1 };
        break;
      case 'region':
        sortOption = { region: 1, priority: 1 };
        break;
      default:
        sortOption = { priority: 1 };
    }

    // 페이지네이션
    const skip = (page - 1) * Math.min(limit, 100);
    const limitNum = Math.min(limit, 100);

    const [items, total] = await Promise.all([
      TaxiItem.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum),
      TaxiItem.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: Number(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 특정 노선 검색
router.get('/route', async (req, res) => {
  try {
    const { departure, arrival, lang = 'kor' } = req.query;

    if (!departure || !arrival) {
      return res.status(400).json({
        success: false,
        message: '출발지와 도착지를 모두 입력해주세요.'
      });
    }

    const searchField = lang === 'eng' ? 
      { departure_eng: departure, arrival_eng: arrival } :
      { departure_kor: departure, arrival_kor: arrival };

    // 부분 일치 검색
    const filter = {
      is_active: true,
      $or: [
        searchField,
        {
          departure_kor: { $regex: departure, $options: 'i' },
          arrival_kor: { $regex: arrival, $options: 'i' }
        },
        {
          departure_eng: { $regex: departure, $options: 'i' },
          arrival_eng: { $regex: arrival, $options: 'i' }
        }
      ]
    };

    const routes = await TaxiItem.find(filter).sort({ priority: 1 });

    res.json({
      success: true,
      data: routes
    });
  } catch (error) {
    console.error('경로 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '경로 검색 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 지역 내 사용 가능한 출발지 목록 조회
router.get('/departures', async (req, res) => {
  try {
    const { region, lang = 'kor' } = req.query;

    const filter = { is_active: true };

    if (region && region !== 'undefined') {
      filter.region = region.toUpperCase();
    }

  const records = await TaxiItem.find(filter)
    .select('departure_kor departure_eng departure_is_airport -_id')
    .sort({ departure_kor: 1 });

  const map = new Map();
  for (const r of records) {
    if (!map.has(r.departure_kor)) {
      map.set(r.departure_kor, {
        name_kor: r.departure_kor,
        name_eng: r.departure_eng,
        is_airport: r.departure_is_airport
      });
    }
  }

  const departures = Array.from(map.values());

  res.json({
    success: true,
    data: departures
  });
  } catch (error) {
    console.error('출발지 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '출발지 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 출발지 기준 사용 가능한 도착지 목록 조회
router.get('/arrivals', async (req, res) => {
  try {
    const { departure, region, lang = 'kor' } = req.query;

    if (!departure || departure === 'undefined') {
      return res.status(400).json({
        success: false,
        message: '출발지를 입력해주세요.'
      });
    }

    const filter = { is_active: true };

    if (region && region !== 'undefined') {
      filter.region = region.toUpperCase();
    }

    if (lang === 'eng') {
      filter.departure_eng = departure;
    } else {
      filter.departure_kor = departure;
    }

  const records = await TaxiItem.find(filter)
    .select('arrival_kor arrival_eng arrival_is_airport -_id')
    .sort({ arrival_kor: 1 });

  const map = new Map();
  for (const r of records) {
    if (!map.has(r.arrival_kor)) {
      map.set(r.arrival_kor, {
        name_kor: r.arrival_kor,
        name_eng: r.arrival_eng,
        is_airport: r.arrival_is_airport
      });
    }
  }

  const arrivals = Array.from(map.values());

  res.json({
    success: true,
    data: arrivals
  });
  } catch (error) {
    console.error('도착지 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '도착지 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 지역별 통계
router.get('/stats', async (req, res) => {
  try {
    const stats = await TaxiItem.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 },
          avgReservationFee: { $avg: '$reservation_fee' },
          avgLocalPaymentFee: { $avg: '$local_payment_fee' },
          airportDepartures: {
            $sum: { $cond: [{ $eq: ['$departure_is_airport', 'Y'] }, 1, 0] }
          },
          airportArrivals: {
            $sum: { $cond: [{ $eq: ['$arrival_is_airport', 'Y'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 단일 노선 조회
router.get('/:id', async (req, res) => {
  try {
    const item = await TaxiItem.findById(req.params.id);
    
    if (!item || !item.is_active) {
      return res.status(404).json({
        success: false,
        message: '노선을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('노선 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '노선 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 전체 데이터 삭제
router.delete('/all', async (req, res) => {
  try {
    if (req.body.confirm !== 'DELETE_ALL') {
      return res.status(400).json({
        success: false,
        message: '삭제 확인이 필요합니다.'
      });
    }

    const result = await TaxiItem.deleteMany({});

    res.json({
      success: true,
      message: `${result.deletedCount}개의 택시 노선이 삭제되었습니다.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('전체 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 단일 노선 삭제 (Soft Delete)
router.delete('/:id', async (req, res) => {
  try {
    const item = await TaxiItem.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: '노선을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      message: '택시 노선이 비활성화되었습니다.'
    });
  } catch (error) {
    console.error('노선 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '노선 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

module.exports = router;