const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // 헤더에서 토큰 추출
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new Error();
    }

    // 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // 사용자 조회
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      throw new Error();
    }

    // 요청 객체에 사용자 정보 추가
    req.user = {
      id: user._id.toString(),
      role: user.role
    };
    req.fullUser = user;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: '인증이 필요합니다. 다시 로그인해주세요.'
    });
  }
};

module.exports = auth;