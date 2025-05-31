const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const TaxiItem = require('../models/TaxiItem');
require('dotenv').config({ path: '../.env' });

// 엑셀 파일 경로 (명령줄 인수로 받기)
const filePath = process.argv[2];

if (!filePath) {
  console.error('사용법: node importTaxiData.js <엑셀파일경로>');
  console.error('예시: node importTaxiData.js ../data/taxi_routes.xlsx');
  process.exit(1);
}

// 파일 존재 확인
if (!fs.existsSync(filePath)) {
  console.error(`파일을 찾을 수 없습니다: ${filePath}`);
  process.exit(1);
}

// 엑셀 데이터 읽기 및 변환
function readExcelData(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log(`${data.length}개의 행을 읽었습니다.`);
    
    // 데이터 변환
    return data.map((row, index) => {
      // 열 이름 매핑 (한글 또는 영문)
      const item = {
        region: row.region || row.지역 || row.REGION,
        departure_kor: row.departure_kor || row.출발지_한글 || row.출발지한글,
        departure_eng: row.departure_eng || row.출발지_영문 || row.출발지영문,
        departure_is_airport: row.departure_is_airport || row.출발지_공항여부 || row.출발공항여부 || 'N',
        arrival_kor: row.arrival_kor || row.도착지_한글 || row.도착지한글,
        arrival_eng: row.arrival_eng || row.도착지_영문 || row.도착지영문,
        arrival_is_airport: row.arrival_is_airport || row.도착지_공항여부 || row.도착공항여부 || 'N',
        reservation_fee: Number(row.reservation_fee || row.예약료 || row.예약비 || 10),
        local_payment_fee: Number(row.local_payment_fee || row.현지지불료 || row.현지료 || 0),
        priority: Number(row.priority || row.우선순위 || row.순위 || 99),
        is_active: true
      };

      // 유효성 검사
      if (!item.region || !item.departure_kor || !item.arrival_kor) {
        console.warn(`행 ${index + 2}: 필수 필드가 누락되었습니다.`, row);
        return null;
      }

      // 공항 여부 값 정규화
      item.departure_is_airport = item.departure_is_airport.toUpperCase() === 'Y' ? 'Y' : 'N';
      item.arrival_is_airport = item.arrival_is_airport.toUpperCase() === 'Y' ? 'Y' : 'N';

      return item;
    }).filter(item => item !== null); // null 제거
  } catch (error) {
    console.error('엑셀 파일 읽기 오류:', error);
    throw error;
  }
}

// 데이터 임포트 함수
async function importData() {
  try {
    // MongoDB 연결
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('MongoDB 연결 성공');

    // 엑셀 데이터 읽기
    const taxiData = readExcelData(filePath);
    console.log(`유효한 데이터: ${taxiData.length}개`);

    if (taxiData.length === 0) {
      console.error('임포트할 데이터가 없습니다.');
      return;
    }

    // 기존 데이터 처리 옵션
    const clearExisting = process.argv.includes('--clear');
    
    if (clearExisting) {
      const deleteResult = await TaxiItem.deleteMany({});
      console.log(`기존 데이터 ${deleteResult.deletedCount}개 삭제 완료`);
    }

    // 중복 체크 옵션
    const checkDuplicates = !process.argv.includes('--no-check');
    
    if (checkDuplicates && !clearExisting) {
      console.log('중복 데이터 체크 중...');
      const uniqueData = [];
      
      for (const item of taxiData) {
        const existing = await TaxiItem.findOne({
          region: item.region,
          departure_kor: item.departure_kor,
          arrival_kor: item.arrival_kor
        });
        
        if (!existing) {
          uniqueData.push(item);
        } else {
          console.log(`중복 발견: ${item.region} ${item.departure_kor} → ${item.arrival_kor}`);
        }
      }
      
      taxiData.length = 0;
      taxiData.push(...uniqueData);
      console.log(`중복 제거 후: ${taxiData.length}개`);
    }

    // 데이터 삽입
    if (taxiData.length > 0) {
      const result = await TaxiItem.insertMany(taxiData);
      console.log(`${result.length}개의 택시 노선이 성공적으로 임포트되었습니다.`);
    }

    // 임포트 결과 통계
    const stats = await TaxiItem.aggregate([
      {
        $group: {
          _id: '$region',
          count: { $sum: 1 },
          avgReservationFee: { $avg: '$reservation_fee' },
          avgLocalPaymentFee: { $avg: '$local_payment_fee' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('\n=== 임포트 결과 통계 ===');
    console.log('지역별 노선 수 및 평균 요금:');
    stats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count}개 노선, 평균 예약료 $${stat.avgReservationFee.toFixed(0)}, 평균 현지료 $${stat.avgLocalPaymentFee.toFixed(0)}`);
    });

    const totalCount = await TaxiItem.countDocuments();
    console.log(`\n총 ${totalCount}개의 택시 노선이 데이터베이스에 있습니다.`);

  } catch (error) {
    console.error('임포트 중 오류 발생:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB 연결 종료');
  }
}

// 스크립트 실행
importData();