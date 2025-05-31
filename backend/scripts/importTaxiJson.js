const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const TaxiItem = require('../models/TaxiItem');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function importFromJson(filePath, { clear = false } = {}) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data)) {
      throw new Error('JSON 파일 형식이 올바르지 않습니다.');
    }

    if (clear) {
      const del = await TaxiItem.deleteMany({});
      console.log(`기존 데이터 ${del.deletedCount}개 삭제 완료`);
    }

    const result = await TaxiItem.insertMany(data);
    console.log(`${result.length}개의 택시 노선이 추가되었습니다.`);
  } catch (err) {
    console.error('데이터 임포트 오류:', err);
  } finally {
    await mongoose.connection.close();
  }
}

const args = process.argv.slice(2);
const jsonPath = args[0] || path.resolve(__dirname, '../data/taxiitems_full.json');
const clear = args.includes('--clear');

importFromJson(jsonPath, { clear });
