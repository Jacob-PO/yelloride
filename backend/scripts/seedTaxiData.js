const mongoose = require('mongoose');
const TaxiItem = require('../models/TaxiItem');
require('dotenv').config({ path: '../.env' });

// 샘플 택시 데이터
const sampleTaxiData = [
  // 뉴욕 지역
  {
    region: 'NY',
    departure_kor: 'NY 존에프케네디 공항',
    departure_eng: 'JFK airport',
    departure_is_airport: 'Y',
    arrival_kor: 'NY 맨하탄 미드타운',
    arrival_eng: 'Manhattan Midtown',
    arrival_is_airport: 'N',
    reservation_fee: 10,
    local_payment_fee: 75,
    priority: 1
  },
  {
    region: 'NY',
    departure_kor: 'NY 맨하탄 미드타운',
    departure_eng: 'Manhattan Midtown',
    departure_is_airport: 'N',
    arrival_kor: 'NY 존에프케네디 공항',
    arrival_eng: 'JFK airport',
    arrival_is_airport: 'Y',
    reservation_fee: 10,
    local_payment_fee: 75,
    priority: 2
  },
  {
    region: 'NY',
    departure_kor: 'NY 라과디아 공항',
    departure_eng: 'LGA airport',
    departure_is_airport: 'Y',
    arrival_kor: 'NY 맨하탄 미드타운',
    arrival_eng: 'Manhattan Midtown',
    arrival_is_airport: 'N',
    reservation_fee: 10,
    local_payment_fee: 65,
    priority: 3
  },
  {
    region: 'NY',
    departure_kor: 'NY 맨하탄 미드타운',
    departure_eng: 'Manhattan Midtown',
    departure_is_airport: 'N',
    arrival_kor: 'NY 라과디아 공항',
    arrival_eng: 'LGA airport',
    arrival_is_airport: 'Y',
    reservation_fee: 10,
    local_payment_fee: 65,
    priority: 4
  },
  {
    region: 'NY',
    departure_kor: 'NJ 뉴와크 공항',
    departure_eng: 'EWR airport',
    departure_is_airport: 'Y',
    arrival_kor: 'NY 맨하탄 미드타운',
    arrival_eng: 'Manhattan Midtown',
    arrival_is_airport: 'N',
    reservation_fee: 10,
    local_payment_fee: 95,
    priority: 5
  },
  {
    region: 'NY',
    departure_kor: 'NY 존에프케네디 공항',
    departure_eng: 'JFK airport',
    departure_is_airport: 'Y',
    arrival_kor: 'NY 플러싱',
    arrival_eng: 'Flushing',
    arrival_is_airport: 'N',
    reservation_fee: 10,
    local_payment_fee: 55,
    priority: 6
  },
  {
    region: 'NY',
    departure_kor: 'NY 플러싱',
    departure_eng: 'Flushing',
    departure_is_airport: 'N',
    arrival_kor: 'NY 존에프케네디 공항',
    arrival_eng: 'JFK airport',
    arrival_is_airport: 'Y',
    reservation_fee: 10,
    local_payment_fee: 55,
    priority: 7
  },
  {
    region: 'NY',
    departure_kor: 'NY 맨하탄 다운타운',
    departure_eng: 'Manhattan Downtown',
    departure_is_airport: 'N',
    arrival_kor: 'NY 브루클린',
    arrival_eng: 'Brooklyn',
    arrival_is_airport: 'N',
    reservation_fee: 10,
    local_payment_fee: 35,
    priority: 10
  },
  // 뉴저지 지역
  {
    region: 'NJ',
    departure_kor: 'NJ 뉴와크 공항',
    departure_eng: 'EWR airport',
    departure_is_airport: 'Y',
    arrival_kor: 'NJ 저지시티',
    arrival_eng: 'Jersey City',
    arrival_is_airport: 'N',
    reservation_fee: 10,
    local_payment_fee: 45,
    priority: 1
  },
  {
    region: 'NJ',
    departure_kor: 'NJ 저지시티',
    departure_eng: 'Jersey City',
    departure_is_airport: 'N',
    arrival_kor: 'NJ 뉴와크 공항',
    arrival_eng: 'EWR airport',
    arrival_is_airport: 'Y',
    reservation_fee: 10,
    local_payment_fee: 45,
    priority: 2
  },
  {
    region: 'NJ',
    departure_kor: 'NJ 뉴와크 공항',
    departure_eng: 'EWR airport',
    departure_is_airport: 'Y',
    arrival_kor: 'NJ 프린스턴',
    arrival_eng: 'Princeton',
    arrival_is_airport: 'N',
    reservation_fee: 10,
    local_payment_fee: 85,
    priority: 3
  },
  // 캘리포니아 지역
  {
    region: 'CA',
    departure_kor: 'LAX 국제공항',
    departure_eng: 'LAX airport',
    departure_is_airport: 'Y',
    arrival_kor: 'LA 다운타운',
    arrival_eng: 'Downtown LA',
    arrival_is_airport: 'N',
    reservation_fee: 15,
    local_payment_fee: 65,
    priority: 1
  },
  {
    region: 'CA',
    departure_kor: 'LA 다운타운',
    departure_eng: 'Downtown LA',
    departure_is_airport: 'N',
    arrival_kor: 'LAX 국제공항',
    arrival_eng: 'LAX airport',
    arrival_is_airport: 'Y',
    reservation_fee: 15,
    local_payment_fee: 65,
    priority: 2
  },
  {
    region: 'CA',
    departure_kor: 'SFO 국제공항',
    departure_eng: 'SFO airport',
    departure_is_airport: 'Y',
    arrival_kor: 'SF 유니언 스퀘어',
    arrival_eng: 'Union Square',
    arrival_is_airport: 'N',
    reservation_fee: 15,
    local_payment_fee: 75,
    priority: 3
  },
  {
    region: 'CA',
    departure_kor: 'SF 유니언 스퀘어',
    departure_eng: 'Union Square',
    departure_is_airport: 'N',
    arrival_kor: 'SFO 국제공항',
    arrival_eng: 'SFO airport',
    arrival_is_airport: 'Y',
    reservation_fee: 15,
    local_payment_fee: 75,
    priority: 4
  },
  {
    region: 'CA',
    departure_kor: 'LA 할리우드',
    departure_eng: 'Hollywood',
    departure_is_airport: 'N',
    arrival_kor: 'LA 베벌리힐스',
    arrival_eng: 'Beverly Hills',
    arrival_is_airport: 'N',
    reservation_fee: 10,
    local_payment_fee: 35,
    priority: 10
  }
];

// 데이터 시드 함수
async function seedData() {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('MongoDB 연결 성공');

    // 명령줄 인수 확인
    const clearExisting = process.argv.includes('--clear');

    if (clearExisting) {
      await TaxiItem.deleteMany({});
      console.log('기존 데이터 삭제 완료');
    }

    // 샘플 데이터 삽입
    const result = await TaxiItem.insertMany(sampleTaxiData);
    console.log(`${result.length}개의 택시 노선 데이터가 추가되었습니다.`);

    // 통계 출력
    const stats = await TaxiItem.aggregate([
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n지역별 노선 수:');
    stats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count}개`);
    });

    console.log('\n시드 작업이 완료되었습니다.');
  } catch (error) {
    console.error('시드 작업 중 오류 발생:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB 연결 종료');
  }
}

// 스크립트 실행
seedData();