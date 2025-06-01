const request = require('supertest');
const app = require('../server');

describe('Booking API Tests', () => {
  test('should create booking', async () => {
    const validBooking = {
      customer_info: { name: 'Test', phone: '010-1234-5678' },
      service_info: { type: 'airport', region: 'NY' },
      trip_details: {
        departure: { location: 'Test Departure', datetime: new Date().toISOString() }
      },
      vehicles: [{ type: 'standard', passengers: 1, luggage: 0 }],
      pricing: { total_amount: 100 }
    };

    const response = await request(app)
      .post('/api/bookings')
      .send(validBooking);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
