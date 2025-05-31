const fs = require('fs');
const path = require('path');
const util = require('util');

// 로그 디렉토리 생성
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 로그 레벨 정의
const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// 로그 색상 정의 (콘솔용)
const colors = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[37m', // White
  RESET: '\x1b[0m'   // Reset
};

class Logger {
  constructor() {
    this.logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    this.errorFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
  }

  // 타임스탬프 생성
  getTimestamp() {
    return new Date().toISOString();
  }

  // 로그 포맷팅
  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? util.inspect(meta, { depth: null }) : '';
    return `[${timestamp}] [${level}] ${message} ${metaStr}`.trim();
  }

  // 파일에 로그 작성
  writeToFile(filename, message) {
    fs.appendFile(filename, message + '\n', (err) => {
      if (err) {
        console.error('Failed to write log:', err);
      }
    });
  }

  // 콘솔에 로그 출력
  writeToConsole(level, message) {
    const color = colors[level] || colors.RESET;
    console.log(`${color}${message}${colors.RESET}`);
  }

  // 로그 메서드
  log(level, message, meta) {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // 콘솔 출력
    if (process.env.NODE_ENV !== 'test') {
      this.writeToConsole(level, formattedMessage);
    }

    // 파일 출력
    this.writeToFile(this.logFile, formattedMessage);
    
    // 에러는 별도 파일에도 기록
    if (level === LogLevel.ERROR) {
      this.writeToFile(this.errorFile, formattedMessage);
    }
  }

  // 편의 메서드
  error(message, meta) {
    this.log(LogLevel.ERROR, message, meta);
  }

  warn(message, meta) {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message, meta) {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message, meta) {
    if (process.env.NODE_ENV === 'development') {
      this.log(LogLevel.DEBUG, message, meta);
    }
  }

  // HTTP 요청 로거
  httpLogger() {
    return (req, res, next) => {
      const start = Date.now();
      const originalSend = res.send;

      res.send = function(data) {
        res.send = originalSend;
        res.send(data);
        
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('user-agent')
        };

        if (res.statusCode >= 400) {
          logger.error('HTTP Request Error', logData);
        } else {
          logger.info('HTTP Request', logData);
        }
      };

      next();
    };
  }

  // 로그 파일 회전 (오래된 로그 삭제)
  rotateLogs(daysToKeep = 7) {
    const files = fs.readdirSync(logDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    files.forEach(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        this.info(`Deleted old log file: ${file}`);
      }
    });
  }
}

// 싱글톤 인스턴스
const logger = new Logger();

// 매일 자정에 로그 회전
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    logger.rotateLogs();
  }, 24 * 60 * 60 * 1000);
}

// 프로세스 에러 핸들링
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
});

module.exports = logger;