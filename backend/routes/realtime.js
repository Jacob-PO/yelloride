const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

// 실시간 예약 현황 조회
router.get('/bookings/status', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const stats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusMap = {
      pending: 0,
      confirmed: 0,
      driver_assigned: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0
    };

    stats.forEach(stat => {
      statusMap[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        date: today.toISOString().split('T')[0],
        stats: statusMap,
        total: Object.values(statusMap).reduce((a, b) => a + b, 0)
      }
    });
  } catch (error) {
    console.error('실시간 현황 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '실시간 현황 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 실시간 예약 목록 (대기중/진행중)
router.get('/bookings/active', async (req, res) => {
  try {
    const activeBookings = await Booking.find({
      status: { $in: ['pending', 'confirmed', 'driver_assigned', 'in_progress'] }
    })
    .sort({ 'trip_details.departure.datetime': 1 })
    .limit(50);

    res.json({
      success: true,
      data: activeBookings
    });
  } catch (error) {
    console.error('활성 예약 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '활성 예약 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 오늘의 예약 타임라인
router.get('/bookings/timeline', async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      'trip_details.departure.datetime': {
        $gte: startDate,
        $lte: endDate
      }
    })
    .sort({ 'trip_details.departure.datetime': 1 })
    .select('booking_number status trip_details customer_info service_info');

    // 시간대별 그룹화
    const timeline = {};
    bookings.forEach(booking => {
      const hour = new Date(booking.trip_details.departure.datetime).getHours();
      if (!timeline[hour]) {
        timeline[hour] = [];
      }
      timeline[hour].push(booking);
    });

    res.json({
      success: true,
      data: {
        date,
        timeline,
        total: bookings.length
      }
    });
  } catch (error) {
    console.error('타임라인 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '타임라인 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 지역별 실시간 현황
router.get('/regions/status', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const regionStats = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$service_info.region',
          count: { $sum: 1 },
          totalAmount: { $sum: '$pricing.total_amount' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: regionStats
    });
  } catch (error) {
    console.error('지역별 현황 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '지역별 현황 조회 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 실시간 알림 (SSE - Server-Sent Events)
router.get('/notifications', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // 초기 연결 메시지
  res.write(`data: ${JSON.stringify({ type: 'connected', message: '실시간 알림 연결됨' })}\n\n`);

  // 정기적으로 알림 전송 (실제로는 이벤트 기반으로 구현)
  const interval = setInterval(async () => {
    try {
      // 새로운 예약 확인
      const recentBookings = await Booking.find({
        createdAt: { $gte: new Date(Date.now() - 60000) } // 1분 이내
      }).limit(5);

      if (recentBookings.length > 0) {
        res.write(`data: ${JSON.stringify({
          type: 'new_bookings',
          count: recentBookings.length,
          bookings: recentBookings.map(b => ({
            booking_number: b.booking_number,
            customer_name: b.customer_info.name,
            departure: b.trip_details.departure.location
          }))
        })}\n\n`);
      }
    } catch (error) {
      console.error('알림 전송 오류:', error);
    }
  }, 30000); // 30초마다

  // 연결 종료 시 정리
  req.on('close', () => {
    clearInterval(interval);
  });
});

module.exports = router;