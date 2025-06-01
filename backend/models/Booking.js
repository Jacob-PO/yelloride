const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  booking_number: { type: String, required: true, unique: true },
  customer_info: {
    name: String,
    phone: String,
    kakao_id: String
  },
  service_info: {
    type: String,
    region: String
  },
  trip_details: {
    departure: {
      location: String,
      datetime: Date
    },
    arrival: {
      location: String,
      datetime: Date
    }
  },
  vehicles: [{
    type: { type: String, required: true },
    passengers: Number,
    luggage: Number
  }],
  passenger_info: {
    total_passengers: Number,
    total_luggage: Number
  },
  flight_info: {
    flight_number: String,
    terminal: String
  },
  pricing: {
    reservation_fee: Number,
    service_fee: Number,
    vehicle_upgrade_fee: Number,
    total_amount: Number
  },
  status: { type: String, default: 'pending' }
}, { timestamps: true, collection: 'bookings' });

module.exports = mongoose.model('Booking', bookingSchema);
