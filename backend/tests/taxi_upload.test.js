const request = require('supertest');
const app = require('../server');

describe('Taxi Item Bulk Upload', () => {
  test('should upload items', async () => {
    const items = [
      {
        region: 'TEST',
        departure_kor: '출발',
        departure_eng: 'Start',
        departure_is_airport: 'N',
        arrival_kor: '도착',
        arrival_eng: 'End',
        arrival_is_airport: 'N',
        reservation_fee: 10,
        local_payment_fee: 20,
        priority: 1
      }
    ];

    const res = await request(app)
      .post('/api/taxi/bulk')
      .send({ items });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(items.length);
  });
});
