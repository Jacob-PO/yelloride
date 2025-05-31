const { body, validationResult } = require('express-validator');

// 검증 결과 처리 미들웨어
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }))
    });
  }
  next();
};

// 회원가입 검증
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('이름을 입력해주세요')
    .isLength({ min: 2, max: 50 }).withMessage('이름은 2-50자 사이여야 합니다'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('이메일을 입력해주세요')
    .isEmail().withMessage('유효한 이메일 주소를 입력해주세요')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('비밀번호를 입력해주세요')
    .isLength({ min: 6 }).withMessage('비밀번호는 최소 6자 이상이어야 합니다')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('비밀번호는 영문자와 숫자를 포함해야 합니다'),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('전화번호를 입력해주세요')
    .matches(/^010-\d{4}-\d{4}$/).withMessage('올바른 전화번호 형식을 입력해주세요 (010-0000-0000)'),
  
  body('role')
    .optional()
    .isIn(['user', 'driver', 'admin']).withMessage('유효한 역할을 선택해주세요'),
  
  handleValidationErrors
];

// 로그인 검증
const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('이메일을 입력해주세요')
    .isEmail().withMessage('유효한 이메일 주소를 입력해주세요')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('비밀번호를 입력해주세요'),
  
  handleValidationErrors
];

// 택시 등록 검증
const validateTaxi = [
  body('taxiNumber')
    .trim()
    .notEmpty().withMessage('택시 번호를 입력해주세요')
    .isLength({ min: 3, max: 20 }).withMessage('택시 번호는 3-20자 사이여야 합니다'),
  
  body('driverName')
    .trim()
    .notEmpty().withMessage('운전자 이름을 입력해주세요')
    .isLength({ min: 2, max: 50 }).withMessage('운전자 이름은 2-50자 사이여야 합니다'),
  
  body('licenseNumber')
    .trim()
    .notEmpty().withMessage('차량 번호를 입력해주세요'),
  
  body('model')
    .trim()
    .notEmpty().withMessage('차량 모델을 입력해주세요'),
  
  body('color')
    .trim()
    .notEmpty().withMessage('차량 색상을 입력해주세요'),
  
  body('year')
    .notEmpty().withMessage('연식을 입력해주세요')
    .isInt({ min: 2000, max: new Date().getFullYear() })
    .withMessage(`연식은 2000년부터 ${new Date().getFullYear()}년 사이여야 합니다`),
  
  body('capacity')
    .notEmpty().withMessage('승차 정원을 입력해주세요')
    .isInt({ min: 1, max: 8 }).withMessage('승차 정원은 1-8명 사이여야 합니다'),
  
  handleValidationErrors
];

// 예약 생성 검증
const validateBooking = [
  body('taxi')
    .optional()
    .isMongoId().withMessage('유효한 택시 ID를 입력해주세요'),
  
  body('pickupLocation')
    .trim()
    .notEmpty().withMessage('픽업 위치를 입력해주세요'),
  
  body('pickupCoordinates')
    .notEmpty().withMessage('픽업 좌표를 입력해주세요')
    .isObject().withMessage('픽업 좌표는 객체여야 합니다'),
  
  body('pickupCoordinates.coordinates')
    .isArray({ min: 2, max: 2 }).withMessage('좌표는 [경도, 위도] 형식이어야 합니다')
    .custom((value) => {
      if (!Array.isArray(value) || value.length !== 2) return false;
      const [lng, lat] = value;
      return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
    }).withMessage('유효한 좌표를 입력해주세요'),
  
  body('dropoffLocation')
    .trim()
    .notEmpty().withMessage('하차 위치를 입력해주세요'),
  
  body('dropoffCoordinates')
    .notEmpty().withMessage('하차 좌표를 입력해주세요')
    .isObject().withMessage('하차 좌표는 객체여야 합니다'),
  
  body('dropoffCoordinates.coordinates')
    .isArray({ min: 2, max: 2 }).withMessage('좌표는 [경도, 위도] 형식이어야 합니다')
    .custom((value) => {
      if (!Array.isArray(value) || value.length !== 2) return false;
      const [lng, lat] = value;
      return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
    }).withMessage('유효한 좌표를 입력해주세요'),
  
  body('pickupTime')
    .notEmpty().withMessage('픽업 시간을 입력해주세요')
    .isISO8601().withMessage('유효한 날짜 형식을 입력해주세요')
    .custom((value) => {
      const pickupDate = new Date(value);
      const now = new Date();
      return pickupDate > now;
    }).withMessage('픽업 시간은 현재 시간 이후여야 합니다'),
  
  body('fare')
    .notEmpty().withMessage('요금을 입력해주세요')
    .isFloat({ min: 0 }).withMessage('요금은 0원 이상이어야 합니다'),
  
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'app']).withMessage('유효한 결제 방법을 선택해주세요'),
  
  body('specialRequests')
    .optional()
    .isLength({ max: 500 }).withMessage('특별 요청사항은 500자 이내로 입력해주세요'),
  
  handleValidationErrors
];

// 예약 상태 변경 검증
const validateBookingStatus = [
  body('status')
    .notEmpty().withMessage('상태를 입력해주세요')
    .isIn(['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'])
    .withMessage('유효한 상태를 선택해주세요'),
  
  body('cancelReason')
    .if(body('status').equals('cancelled'))
    .notEmpty().withMessage('취소 사유를 입력해주세요'),
  
  handleValidationErrors
];

// 노선 생성/수정 검증
const validateRoute = [
  body('name')
    .trim()
    .notEmpty().withMessage('노선 이름을 입력해주세요')
    .isLength({ min: 2, max: 100 }).withMessage('노선 이름은 2-100자 사이여야 합니다'),
  
  body('startPoint')
    .notEmpty().withMessage('출발지를 입력해주세요')
    .isObject().withMessage('출발지는 객체여야 합니다'),
  
  body('startPoint.name')
    .notEmpty().withMessage('출발지 이름을 입력해주세요'),
  
  body('startPoint.coordinates')
    .notEmpty().withMessage('출발지 좌표를 입력해주세요'),
  
  body('endPoint')
    .notEmpty().withMessage('도착지를 입력해주세요')
    .isObject().withMessage('도착지는 객체여야 합니다'),
  
  body('endPoint.name')
    .notEmpty().withMessage('도착지 이름을 입력해주세요'),
  
  body('endPoint.coordinates')
    .notEmpty().withMessage('도착지 좌표를 입력해주세요'),
  
  body('estimatedTime')
    .notEmpty().withMessage('예상 시간을 입력해주세요')
    .isInt({ min: 1 }).withMessage('예상 시간은 1분 이상이어야 합니다'),
  
  body('estimatedDistance')
    .notEmpty().withMessage('예상 거리를 입력해주세요')
    .isFloat({ min: 0.1 }).withMessage('예상 거리는 0.1km 이상이어야 합니다'),
  
  body('baseFare')
    .notEmpty().withMessage('기본 요금을 입력해주세요')
    .isFloat({ min: 0 }).withMessage('기본 요금은 0원 이상이어야 합니다'),
  
  handleValidationErrors
];

// 리뷰 작성 검증
const validateReview = [
  body('rating')
    .notEmpty().withMessage('평점을 입력해주세요')
    .isInt({ min: 1, max: 5 }).withMessage('평점은 1-5점 사이여야 합니다'),
  
  body('review')
    .optional()
    .isLength({ max: 500 }).withMessage('리뷰는 500자 이내로 입력해주세요'),
  
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateTaxi,
  validateBooking,
  validateBookingStatus,
  validateRoute,
  validateReview
};