const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Taxi = require('../models/Taxi');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { validateBooking, validateBookingStatus, validateReview } = require('../middleware/validation');

// @route   GET /api/bookings
// @desc    예약 목록 조회
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // 필터 조건
    const filter = {};
    
    // 역할에 따른 필터링
    if (req.user.role === 'user') {
      filter.customer = req.user.id;
    } else if (req.user.role === 'driver') {
      // 운전자는 자신에게 할당된 예약만 조회
      const taxi = await Taxi.findOne({ driver: req.user.id });
      if (taxi) {
        filter.taxi = taxi._id;
      }
    }
    // 관리자는 모든 예약 조회 가능
    
    if (status) filter.status = status;

    // 페이지네이션
    const skip = (page - 1) * limit;

    const bookings = await Booking.find(filter)
      .populate('customer', 'name email phone')
      .populate('taxi', 'taxiNumber driverName')
      .populate('route', 'name')
      .limit(limit * 1)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await Booking.countDocuments(filter);

    res.json({
      success: true,
      bookings,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({
      success: false,
      message: '예약 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/bookings/active
// @desc    활성 예약 조회
// @access  Private
router.get('/active', auth, async (req, res) => {
  try {
    const filter = {
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    };

    // 역할에 따른 필터링
    if (req.user.role === 'user') {
      filter.customer = req.user.id;
    } else if (req.user.role === 'driver') {
      const taxi = await Taxi.findOne({ driver: req.user.id });
      if (taxi) {
        filter.taxi = taxi._id;
      }
    }

    const bookings = await Booking.find(filter)
      .populate('customer', 'name email phone')
      .populate('taxi', 'taxiNumber driverName currentLocation')
      .populate('route', 'name')
      .sort({ pickupTime: 1 });

    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    console.error('Active bookings error:', error);
    res.status(500).json({
      success: false,
      message: '활성 예약 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    특정 예약 조회
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('taxi', 'taxiNumber driverName licenseNumber model color')
      .populate('route');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: '예약을 찾을 수 없습니다.'
      });
    }

    // 권한 확인
    if (req.user.role === 'user' && booking.customer._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    if (req.user.role === 'driver') {
      const taxi = await Taxi.findOne({ driver: req.user.id });
      if (!taxi || !booking.taxi || booking.taxi._id.toString() !== taxi._id.toString()) {
        return res.status(403).json({
          success: false,
          message: '권한이 없습니다.'
        });
      }
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Booking fetch error:', error);
    res.status(500).json({
      success: false,
      message: '예약 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   POST /api/bookings
// @desc    새 예약 생성
// @access  Private
router.post('/', [auth, validateBooking], async (req, res) => {
  try {
    const bookingData = {
      ...req.body,
      customer: req.user.id
    };

    // 택시가 지정된 경우 가용성 확인
    if (bookingData.taxi) {
      const taxi = await Taxi.findById(bookingData.taxi);
      if (!taxi) {
        return res.status(404).json({
          success: false,
          message: '택시를 찾을 수 없습니다.'
        });
      }
      if (taxi.status !== 'available') {
        return res.status(400).json({
          success: false,
          message: '선택한 택시는 현재 이용할 수 없습니다.'
        });
      }
    }

    const booking = await Booking.create(bookingData);

    // 택시가 지정된 경우 상태 변경
    if (booking.taxi) {
      await Taxi.findByIdAndUpdate(booking.taxi, { status: 'busy' });
    }

    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('taxi', 'taxiNumber driverName')
      .populate('route');

    res.status(201).json({
      success: true,
      booking: populatedBooking
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({
      success: false,
      message: '예약 생성 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/bookings/:id
// @desc    예약 수정
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: '예약을 찾을 수 없습니다.'
      });
    }

    // 권한 확인
    if (req.user.role === 'user' && booking.customer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    // 상태가 pending인 경우만 수정 가능
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '확정된 예약은 수정할 수 없습니다.'
      });
    }

    const allowedFields = ['pickupLocation', 'dropoffLocation', 'pickupTime', 'specialRequests'];
    const updates = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('customer', 'name email phone')
     .populate('taxi', 'taxiNumber driverName')
     .populate('route');

    res.json({
      success: true,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Booking update error:', error);
    res.status(500).json({
      success: false,
      message: '예약 수정 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    예약 상태 변경
// @access  Private
router.put('/:id/status', [auth, validateBookingStatus], async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    
    const booking = await Booking.findById(req.params.id)
      .populate('taxi');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: '예약을 찾을 수 없습니다.'
      });
    }

    // 권한 확인
    if (req.user.role === 'user') {
      if (booking.customer.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '권한이 없습니다.'
        });
      }
      // 사용자는 취소만 가능
      if (status !== 'cancelled') {
        return res.status(403).json({
          success: false,
          message: '예약 취소만 가능합니다.'
        });
      }
    }

    if (req.user.role === 'driver') {
      const taxi = await Taxi.findOne({ driver: req.user.id });
      if (!taxi || !booking.taxi || booking.taxi._id.toString() !== taxi._id.toString()) {
        return res.status(403).json({
          success: false,
          message: '권한이 없습니다.'
        });
      }
    }

    // 상태 변경 유효성 검사
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['in-progress', 'cancelled'],
      'in-progress': ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    if (!validTransitions[booking.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 상태 변경입니다.'
      });
    }

    // 상태 업데이트
    booking.status = status;
    
    if (status === 'cancelled') {
      booking.cancelReason = cancelReason;
    } else if (status === 'in-progress') {
      booking.actualPickupTime = new Date();
    } else if (status === 'completed') {
      booking.actualDropoffTime = new Date();
      booking.completedAt = new Date();
    }

    await booking.save();

    // 택시 상태 업데이트
    if (booking.taxi) {
      if (status === 'cancelled' || status === 'completed') {
        await Taxi.findByIdAndUpdate(booking.taxi._id, { status: 'available' });
      }
    }

    const updatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('taxi', 'taxiNumber driverName')
      .populate('route');

    res.json({
      success: true,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Booking status update error:', error);
    res.status(500).json({
      success: false,
      message: '예약 상태 변경 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/bookings/:id/assign-taxi
// @desc    예약에 택시 할당
// @access  Private
router.put('/:id/assign-taxi', auth, async (req, res) => {
  try {
    const { taxiId } = req.body;
    
    if (!taxiId) {
      return res.status(400).json({
        success: false,
        message: '택시 ID를 입력해주세요.'
      });
    }

    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: '예약을 찾을 수 없습니다.'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '대기 중인 예약만 택시를 할당할 수 있습니다.'
      });
    }

    const taxi = await Taxi.findById(taxiId);
    
    if (!taxi) {
      return res.status(404).json({
        success: false,
        message: '택시를 찾을 수 없습니다.'
      });
    }

    if (taxi.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: '선택한 택시는 현재 이용할 수 없습니다.'
      });
    }

    // 운전자는 자신의 택시만 할당 가능
    if (req.user.role === 'driver') {
      if (!taxi.driver || taxi.driver.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '권한이 없습니다.'
        });
      }
    }

    // 택시 할당 및 상태 변경
    await booking.assignTaxi(taxiId);
    await taxi.changeStatus('busy');

    const updatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('taxi', 'taxiNumber driverName')
      .populate('route');

    res.json({
      success: true,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Taxi assignment error:', error);
    res.status(500).json({
      success: false,
      message: '택시 할당 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/bookings/:id/review
// @desc    예약 리뷰 작성
// @access  Private
router.put('/:id/review', [auth, validateReview], async (req, res) => {
  try {
    const { rating, review } = req.body;
    
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: '예약을 찾을 수 없습니다.'
      });
    }

    // 권한 확인 - 고객만 리뷰 작성 가능
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: '완료된 예약만 리뷰를 작성할 수 있습니다.'
      });
    }

    if (booking.rating) {
      return res.status(400).json({
        success: false,
        message: '이미 리뷰를 작성했습니다.'
      });
    }

    booking.rating = rating;
    booking.review = review;
    await booking.save();

    // 택시 평점 업데이트
    if (booking.taxi) {
      const taxiBookings = await Booking.find({
        taxi: booking.taxi,
        rating: { $exists: true, $ne: null }
      });
      
      const avgRating = taxiBookings.reduce((sum, b) => sum + b.rating, 0) / taxiBookings.length;
      
      await Taxi.findByIdAndUpdate(booking.taxi, {
        rating: avgRating,
        $inc: { totalTrips: 1 }
      });
    }

    res.json({
      success: true,
      message: '리뷰가 등록되었습니다.'
    });
  } catch (error) {
    console.error('Review submission error:', error);
    res.status(500).json({
      success: false,
      message: '리뷰 등록 중 오류가 발생했습니다.'
    });
  }
});

// @route   DELETE /api/bookings/:id
// @desc    예약 삭제 (관리자 전용)
// @access  Private/Admin
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: '예약을 찾을 수 없습니다.'
      });
    }

    await booking.deleteOne();

    res.json({
      success: true,
      message: '예약이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Booking delete error:', error);
    res.status(500).json({
      success: false,
      message: '예약 삭제 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/bookings/stats/overview
// @desc    예약 통계 (관리자 전용)
// @access  Private/Admin
router.get('/stats/overview', [auth, admin], async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalFare: { $sum: '$fare' }
        }
      }
    ]);

    const totalBookings = await Booking.countDocuments();
    const todayBookings = await Booking.countDocuments({
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });

    res.json({
      success: true,
      stats: {
        total: totalBookings,
        today: todayBookings,
        byStatus: stats.reduce((acc, curr) => {
          acc[curr._id] = {
            count: curr.count,
            totalFare: curr.totalFare
          };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Booking stats error:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;