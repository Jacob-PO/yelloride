// 커스텀 에러 클래스
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// 에러 응답 포맷
const sendErrorResponse = (error, res) => {
  const { statusCode = 500, message } = error;
  
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
};

// 비동기 함수 래퍼
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 글로벌 에러 핸들러 미들웨어
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = '잘못된 ID 형식입니다';
    error = new AppError(message, 400);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field}이(가) 이미 존재합니다`;
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = messages.join(', ');
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = '유효하지 않은 토큰입니다';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = '토큰이 만료되었습니다';
    error = new AppError(message, 401);
  }

  sendErrorResponse(error, res);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler
};