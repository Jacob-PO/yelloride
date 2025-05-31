require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 모델 import
const User = require('../models/User');
const Taxi = require('../models/Taxi');
const Route = require('../models/Route');
const Booking = require('../models/Booking');

// MongoDB 연결
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yelloride', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// 샘플 데이터
const sampleUsers = [
  {
    name: '김민수',
    email: 'minsu@example.com',
    password: 'password123',
    phone: '010-1234-5678',
    role: 'user'
  },
  {
    name: '이영희',
    email: 'younghee@example.com',
    password: 'password123',
    phone: '010-2345-6789',
    role: 'user'
  },
  {
    name: '박철수',
    email: 'chulsoo@example.com',
    password: 'password123',
    phone: '010-3456-7890',
    role: 'driver'
  },
  {
    name: '정미경',
    email: 'mikyung@example.com',
    password: 'password123',
    phone: '010-4567-8901',
    role: 'driver'
  },
  {
    name: '관리자',
    email: 'admin@yelloride.com',
    password: 'admin123',
    phone: '010-0000-0000',
    role: 'admin'
  }
];

const sampleTaxis = [
  {
    taxiNumber: 'TN001',
    driverName: '박철수',
    licenseNumber: '서울12가3456',
    model: '현대 쏘나타',
    color: '검정',
    year: 2022,
    capacity: 4,
    status: 'available',
    currentLocation: {
      type: 'Point',
      coordinates: [126.9668, 37.5729] // 은평구 좌표
    }
  },
  {
    taxiNumber: 'TN002',
    driverName: '정미경',
    licenseNumber: '서울34나5678',
    model: 'K5',
    color: '흰색',
    year: 2021,
    capacity: 4,
    status: 'available',
    currentLocation: {
      type: 'Point',
      coordinates: [126.9200, 37.5600] // 은평구 인근
    }
  },
  {
    taxiNumber: 'TN003',
    driverName: '최준호',
    licenseNumber: '서울56다7890',
    model: '그랜저',
    color: '회색',
    year: 2023,
    capacity: 5,
    status: 'available',
    currentLocation: {
      type: 'Point',
      coordinates: [126.9500, 37.5800] // 은평구 인근
    }
  },
  {
    taxiNumber: 'TN004',
    driverName: '강민정',
    licenseNumber: '서울78라9012',
    model: '아반떼',
    color: '파랑',
    year: 2020,
    capacity: 4,
    status: 'busy',
    currentLocation: {
      type: 'Point',
      coordinates: [126.9300, 37.5700] // 은평구 인근
    }
  },
  {
    taxiNumber: 'TN005',
    driverName: '윤상현',
    licenseNumber: '서울90마3456',
    model: '카니발',
    color: '은색',
    year: 2022,
    capacity: 7,
    status: 'offline',
    currentLocation: {
      type: 'Point',
      coordinates: [126.9400, 37.5650] // 은평구 인근
    }
  }
];

const sampleRoutes = [
  {
    name: '은평구청 - 서울역',
    description: '은평구청에서 서울역까지 주요 노선',
    startPoint: {
      name: '은평구청',
      coordinates: {
        type: 'Point',
        coordinates: [126.9292, 37.6023]
      }
    },
    endPoint: {
      name: '서울역',
      coordinates: {
        type: 'Point',
        coordinates: [126.9726, 37.5547]
      }
    },
    waypoints: [
      {
        name: '불광역',
        coordinates: {
          type: 'Point',
          coordinates: [126.9301, 37.6101]
        }
      },
      {
        name: '독립문역',
        coordinates: {
          type: 'Point',
          coordinates: [126.9579, 37.5743]
        }
      }
    ],
    estimatedTime: 25,
    estimatedDistance: 8.5,
    baseFare: 15000
  },
  {
    name: '은평구청 - 강남역',
    description: '은평구청에서 강남역까지 주요 노선',
    startPoint: {
      name: '은평구청',
      coordinates: {
        type: 'Point',
        coordinates: [126.9292, 37.6023]
      }
    },
    endPoint: {
      name: '강남역',
      coordinates: {
        type: 'Point',
        coordinates: [127.0276, 37.4979]
      }
    },
    waypoints: [
      {
        name: '연신내역',
        coordinates: {
          type: 'Point',
          coordinates: [126.9209, 37.6188]
        }
      },
      {
        name: '종로3가역',
        coordinates: {
          type: 'Point',
          coordinates: [126.9917, 37.5716]
        }
      }
    ],
    estimatedTime: 40,
    estimatedDistance: 18.2,
    baseFare: 25000
  },
  {
    name: '디지털미디어시티역 - 인천공항',
    description: 'DMC역에서 인천국제공항까지 공항노선',
    startPoint: {
      name: '디지털미디어시티역',
      coordinates: {
        type: 'Point',
        coordinates: [126.9007, 37.5764]
      }
    },
    endPoint: {
      name: '인천국제공항',
      coordinates: {
        type: 'Point',
        coordinates: [126.4407, 37.4601]
      }
    },
    waypoints: [
      {
        name: '김포공항',
        coordinates: {
          type: 'Point',
          coordinates: [126.8011, 37.5587]
        }
      }
    ],
    estimatedTime: 60,
    estimatedDistance: 48.7,
    baseFare: 55000
  },
  {
    name: '연신내역 순환노선',
    description: '연신내역 중심 은평구 내 순환노선',
    startPoint: {
      name: '연신내역',
      coordinates: {
        type: 'Point',
        coordinates: [126.9209, 37.6188]
      }
    },
    endPoint: {
      name: '연신내역',
      coordinates: {
        type: 'Point',
        coordinates: [126.9209, 37.6188]
      }
    },
    waypoints: [
      {
        name: '불광역',
        coordinates: {
          type: 'Point',
          coordinates: [126.9301, 37.6101]
        }
      },
      {
        name: '구산역',
        coordinates: {
          type: 'Point',
          coordinates: [126.9185, 37.6111]
        }
      },
      {
        name: '역촌역',
        coordinates: {
          type: 'Point',
          coordinates: [126.9162, 37.6062]
        }
      }
    ],
    estimatedTime: 20,
    estimatedDistance: 6.8,
    baseFare: 10000
  }
];

