const request = require('supertest');
const app = require('../server');

describe('Booking API Tests', () => {
  test('should reject vehicles as string', async () => {
    const invalidBooking = {
      customer_info: { name: 'Test', phone: '010-1234-5678' },
      vehicles: '[{"type":"standard","passengers":1,"luggage":0}]'
    };

    const response = await request(app)
      .post('/api/bookings')
      .send(invalidBooking);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.field).toBe('vehicles');
  });

  test('should accept vehicles as array', async () => {
    const validBooking = {
      customer_info: { name: 'Test', phone: '010-1234-5678' },
      vehicles: [{ type: 'standard', passengers: 1, luggage: 0 }]
    };

    const response = await request(app)
      .post('/api/bookings')
      .send(validBooking);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
