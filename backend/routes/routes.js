const express = require('express');
const router = express.Router();
const Route = require('../models/Route');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @route   GET /api/routes
// @desc    모든 노선 조회
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { isActive = true, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (isActive !== 'all') {
      filter.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;

    const routes = await Route.find(filter)
      .limit(limit * 1)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Route.countDocuments(filter);

    res.json({
      success: true,
      routes,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Routes fetch error:', error);
    res.status(500).json({
      success: false,
      message: '노선 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/routes/search
// @desc    출발지/도착지로 노선 검색
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const filter = { isActive: true };
    
    if (start) {
      filter['startPoint.name'] = new RegExp(start, 'i');
    }
    
    if (end) {
      filter['endPoint.name'] = new RegExp(end, 'i');
    }

    const routes = await Route.find(filter);

    res.json({
      success: true,
      routes
    });
  } catch (error) {
    console.error('Route search error:', error);
    res.status(500).json({
      success: false,
      message: '노선 검색 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/routes/:id
// @desc    특정 노선 조회
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: '노선을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Route fetch error:', error);
    res.status(500).json({
      success: false,
      message: '노선 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   POST /api/routes
// @desc    새 노선 생성 (관리자 전용)
// @access  Private/Admin
router.post('/', [auth, admin], async (req, res) => {
  try {
    const route = await Route.create(req.body);

    res.status(201).json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Route creation error:', error);
    res.status(500).json({
      success: false,
      message: '노선 생성 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/routes/:id
// @desc    노선 수정 (관리자 전용)
// @access  Private/Admin
router.put('/:id', [auth, admin], async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!route) {
      return res.status(404).json({
        success: false,
        message: '노선을 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Route update error:', error);
    res.status(500).json({
      success: false,
      message: '노선 수정 중 오류가 발생했습니다.'
    });
  }
});

// @route   DELETE /api/routes/:id
// @desc    노선 삭제 (관리자 전용)
// @access  Private/Admin
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: '노선을 찾을 수 없습니다.'
      });
    }

    await route.deleteOne();

    res.json({
      success: true,
      message: '노선이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Route delete error:', error);
    res.status(500).json({
      success: false,
      message: '노선 삭제 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/routes/nearby/:lat/:lng
// @desc    근처 노선 찾기
// @access  Public
router.get('/nearby/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { maxDistance = 5000 } = req.query; // 기본 5km

    const routes = await Route.find({
      isActive: true,
      $or: [
        {
          'startPoint.coordinates': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parseFloat(lng), parseFloat(lat)]
              },
              $maxDistance: parseInt(maxDistance)
            }
          }
        },
        {
          'endPoint.coordinates': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parseFloat(lng), parseFloat(lat)]
              },
              $maxDistance: parseInt(maxDistance)
            }
          }
        }
      ]
    }).limit(10);

    res.json({
      success: true,
      routes
    });
  } catch (error) {
    console.error('Nearby routes error:', error);
    res.status(500).json({
      success: false,
      message: '근처 노선 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;