const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @route   GET /api/users
// @desc    모든 사용자 조회 (관리자 전용)
// @access  Private/Admin
router.get('/', [auth, admin], async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;
    
    // 필터 조건
    const filter = {};
    if (role) filter.role = role;

    // 페이지네이션
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-password')
      .limit(limit * 1)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      users,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/users/:id
// @desc    특정 사용자 조회
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 관리자가 아닌 경우 자신의 정보만 조회 가능
    if (req.user.role !== 'admin' && req.user.id !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 조회 중 오류가 발생했습니다.'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    사용자 정보 수정 (관리자 전용)
// @access  Private/Admin
router.put('/:id', [auth, admin], async (req, res) => {
  try {
    const { name, email, phone, role, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 업데이트
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 수정 중 오류가 발생했습니다.'
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    사용자 삭제 (관리자 전용)
// @access  Private/Admin
router.delete('/:id', [auth, admin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 자기 자신은 삭제할 수 없음
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '자기 자신은 삭제할 수 없습니다.'
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: '사용자가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('User delete error:', error);
    res.status(500).json({
      success: false,
      message: '사용자 삭제 중 오류가 발생했습니다.'
    });
  }
});

// @route   GET /api/users/stats/overview
// @desc    사용자 통계 (관리자 전용)
// @access  Private/Admin
router.get('/stats/overview', [auth, admin], async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });

    res.json({
      success: true,
      stats: {
        total: totalUsers,
        active: activeUsers,
        byRole: stats.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('User stats error:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router;