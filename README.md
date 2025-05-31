# YelloRide - 택시 예약 시스템

YelloRide는 사용자가 편리하게 택시를 예약하고, 운전자가 효율적으로 예약을 관리할 수 있는 웹 기반 택시 예약 플랫폼입니다.

## 📋 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [시스템 요구사항](#시스템-요구사항)
- [설치 방법](#설치-방법)
- [실행 방법](#실행-방법)
- [API 엔드포인트](#api-엔드포인트)
- [프로젝트 구조](#프로젝트-구조)
- [환경 변수](#환경-변수)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [개발자 가이드](#개발자-가이드)
- [문제 해결](#문제-해결)
- [라이선스](#라이선스)

## 🚀 주요 기능

### 사용자 기능
- 회원가입 및 로그인
- 택시 예약 생성/조회/취소
- 실시간 택시 위치 확인
- 예약 이력 관리
- 프로필 관리

### 운전자 기능
- 예약 요청 확인 및 수락/거절
- 운행 상태 관리
- 수익 현황 확인
- 운행 이력 조회

### 관리자 기능
- 사용자/운전자 관리
- 택시 차량 관리
- 노선 관리
- 통계 및 리포트

## 🛠 기술 스택

### Frontend
- **React** 18.2.0 - 사용자 인터페이스 구축
- **React Router DOM** 6.22.0 - 클라이언트 사이드 라우팅
- **Axios** 1.6.7 - HTTP 클라이언트
- **Bootstrap** 5.3.2 - UI 프레임워크
- **Leaflet** 1.9.4 - 지도 표시

### Backend
- **Node.js** 20.0.0+ - 서버 런타임
- **Express** 4.18.2 - 웹 프레임워크
- **MongoDB** - NoSQL 데이터베이스
- **Mongoose** 8.1.1 - MongoDB ODM
- **JWT** - 인증 토큰
- **Bcrypt** - 비밀번호 암호화
- **Multer** - 파일 업로드

## 💻 시스템 요구사항

- Node.js 20.0.0 이상
- MongoDB 4.4 이상
- npm 또는 yarn 패키지 매니저

## 📥 설치 방법

### 1. 저장소 클론
```bash
git clone https://github.com/yourusername/yelloride.git
cd yelloride
```

### 2. 의존성 설치
```bash
# 루트 디렉토리에서
npm install

# 백엔드 의존성 설치
cd backend
npm install

# 프론트엔드 의존성 설치
cd ../frontend
npm install
```

### 3. 환경 변수 설정
백엔드 디렉토리에 `.env` 파일을 생성하고 다음 내용을 추가:
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/yelloride
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=30d
NODE_ENV=development
```

### 4. MongoDB 실행
```bash
# MongoDB가 설치되어 있지 않다면 먼저 설치
# macOS: brew install mongodb-community
# Windows: MongoDB 공식 사이트에서 다운로드

# MongoDB 서비스 시작
mongod
```

## 🚀 실행 방법

### 개발 모드로 실행

1. **터미널 1 - 백엔드 서버**
```bash
cd backend
npm run dev
```

2. **터미널 2 - 프론트엔드 서버**
```bash
cd frontend
npm start
```

3. **브라우저에서 접속**
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:5001

### 샘플 데이터 생성
```bash
cd backend
npm run seed        # 전체 샘플 데이터 생성
npm run seed:taxi   # 택시 데이터만 생성
npm run import:json -- --clear   # JSON 파일로 모든 택시 노선 갱신
```

백엔드 서버를 처음 실행하면 데이터베이스에 노선이 없는 경우 `backend/data/taxiitems_full.json` 파일을 읽어 `taxi_item` 컬렉션에 자동으로 데이터를 채워 넣습니다.

### 프로덕션 빌드
```bash
# 프론트엔드 빌드
cd frontend
npm run build

# 백엔드 프로덕션 모드 실행
cd ../backend
npm start
```

## 📡 API 엔드포인트

### 인증 관련
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/profile` - 프로필 조회
- `PUT /api/auth/profile` - 프로필 수정

### 택시 관련
- `GET /api/taxis` - 택시 목록 조회
- `GET /api/taxis/:id` - 특정 택시 조회
- `POST /api/taxis` - 택시 등록 (관리자)
- `PUT /api/taxis/:id` - 택시 정보 수정
- `DELETE /api/taxis/:id` - 택시 삭제

### 예약 관련
- `GET /api/bookings` - 예약 목록 조회
- `GET /api/bookings/:id` - 특정 예약 조회
- `POST /api/bookings` - 예약 생성
- `PUT /api/bookings/:id` - 예약 수정
- `PUT /api/bookings/:id/status` - 예약 상태 변경
- `DELETE /api/bookings/:id` - 예약 취소

### 노선 관련
- `GET /api/routes` - 노선 목록 조회
- `GET /api/routes/:id` - 특정 노선 조회
- `POST /api/routes` - 노선 생성 (관리자)
- `PUT /api/routes/:id` - 노선 수정
- `DELETE /api/routes/:id` - 노선 삭제

## 📁 프로젝트 구조

```
yelloride/
├── backend/
│   ├── config/         # 설정 파일
│   ├── models/         # 데이터베이스 모델
│   ├── routes/         # API 라우트
│   ├── middleware/     # 미들웨어
│   ├── utils/          # 유틸리티 함수
│   ├── scripts/        # 스크립트 파일
│   └── uploads/        # 업로드 파일 저장
├── frontend/
│   ├── public/         # 정적 파일
│   └── src/            # React 소스 코드
└── README.md
```

## 🔐 환경 변수

### Backend (.env)
| 변수명 | 설명 | 예시 |
|--------|------|------|
| PORT | 서버 포트 | 5001 |
| MONGODB_URI | MongoDB 연결 URI | mongodb://localhost:27017/yelloride |
| DB_NAME | 데이터베이스 이름 | yelloride |
| TAXI_COLLECTION | 택시 노선 컬렉션 | taxi_item |
| JWT_SECRET | JWT 비밀 키 | your-secret-key |
| JWT_EXPIRE | JWT 만료 시간 | 30d |
| NODE_ENV | 실행 환경 | development/production |

## 💾 데이터베이스 스키마

### User
- name: String (required)
- email: String (required, unique)
- password: String (required)
- phone: String (required)
- role: String (user/driver/admin)

### Taxi
- taxiNumber: String (required, unique)
- driverName: String (required)
- licenseNumber: String (required)
- model: String
- status: String (available/busy/offline)
- currentLocation: GeoJSON Point

### Booking
- customer: ObjectId (ref: User)
- taxi: ObjectId (ref: Taxi)
- pickupLocation: String
- dropoffLocation: String
- pickupTime: Date
- fare: Number
- status: String (pending/confirmed/completed/cancelled)

### Route
- name: String
- startPoint: Object (name, coordinates)
- endPoint: Object (name, coordinates)
- waypoints: Array
- estimatedTime: Number
- baseFare: Number

## 👨‍💻 개발자 가이드

### 코드 스타일
- ESLint 설정을 따름
- 함수형 컴포넌트와 Hooks 사용
- async/await 패턴 사용

### Git 브랜치 전략
- `main`: 프로덕션 브랜치
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발 브랜치
- `hotfix/*`: 긴급 수정 브랜치

### 커밋 메시지 규칙
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드 업무 수정
```

## 🔧 문제 해결

### MongoDB 연결 오류
```bash
# MongoDB 서비스 확인
sudo systemctl status mongod

# MongoDB 재시작
sudo systemctl restart mongod
```

### 포트 충돌
```bash
# 사용 중인 포트 확인
lsof -i :5001
lsof -i :3000

# 프로세스 종료
kill -9 <PID>
```

### npm 패키지 오류
```bash
# node_modules 삭제 및 재설치
rm -rf node_modules package-lock.json
npm install
```

## 🤝 기여 방법

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 연락처

- 이메일: support@yelloride.com
- 이슈 트래커: https://github.com/yourusername/yelloride/issues

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

---

<div align="center">
  <p>Made with ❤️ by YelloRide Team</p>
  <p>© 2024 YelloRide. All rights reserved.</p>
</div>
