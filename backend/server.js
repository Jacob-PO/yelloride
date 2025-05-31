require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { errorHandler } = require('./utils/errorHandler');

// Express 앱 초기화
const app = express();

// 데이터베이스 연결
connectDB();

// 보안 미들웨어
app.use(helmet());

// CORS 설정
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP 로깅
app.use(logger.httpLogger());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100개 요청
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
});
app.use('/api/', limiter);

// 정적 파일 제공
app.use('/uploads', express.static('uploads'));

// API 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/taxis', require('./routes/taxis'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/routes', require('./routes/routes'));

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '요청하신 리소스를 찾을 수 없습니다.' 
  });
});

// 에러 핸들러
app.use(errorHandler);

// 서버 시작
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  console.log(`Server is running on port ${PORT}`);
});

// 프로세스 종료 처리
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', { error: err.message });
  server.close(() => process.exit(1));
});