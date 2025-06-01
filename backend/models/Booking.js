const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  booking_number: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  customer_info: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    kakao_id: { type: String }
  },
  
  // service_info as object
  service_info: {
    type: { type: String, required: true },
    region: { type: String, required: true }
  },
  
  trip_details: {
    departure: {
      location: { type: String, required: true },
      datetime: { type: Date, required: true }
    },
    arrival: {
      location: { type: String, required: true },
      datetime: { type: Date }  // optional arrival time
    }
  },
  
  // vehicles is array
  vehicles: [{
    type: { type: String, required: true },
    passengers: { type: Number, default: 0 },
    luggage: { type: Number, default: 0 }
  }],
  
  passenger_info: {
    total_passengers: { type: Number },
    total_luggage: { type: Number }
  },
  
  flight_info: {
    flight_number: { type: String },
    terminal: { type: String }
  },
  
  pricing: {
    reservation_fee: { type: Number, default: 0 },
    service_fee: { type: Number, default: 0 },
    vehicle_upgrade_fee: { type: Number, default: 0 },
    total_amount: { type: Number, required: true }
  },
  
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending' 
  }
  
}, { 
  timestamps: true  // createdAt, updatedAt automatically added
});

bookingSchema.index({ booking_number: 1 });
bookingSchema.index({ 'customer_info.phone': 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
