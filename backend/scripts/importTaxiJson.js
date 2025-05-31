const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const TaxiItem = require('../models/TaxiItem');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function importFromJson(filePath) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(data)) {
      throw new Error('JSON 파일 형식이 올바르지 않습니다.');
    }

    const result = await TaxiItem.insertMany(data);
    console.log(`${result.length}개의 택시 노선이 추가되었습니다.`);
  } catch (err) {
    console.error('데이터 임포트 오류:', err);
  } finally {
    await mongoose.connection.close();
  }
}

const jsonPath = process.argv[2] || path.resolve(__dirname, '../data/taxiitems.json');
importFromJson(jsonPath);
