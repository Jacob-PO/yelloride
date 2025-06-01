import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { ArrowLeft, Plus, Minus, X, ChevronRight, MapPin, Clock, Calendar, Search, Info, Plane, Building2, Car, CheckCircle, Phone, Headphones, User, Menu, Globe, FileText, Users, Luggage, CreditCard, Shield, Star, AlertCircle, Check, ChevronDown, Navigation, DollarSign, UserCircle, Settings, LogOut, Home, Briefcase, HelpCircle, ChevronUp, Filter, RefreshCw, Trash2, Download, Upload, Database, Activity, Camera, ShoppingBag } from 'lucide-react';

// 전역 상태 관리
const AppContext = createContext();

// API 서비스 클래스
class YellorideAPI {
  constructor() {
    this.baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://api.yelloride.com/api' 
      : 'http://localhost:5001/api';
    this.timeout = 30000;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        'X-Platform': 'web',
        ...options.headers
      },
      ...options
    };

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('요청 시간이 초과되었습니다.')), this.timeout)
    );

    try {
      const response = await Promise.race([
        fetch(url, config),
        timeoutPromise
      ]);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('서버 응답 에러:', data);
        const errorMessage = data.errorDetails
          ? `서버 에러: ${data.message} (${data.errorName})`
          : data.message || '서버 내부 오류가 발생했습니다.';
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
      }
      
      if (error.message.includes('시간이 초과')) {
        throw new Error('서버 응답이 지연되고 있습니다. 다시 시도해주세요.');
      }
      
      console.error('API 요청 오류:', error);
      throw error;
    }
  }

  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
        
        if (error.message.includes('400') || error.message.includes('401') || 
            error.message.includes('403') || error.message.includes('404')) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }

  async getTaxiItems(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.requestWithRetry(`/taxi?${queryString}`);
  }

  async searchRoute(departure, arrival, lang = 'kor') {
    const paramsObj = { lang };
    if (departure) paramsObj.departure = departure;
    if (arrival) paramsObj.arrival = arrival;
    const params = new URLSearchParams(paramsObj).toString();
    return this.requestWithRetry(`/taxi/route?${params}`);
  }

  async getArrivals(departure, region, lang = 'kor') {
    const paramsObj = { lang };
    if (departure) paramsObj.departure = departure;
    if (region) paramsObj.region = region;
    const params = new URLSearchParams(paramsObj).toString();
    return this.requestWithRetry(`/taxi/arrivals?${params}`);
  }

  async getDepartures(region, lang = 'kor') {
    const paramsObj = { lang };
    if (region) paramsObj.region = region;
    const params = new URLSearchParams(paramsObj).toString();
    return this.requestWithRetry(`/taxi/departures?${params}`);
  }

  async getStats() {
    return this.requestWithRetry('/taxi/stats');
  }

  async getRegions() {
    return this.requestWithRetry('/taxi/regions');
  }

  async getAllTaxiItems() {
    return this.requestWithRetry('/taxi/all');
  }

  validateBookingData(bookingData) {
    const errors = [];

    if (!Array.isArray(bookingData.vehicles)) {
      errors.push('vehicles must be an array');
    }

    if (!bookingData.customer_info?.name) {
      errors.push('customer name is required');
    }

    if (!bookingData.customer_info?.phone) {
      errors.push('customer phone is required');
    }

    return { isValid: errors.length === 0, errors };
  }

  async createBooking(bookingData) {
    const validation = this.validateBookingData(bookingData);
    if (!validation.isValid) {
      console.error('Booking validation failed:', validation.errors);
      return { success: false, message: validation.errors.join(', ') };
    }

    return this.requestWithRetry('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  }

  async getBookingByNumber(bookingNumber) {
    return this.requestWithRetry(`/bookings/number/${bookingNumber}`);
  }

  async searchBooking(bookingNumber) {
    if (!bookingNumber || !bookingNumber.trim()) {
      throw new Error('예약번호를 입력해주세요');
    }

    const normalizedNumber = bookingNumber.trim().toUpperCase();
    return this.requestWithRetry(`/bookings/search?booking_number=${encodeURIComponent(normalizedNumber)}`);
  }

  async updateBooking(bookingId, updateData) {
    return this.requestWithRetry(`/bookings/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
  }

  async cancelBooking(bookingId, reason) {
    return this.requestWithRetry(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`, { 
        timeout: 5000,
        method: 'GET' 
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendFeedback(feedbackData) {
    return this.requestWithRetry('/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackData)
    });
  }
}

// 토스트 컴포넌트 (카카오 T 스타일)
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const typeStyles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-gray-800 text-white'
  };

  return (
    <div className={`fixed bottom-20 left-4 right-4 mx-auto max-w-md p-4 rounded-lg shadow-lg ${typeStyles[type]} z-50`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-4">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// 토스트 훅
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const showToast = (message, type = 'info') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  );

  return { showToast, ToastContainer };
};

// 메인 앱 컴포넌트
const YellorideApp = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedRegion, setSelectedRegion] = useState(() => {
    return localStorage.getItem('selectedRegion') || 'NY';
  });
  const [regionData, setRegionData] = useState({});
  const [loadingRegions, setLoadingRegions] = useState(true);
  const { showToast, ToastContainer } = useToast();
  const [bookingData, setBookingData] = useState({
    departure: null,
    arrival: null,
    region: 'NY',
    serviceType: 'airport',
    step: 1,
    datetime: {
      date: '',
      time: '12:00'
    },
    passengers: 1,
    luggage: 0,
    vehicle: 'standard',
    customer: {
      name: '',
      phone: '',
      kakao: ''
    },
    flight: {
      number: '',
      terminal: ''
    },
    bookingNumber: '',
    totalAmount: 0,
    priceData: null,
    selectedRoute: null
  });

  const api = new YellorideAPI();

  useEffect(() => {
    loadRegionData();
  }, []);

  const loadRegionData = async () => {
    setLoadingRegions(true);
    try {
      const response = await api.getRegions();
      
      if (response.success && response.data) {
        const formattedRegionData = {};
        
        response.data.forEach(region => {
          formattedRegionData[region._id] = {
            name: getRegionName(region._id),
            desc: getRegionDescription(region._id),
            airports: region.airports || [],
            places: region.places || []
          };
        });
        
        setRegionData(formattedRegionData);
      }
    } catch (error) {
      console.error('지역 데이터 로드 오류:', error);
      showToast('지역 정보를 불러오는데 실패했습니다.', 'error');
      setRegionData({});
    } finally {
      setLoadingRegions(false);
    }
  };

  const getRegionName = (code) => {
    const regionNames = {
      'NY': '뉴욕',
      'LA': '로스앤젤레스',
      'CA': '캘리포니아',
      'NJ': '뉴저지',
      'TX': '텍사스',
      'FL': '플로리다',
      'IL': '일리노이',
      'WA': '워싱턴',
      'MA': '매사추세츠'
    };
    return regionNames[code] || code;
  };

  const getRegionDescription = (code) => {
    const descriptions = {
      'NY': '맨해튼, 브루클린, 퀸즈, JFK/LGA 공항',
      'LA': 'LA 지역, LAX 공항',
      'CA': 'LA, 샌프란시스코, LAX/SFO 공항',
      'NJ': '뉴어크, 저지시티, EWR 공항',
      'TX': '휴스턴, 댈러스, IAH/DFW 공항',
      'FL': '마이애미, 올랜도, MIA/MCO 공항',
      'IL': '시카고, ORD/MDW 공항',
      'WA': '시애틀, SEA 공항',
      'MA': '보스턴, BOS 공항'
    };
    return descriptions[code] || '서비스 지역';
  };

  useEffect(() => {
    localStorage.setItem('selectedRegion', selectedRegion);
  }, [selectedRegion]);

  const contextValue = {
    currentPage, setCurrentPage,
    selectedRegion, setSelectedRegion,
    bookingData, setBookingData,
    regionData,
    loadingRegions,
    api,
    showToast
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-100">
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'booking' && <BookingPage />}
        {currentPage === 'search' && <SearchPage />}
        {currentPage === 'confirmation' && <ConfirmationPage />}
        
        <ToastContainer />
      </div>
    </AppContext.Provider>
  );
};