// 데이터 시딩 함수
const seedData = async () => {
  try {
    // 기존 데이터 삭제
    console.log('Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Taxi.deleteMany({}),
      Route.deleteMany({}),
      Booking.deleteMany({})
    ]);

    // 사용자 생성
    console.log('Creating users...');
    const hashedUsers = await Promise.all(
      sampleUsers.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10)
      }))
    );
    const users = await User.insertMany(hashedUsers);
    console.log(`Created ${users.length} users`);

    // 택시 생성 (driver 연결)
    console.log('Creating taxis...');
    const drivers = users.filter(user => user.role === 'driver');
    const taxisWithDrivers = sampleTaxis.map((taxi, index) => {
      if (index < drivers.length) {
        return { ...taxi, driver: drivers[index]._id };
      }
      return taxi;
    });
    const taxis = await Taxi.insertMany(taxisWithDrivers);
    console.log(`Created ${taxis.length} taxis`);

    // 노선 생성
    console.log('Creating routes...');
    const routes = await Route.insertMany(sampleRoutes);
    console.log(`Created ${routes.length} routes`);

    // 샘플 예약 생성
    console.log('Creating sample bookings...');
    const customers = users.filter(user => user.role === 'user');
    const sampleBookings = [
      {
        customer: customers[0]._id,
        taxi: taxis[0]._id,
        route: routes[0]._id,
        pickupLocation: routes[0].startPoint.name,
        pickupCoordinates: {
          type: 'Point',
          coordinates: routes[0].startPoint.coordinates.coordinates
        },
        dropoffLocation: routes[0].endPoint.name,
        dropoffCoordinates: {
          type: 'Point',
          coordinates: routes[0].endPoint.coordinates.coordinates
        },
        pickupTime: new Date(Date.now() + 3600000), // 1시간 후
        fare: routes[0].baseFare,
        distance: routes[0].estimatedDistance,
        duration: routes[0].estimatedTime,
        status: 'confirmed'
      },
      {
        customer: customers[1]._id,
        taxi: taxis[1]._id,
        route: routes[1]._id,
        pickupLocation: routes[1].startPoint.name,
        pickupCoordinates: {
          type: 'Point',
          coordinates: routes[1].startPoint.coordinates.coordinates
        },
        dropoffLocation: routes[1].endPoint.name,
        dropoffCoordinates: {
          type: 'Point',
          coordinates: routes[1].endPoint.coordinates.coordinates
        },
        pickupTime: new Date(Date.now() + 7200000), // 2시간 후
        fare: routes[1].baseFare,
        distance: routes[1].estimatedDistance,
        duration: routes[1].estimatedTime,
        status: 'pending'
      },
      {
        customer: customers[0]._id,
        taxi: taxis[2]._id,
        route: routes[2]._id,
        pickupLocation: routes[2].startPoint.name,
        pickupCoordinates: {
          type: 'Point',
          coordinates: routes[2].startPoint.coordinates.coordinates
        },
        dropoffLocation: routes[2].endPoint.name,
        dropoffCoordinates: {
          type: 'Point',
          coordinates: routes[2].endPoint.coordinates.coordinates
        },
        pickupTime: new Date(Date.now() - 86400000), // 1일 전
        fare: routes[2].baseFare,
        distance: routes[2].estimatedDistance,
        duration: routes[2].estimatedTime,
        status: 'completed',
        completedAt: new Date(Date.now() - 82800000),
        actualPickupTime: new Date(Date.now() - 86400000),
        actualDropoffTime: new Date(Date.now() - 82800000),
        rating: 5,
        review: '친절하고 안전운전 해주셨습니다!'
      }
    ];
    
    const bookings = await Booking.insertMany(sampleBookings);
    console.log(`Created ${bookings.length} sample bookings`);

    console.log('\n=== Seed Data Summary ===');
    console.log(`Users: ${users.length}`);
    console.log(`Taxis: ${taxis.length}`);
    console.log(`Routes: ${routes.length}`);
    console.log(`Bookings: ${bookings.length}`);
    
    console.log('\n=== Login Credentials ===');
    console.log('User: minsu@example.com / password123');
    console.log('Driver: chulsoo@example.com / password123');
    console.log('Admin: admin@yelloride.com / admin123');
    
    console.log('\nSeed data inserted successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// 실행
(async () => {
  await connectDB();
  await seedData();
})();