const express = require('express');
const router = express.Router();
const Taxi = require('../models/Taxi');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { validateTaxi } = require('../middleware/validation');

// @route   GET /api/taxis
// @desc    모든 택시 조회
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // 필터 조건
    const filter = {};
    if (status) filter.status = status;

    // 페이지네이션
    const skip = (page - 1) * limit;

    const taxis = await Taxi.find(filter)
      .populate('driver', 'name email phone')
      .limit(limit * 1)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Taxi.countDocuments(filter);

    res.json({
      success: true,
      taxis,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Taxis fetch error:', error);
    res.status(500).json({
      success: false,
      message: '택시 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/taxis/available
// @desc    이용 가능한 택시 조회
// @access  Public
router.get('/available', async (req, res) => {
  try {
    const { lat, lng, maxDistance = 5000 } = req.query;

    let query = { status: 'available' };

    // 위치 기반 검색
    if (lat && lng) {
      query.currentLocation = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      };
    }

    const taxis = await Taxi.find(query)
      .populate('driver', 'name phone')
      .limit(20);

    res.json({
      success: true,
      taxis
    });
  } catch (error) {
    console.error('Available taxis error:', error);
    res.status(500).json({
      success: false,
      message: '이용 가능한 택시 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/taxis/:id
// @desc    특정 택시 조회
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const taxi = await Taxi.findById(req.params.id)
      .populate('driver', 'name email phone');
    
    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: '택시를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      taxi
    });
  } catch (error) {
    console.error('Taxi fetch error:', error);
    res.status(500).json({
      success: false,
      message: '택시 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   POST /api/taxis
// @desc    새 택시 등록 (관리자 전용)
// @access  Private/Admin
router.post('/', [auth, admin, validateTaxi], async (req, res) => {
  try {
    const taxi = await Taxi.create(req.body);

    res.status(201).json({
      success: true,
      taxi
    });
  } catch (error) {
    console.error('Taxi creation error:', error);
    
    // 중복 키 에러 처리
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '이미 등록된 택시 번호입니다.'
      });
    }

    res.status(500).json({
      success: false,
      message: '택시 등록 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/taxis/:id
// @desc    택시 정보 수정
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, currentLocation, model, color, capacity } = req.body;
    
    const taxi = await Taxi.findById(req.params.id);
    
    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: '택시를 찾을 수 없습니다.'
      });
    }

    // 운전자는 자신의 택시만 수정 가능
    if (req.user.role === 'driver' && 
        (!taxi.driver || taxi.driver.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    // 업데이트
    if (status) taxi.status = status;
    if (currentLocation) taxi.currentLocation = currentLocation;
    if (model) taxi.model = model;
    if (color) taxi.color = color;
    if (capacity) taxi.capacity = capacity;

    taxi.lastUpdate = Date.now();
    await taxi.save();

    res.json({
      success: true,
      taxi
    });
  } catch (error) {
    console.error('Taxi update error:', error);
    res.status(500).json({
      success: false,
      message: '택시 수정 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/taxis/:id/location
// @desc    택시 위치 업데이트
// @access  Private
router.put('/:id/location', auth, async (req, res) => {
  try {
    const { coordinates } = req.body;
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: '유효한 좌표를 입력해주세요.'
      });
    }

    const taxi = await Taxi.findById(req.params.id);
    
    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: '택시를 찾을 수 없습니다.'
      });
    }

    // 운전자는 자신의 택시만 업데이트 가능
    if (req.user.role === 'driver' && 
        (!taxi.driver || taxi.driver.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    await taxi.updateLocation(coordinates);

    res.json({
      success: true,
      message: '위치가 업데이트되었습니다.',
      currentLocation: taxi.currentLocation
    });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({
      success: false,
      message: '위치 업데이트 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/taxis/:id/status
// @desc    택시 상태 변경
// @access  Private
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['available', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '유효한 상태를 선택해주세요.'
      });
    }

    const taxi = await Taxi.findById(req.params.id);
    
    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: '택시를 찾을 수 없습니다.'
      });
    }

    // 운전자는 자신의 택시만 업데이트 가능
    if (req.user.role === 'driver' && 
        (!taxi.driver || taxi.driver.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    await taxi.changeStatus(status);

    res.json({
      success: true,
      message: '상태가 변경되었습니다.',
      status: taxi.status
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({
      success: false,
      message: '상태 변경 중 오류가 발생했습니다.'
    });
  }
});

// @route   DELETE /api/taxis/:id
// @desc    택시 삭제 (관리자 전용)
// @access  Private/Admin
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const taxi = await Taxi.findById(req.params.id);
    
    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: '택시를 찾을 수 없습니다.'
      });
    }

    await taxi.deleteOne();

    res.json({
      success: true,
      message: '택시가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Taxi delete error:', error);
    res.status(500).json({
      success: false,
      message: '택시 삭제 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/taxis/stats/overview
// @desc    택시 통계 (관리자 전용)
// @access  Private/Admin
router.get('/stats/overview', [auth, admin], async (req, res) => {
  try {
    const stats = await Taxi.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalTaxis = await Taxi.countDocuments();
    const avgRating = await Taxi.aggregate([
      { $match: { rating: { $gt: 0 } } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    res.json({
      success: true,
      stats: {
        total: totalTaxis,
        byStatus: stats.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        averageRating: avgRating[0]?.avgRating || 0
      }
    });
  } catch (error) {
    console.error('Taxi stats error:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;