// 홈페이지 컴포넌트 (카카오 T 스타일)
const HomePage = () => {
  const { setCurrentPage, selectedRegion, setSelectedRegion, regionData, loadingRegions, bookingData, setBookingData, api, showToast } = useContext(AppContext);
  const [showLocationSelect, setShowLocationSelect] = useState(false);
  const [selectingType, setSelectingType] = useState('departure');
  const [uniqueDepartures, setUniqueDepartures] = useState([]);
  const [filteredArrivals, setFilteredArrivals] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [selectedTime, setSelectedTime] = useState('오늘 17:00');
  const [selectedHour, setSelectedHour] = useState(17);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [showTimeSelect, setShowTimeSelect] = useState(false);
  const [passengerCount, setPassengerCount] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState('블랙 예약');
  const [priceData, setPriceData] = useState(null);

  useEffect(() => {
    loadAllRoutes();
  }, []);

  useEffect(() => {
    if (bookingData.departure && bookingData.arrival) {
      loadPriceData();
    }
  }, [bookingData.departure, bookingData.arrival]);

  const loadAllRoutes = async () => {
    try {
      setLoadingRoutes(true);
      const response = await api.getAllTaxiItems();
      if (response.success && Array.isArray(response.data)) {
        const itemsWithPrice = response.data.filter(route => 
          Number(route.reservation_fee) > 0 && Number(route.local_payment_fee) > 0
        );
        setAllRoutes(itemsWithPrice);
        
        // 현재 지역의 출발지 목록 생성
        const map = new Map();
        itemsWithPrice.forEach(r => {
          if (r.region === selectedRegion) {
            if (!map.has(r.departure_kor)) {
              map.set(r.departure_kor, {
                full_kor: r.departure_kor,
                name_kor: formatKorName(r.departure_kor),
                name_eng: r.departure_eng,
                is_airport: r.departure_is_airport,
              });
            }
          }
        });
        setUniqueDepartures(Array.from(map.values()));
      } else {
        setAllRoutes([]);
      }
    } catch (error) {
      console.error('전체 노선 로드 오류:', error);
      setAllRoutes([]);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const loadPriceData = async () => {
    try {
      const response = await api.searchRoute(bookingData.departure, bookingData.arrival, 'kor');
      if (response.success && response.data) {
        setPriceData({
          reservation_fee: response.data.reservation_fee,
          local_payment_fee: response.data.local_payment_fee,
          total: response.data.reservation_fee + response.data.local_payment_fee
        });
      }
    } catch (error) {
      console.error('가격 조회 오류:', error);
      setPriceData({
        reservation_fee: 20,
        local_payment_fee: 60,
        total: 80
      });
    }
  };

  const formatKorName = (full) => {
    if (!full) return '';
    return full
      .replace(/^\w+\s+/, '')
      .split(' - ')[0];
  };

  const selectLocation = (type) => {
    setSelectingType(type);
    setShowLocationSelect(true);
    
    if (type === 'arrival' && bookingData.departure) {
      // 출발지가 선택된 경우 도착지 목록 필터링
      const map = new Map();
      allRoutes.forEach(r => {
        if (r.region === selectedRegion && r.departure_kor === bookingData.departure) {
          if (!map.has(r.arrival_kor)) {
            map.set(r.arrival_kor, {
              full_kor: r.arrival_kor,
              name_kor: formatKorName(r.arrival_kor),
              name_eng: r.arrival_eng,
              is_airport: r.arrival_is_airport,
            });
          }
        }
      });
      setFilteredArrivals(Array.from(map.values()));
    }
  };

  const setLocation = (location) => {
    const locationValue = location.full_kor || location.name_kor || location;
    setBookingData(prev => {
      const updated = { ...prev, [selectingType]: locationValue };
      if (selectingType === 'departure') {
        updated.arrival = null;
      }
      return updated;
    });
    setShowLocationSelect(false);

    if (selectingType === 'arrival' && bookingData.departure) {
      setShowBookingSheet(true);
    }
  };

  const completeBooking = async () => {
    if (!bookingData.departure || !bookingData.arrival) {
      showToast('출발지와 도착지를 선택해주세요.', 'error');
      return;
    }

    try {
      const bookingRequest = {
        customer_info: {
          name: '예약자',
          phone: '010-0000-0000',
          kakao_id: ''
        },
        service_info: {
          type: 'airport',
          region: selectedRegion
        },
        trip_details: {
          departure: {
            location: bookingData.departure,
            datetime: new Date()
          },
          arrival: {
            location: bookingData.arrival
          }
        },
        vehicles: [{
          type: selectedVehicle === '블랙 예약' ? 'premium' : 'standard',
          passengers: passengerCount,
          luggage: 0
        }],
        passenger_info: {
          total_passengers: passengerCount,
          total_luggage: 0
        },
        pricing: {
          reservation_fee: priceData?.reservation_fee || 20,
          service_fee: priceData?.local_payment_fee || 60,
          vehicle_upgrade_fee: selectedVehicle === '블랙 예약' ? 20 : 0,
          total_amount: priceData?.total || 80
        }
      };

      const response = await api.createBooking(bookingRequest);
      
      if (response.success) {
        setBookingData(prev => ({
          ...prev,
          bookingNumber: response.data.booking_number || 'YR' + Date.now().toString().slice(-6),
          totalAmount: response.data.total_amount || priceData?.total || 80
        }));
        
        showToast('예약이 완료되었습니다!', 'success');
        setShowBookingSheet(false);
        setCurrentPage('confirmation');
      } else {
        throw new Error(response.message || '예약 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('예약 실패:', error);
      showToast(error.message || '예약 중 오류가 발생했습니다.', 'error');
    }
  };

  const locationList = selectingType === 'departure' ? uniqueDepartures : filteredArrivals;
  const airportsList = locationList.filter(l => l.is_airport === 'Y' || l.is_airport === true);
  const placesList = locationList.filter(l => !(l.is_airport === 'Y' || l.is_airport === true));

  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* 상단 검색 바 */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white shadow-md">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => selectLocation('departure')}
              className="flex-1 bg-gray-100 rounded-lg p-4 text-left"
            >
              {bookingData.departure ? (
                <div>
                  <div className="text-sm text-gray-600">출발</div>
                  <div className="font-semibold">{formatKorName(bookingData.departure)}</div>
                </div>
              ) : (
                <div className="text-gray-500">어디로 갈까요?</div>
              )}
            </button>
            
            <button className="p-2">
              <div className="text-sm text-gray-600">지금 출발 ˅</div>
            </button>
          </div>
          
          <div className="flex gap-2 mt-3">
            <button className="px-3 py-1 border border-gray-300 rounded-full text-sm flex items-center gap-1">
              <Plus className="w-3 h-3" /> 집
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-full text-sm flex items-center gap-1">
              <Plus className="w-3 h-3" /> 회사
            </button>
            <span className="px-3 py-1 text-sm text-gray-500">경기 화성시 능동 1178</span>
          </div>
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="h-screen bg-gray-200 flex items-center justify-center">
        <div className="text-gray-500">지도 영역</div>
      </div>

      {/* 하단 서비스 메뉴 */}
      <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-3xl shadow-lg p-4">
        <div className="grid grid-cols-5 gap-4">
          <button 
            onClick={() => setShowBookingSheet(true)}
            className="flex flex-col items-center"
          >
            <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center mb-2">
              <Car className="w-6 h-6" />
            </div>
            <span className="text-xs">택시</span>
          </button>
          <button 
            onClick={() => {
              setBookingData(prev => ({ ...prev, serviceType: 'airport' }));
              setCurrentPage('booking');
            }}
            className="flex flex-col items-center"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs">택시예약</span>
          </button>
          <button className="flex flex-col items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
              <div className="text-2xl">🏍️</div>
            </div>
            <span className="text-xs">바이크</span>
          </button>
          <button className="flex flex-col items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
              <div className="text-xl">P</div>
            </div>
            <span className="text-xs">주차</span>
          </button>
          <button className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-2">
              <div className="text-2xl">🚙</div>
            </div>
            <span className="text-xs">대리</span>
          </button>
        </div>
        
        <div className="mt-4 bg-blue-500 text-white rounded-lg p-3 flex items-center gap-2">
          <div className="text-2xl">🗣️</div>
          <div className="flex-1">
            <div className="font-semibold">숨은 꿀팁, 1분 안에 알아봐요!</div>
            <div className="text-sm opacity-90">#여행 #주차 #전기차충전 숨겨진 팁 대방출</div>
          </div>
        </div>
      </div>

      {/* 하단 탭 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="flex">
          <button className="flex-1 py-3 flex flex-col items-center gap-1">
            <Home className="w-5 h-5" />
            <span className="text-xs">홈</span>
          </button>
          <button className="flex-1 py-3 flex flex-col items-center gap-1">
            <div className="w-5 h-5 bg-gray-300 rounded" />
            <span className="text-xs">비즈니스</span>
          </button>
          <button 
            onClick={() => setCurrentPage('search')}
            className="flex-1 py-3 flex flex-col items-center gap-1"
          >
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-xs text-gray-600">이용/알림</span>
          </button>
          <button className="flex-1 py-3 flex flex-col items-center gap-1">
            <User className="w-5 h-5 text-gray-400" />
            <span className="text-xs text-gray-600">내 정보</span>
          </button>
        </div>
      </div>

      {/* 위치 선택 화면 */}
      {showLocationSelect && (
        <div className="fixed inset-0 bg-white z-50">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={() => setShowLocationSelect(false)}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-semibold">
              {selectingType === 'departure' ? '출발지 선택' : '도착지 선택'}
            </h3>
            <div className="w-6" />
          </div>

          <div className="p-4">
            {loadingRoutes ? (
              <div className="text-center py-8">
                <div className="text-gray-500">로딩 중...</div>
              </div>
            ) : (
              <div className="space-y-6">
                {airportsList.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Plane className="w-5 h-5 text-gray-400" />
                      공항
                    </h4>
                    <div className="space-y-2">
                      {airportsList.map((location, index) => (
                        <button
                          key={index}
                          className="w-full p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50"
                          onClick={() => setLocation(location)}
                        >
                          <div className="font-medium">{location.name_kor}</div>
                          <div className="text-sm text-gray-500">{location.name_eng || ''}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {placesList.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      일반 지역
                    </h4>
                    <div className="space-y-2">
                      {placesList.map((location, index) => (
                        <button
                          key={index}
                          className="w-full p-4 border border-gray-200 rounded-lg text-left hover:bg-gray-50"
                          onClick={() => setLocation(location)}
                        >
                          <div className="font-medium">{location.name_kor}</div>
                          <div className="text-sm text-gray-500">{location.name_eng || ''}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 예약 시트 */}
      {showBookingSheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowBookingSheet(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            
            {bookingData.departure && bookingData.arrival ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-sm text-gray-600">출발</span>
                  </div>
                  <div className="font-semibold mb-4">{formatKorName(bookingData.departure)}</div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-sm text-gray-600">도착</span>
                  </div>
                  <div className="font-semibold">{formatKorName(bookingData.arrival)}</div>
                </div>

                <div className="border-t pt-4 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-600">출발 시간</span>
                    <button 
                      onClick={() => setShowTimeSelect(true)}
                      className="text-blue-500 font-medium"
                    >
                      {selectedTime} ›
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">탑승 인원</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
                        className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center">{passengerCount}</span>
                      <button 
                        onClick={() => setPassengerCount(Math.min(5, passengerCount + 1))}
                        className="w-8 h-8 border border-blue-500 text-blue-500 rounded-full flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <button
                    onClick={() => setSelectedVehicle('벤티 예약')}
                    className={`w-full p-4 border rounded-lg text-left ${
                      selectedVehicle === '벤티 예약' ? 'border-gray-400 bg-gray-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Car className="w-8 h-8 text-yellow-500" />
                      <div>
                        <div className="font-medium">벤티 예약</div>
                        <div className="text-sm text-gray-500">넓고 쾌적한 카카오 T 벤티</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setSelectedVehicle('블랙 예약')}
                    className={`w-full p-4 border rounded-lg text-left ${
                      selectedVehicle === '블랙 예약' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Car className="w-8 h-8 text-black" />
                      <div>
                        <div className="font-medium">블랙 예약</div>
                        <div className="text-sm text-gray-500">프리미엄한 카카오 T 블랙</div>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <div>
                    <div className="text-sm text-gray-500">예약 요금</div>
                    <div className="text-2xl font-bold">${priceData?.total || 80}</div>
                  </div>
                  <button 
                    onClick={completeBooking}
                    className="bg-blue-500 text-white px-8 py-4 rounded-lg font-medium"
                  >
                    예약하기
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <button
                  onClick={() => {
                    setShowBookingSheet(false);
                    selectLocation('departure');
                  }}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg"
                >
                  출발지 선택하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 시간 선택 모달 */}
      {showTimeSelect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowTimeSelect(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            
            <h3 className="text-lg font-semibold mb-6">출발 시간</h3>
            
            <div className="flex justify-center items-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">오늘</div>
                <div className="text-4xl font-bold text-blue-500">{selectedHour}</div>
              </div>
              <div className="text-3xl font-bold">:</div>
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">00</div>
                <div className="text-4xl font-bold text-blue-500">{selectedMinute.toString().padStart(2, '0')}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowTimeSelect(false)}
                className="py-4 border border-gray-300 rounded-lg"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  setSelectedTime(`오늘 ${selectedHour}:${selectedMinute.toString().padStart(2, '0')}`);
                  setShowTimeSelect(false);
                }}
                className="py-4 bg-blue-500 text-white rounded-lg font-medium"
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 예약 페이지 컴포넌트
const BookingPage = () => {
  const { setCurrentPage, bookingData, setBookingData, api, showToast } = useContext(AppContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [passengerCount, setPassengerCount] = useState(1);
  const [vehicleType, setVehicleType] = useState('블랙 예약');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    requests: ''
  });

  const handleBooking = async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      showToast('이름과 전화번호를 입력해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      const bookingRequest = {
        customer_info: {
          name: customerInfo.name,
          phone: customerInfo.phone,
          kakao_id: ''
        },
        service_info: {
          type: bookingData.serviceType,
          region: bookingData.region
        },
        trip_details: {
          departure: {
            location: bookingData.departure || '출발지',
            datetime: new Date()
          },
          arrival: {
            location: bookingData.arrival || '도착지'
          }
        },
        vehicles: [{
          type: vehicleType === '블랙 예약' ? 'premium' : 'standard',
          passengers: passengerCount,
          luggage: 0
        }],
        passenger_info: {
          total_passengers: passengerCount,
          total_luggage: 0
        },
        pricing: {
          reservation_fee: 20,
          service_fee: 60,
          vehicle_upgrade_fee: vehicleType === '블랙 예약' ? 20 : 0,
          total_amount: 80
        }
      };

      const response = await api.createBooking(bookingRequest);
      
      if (response.success) {
        setBookingData(prev => ({
          ...prev,
          bookingNumber: response.data.booking_number || 'YR' + Date.now().toString().slice(-6),
          totalAmount: response.data.total_amount || 80,
          customer: customerInfo
        }));
        
        showToast('예약이 완료되었습니다!', 'success');
        setCurrentPage('confirmation');
      } else {
        throw new Error(response.message || '예약 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('예약 실패:', error);
      showToast(error.message || '예약 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="flex items-center p-4">
          <button onClick={() => setCurrentPage('home')}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h3 className="ml-4 text-lg font-semibold">예약하기</h3>
        </div>
      </div>

      <div className="p-4">
        {currentStep === 1 && (
          <div className="bg-white rounded-lg p-6 mb-4">
            <h4 className="font-semibold mb-4">탑승 정보</h4>
            
            <div className="mb-6">
              <label className="text-sm text-gray-600 mb-2 block">탑승자</label>
              <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                <span>본인탑승</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div className="mb-6">
              <label className="text-sm text-gray-600 mb-2 block">탑승 인원</label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">최대 5명 탑승</span>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
                    className="w-8 h-8 border rounded-full flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center">{passengerCount}</span>
                  <button 
                    onClick={() => setPassengerCount(Math.min(5, passengerCount + 1))}
                    className="w-8 h-8 border border-blue-500 text-blue-500 rounded-full flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block">요청사항</label>
              <textarea
                placeholder="(예시) 캐리어 1개가 있어요."
                className="w-full p-3 bg-gray-50 rounded-lg resize-none h-20"
                value={customerInfo.requests}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, requests: e.target.value }))}
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="bg-white rounded-lg p-6 mb-4">
            <h4 className="font-semibold mb-4">결제 정보</h4>
            
            <button className="w-full bg-blue-50 text-blue-500 p-4 rounded-lg flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <span>결제수단 등록</span>
              </div>
              <div className="text-sm">
                쿠폰 | 포인트 0P ›
              </div>
            </button>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">예약 요금</span>
                <span className="text-xl font-bold">80,000원</span>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="bg-white rounded-lg p-6 mb-4">
            <h4 className="font-semibold mb-4">예약자 정보</h4>
            
            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-2 block">이름</label>
              <input
                type="text"
                placeholder="이름을 입력하세요"
                className="w-full p-3 bg-gray-50 rounded-lg"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-2 block">전화번호</label>
              <input
                type="tel"
                placeholder="010-0000-0000"
                className="w-full p-3 bg-gray-50 rounded-lg"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t">
          {currentStep < 3 ? (
            <button 
              onClick={() => setCurrentStep(currentStep + 1)}
              className="w-full bg-blue-500 text-white py-4 rounded-lg font-medium"
            >
              다음
            </button>
          ) : (
            <button 
              onClick={handleBooking}
              disabled={loading}
              className="w-full bg-blue-500 text-white py-4 rounded-lg font-medium disabled:bg-gray-300"
            >
              {loading ? '처리 중...' : '80,000원 블랙 예약하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// 예약 조회 페이지
const SearchPage = () => {
  const { setCurrentPage, api, showToast } = useContext(AppContext);
  const [searchValue, setSearchValue] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      showToast('예약번호를 입력해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await api.searchBooking(searchValue);
      
      if (response.success && response.data) {
        setBooking(response.data);
      } else {
        setBooking(null);
        showToast('예약을 찾을 수 없습니다.', 'error');
      }
    } catch (error) {
      console.error('검색 오류:', error);
      setBooking(null);
      showToast('예약 조회 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="flex items-center p-4">
          <button onClick={() => setCurrentPage('home')}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h3 className="ml-4 text-lg font-semibold">예약 조회</h3>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-lg p-6 mb-4">
          <div className="text-center mb-6">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold mb-2">예약 내역을 조회하세요</h4>
            <p className="text-sm text-gray-600">예약번호를 입력해주세요</p>
          </div>

          <input
            type="text"
            placeholder="예: YR145DD9"
            className="w-full p-3 bg-gray-50 rounded-lg mb-4"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />

          <button 
            onClick={handleSearch}
            disabled={loading || !searchValue.trim()}
            className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium disabled:bg-gray-300"
          >
            {loading ? '조회 중...' : '조회하기'}
          </button>
        </div>

        {booking && (
          <div className="bg-white rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-semibold text-lg">{booking.booking_number}</h4>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${
                  booking.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                  booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                  booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {booking.status === 'confirmed' ? '예약 확정' :
                   booking.status === 'completed' ? '완료' :
                   booking.status === 'cancelled' ? '취소됨' :
                   '예약 대기'}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-500">
                  ${booking.pricing?.total_amount || 0}
                </div>
                <div className="text-sm text-gray-500">총 요금</div>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm text-gray-500">출발</div>
                  <div className="font-medium">{booking.trip_details?.departure?.location || '-'}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Navigation className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm text-gray-500">도착</div>
                  <div className="font-medium">{booking.trip_details?.arrival?.location || '-'}</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm text-gray-500">일시</div>
                  <div className="font-medium">
                    {new Date(booking.trip_details?.departure?.datetime).toLocaleString('ko-KR')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex">
          <button 
            onClick={() => setCurrentPage('home')}
            className="flex-1 py-3 flex flex-col items-center gap-1"
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">홈</span>
          </button>
          <button className="flex-1 py-3 flex flex-col items-center gap-1">
            <div className="w-5 h-5 bg-gray-300 rounded" />
            <span className="text-xs">비즈니스</span>
          </button>
          <button className="flex-1 py-3 flex flex-col items-center gap-1 text-black">
            <Clock className="w-5 h-5" />
            <span className="text-xs">이용/알림</span>
          </button>
          <button className="flex-1 py-3 flex flex-col items-center gap-1">
            <User className="w-5 h-5 text-gray-400" />
            <span className="text-xs text-gray-600">내 정보</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// 예약 확인 페이지
const ConfirmationPage = () => {
  const { setCurrentPage, bookingData } = useContext(AppContext);
  const [copied, setCopied] = useState(false);

  const copyBookingNumber = async () => {
    const bookingNumber = bookingData.bookingNumber || 'YR241201DEMO';
    
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(bookingNumber);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = bookingNumber;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('복사 실패:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-500 p-8 text-center text-white">
        <CheckCircle className="w-16 h-16 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">예약이 완료되었습니다!</h2>
        <p>곧 기사님이 배정될 예정입니다</p>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-lg p-6 mb-4 -mt-8 relative shadow-lg">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-600 mb-2">예약번호</div>
            <div className="text-2xl font-bold tracking-wider mb-3">
              {bookingData.bookingNumber || 'YR241201DEMO'}
            </div>
            <button 
              onClick={copyBookingNumber}
              className="text-blue-500 text-sm font-medium"
            >
              {copied ? '복사완료!' : '복사하기'}
            </button>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex justify-between">
              <span className="text-gray-600">서비스</span>
              <span className="font-medium">공항 택시</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">출발</span>
              <span className="font-medium">{bookingData.departure || '출발지'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">도착</span>
              <span className="font-medium">{bookingData.arrival || '도착지'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">예약자</span>
              <span className="font-medium">{bookingData.customer?.name || '예약자'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">총 요금</span>
              <span className="font-bold text-lg text-blue-500">
                ${bookingData.totalAmount || '80'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            이용 안내
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 예약 확정 후 기사님 정보를 문자로 안내드립니다</li>
            <li>• 출발 1시간 전까지 취소 가능합니다</li>
            <li>• 기사님께 예약번호를 알려주세요</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setCurrentPage('search')}
            className="py-3 border border-gray-300 rounded-lg"
          >
            예약 내역
          </button>
          <button 
            onClick={() => setCurrentPage('home')}
            className="py-3 bg-blue-500 text-white rounded-lg font-medium"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
};

export default YellorideApp;
