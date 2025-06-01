import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { ArrowLeft, Plus, Minus, X, ChevronRight, MapPin, Clock, Calendar, Search, Info, Plane, Building2, Car, CheckCircle, Phone, Headphones, User, Menu, Globe, FileText, Users, Luggage, CreditCard, Shield, Star, AlertCircle, Check, ChevronDown, Navigation, DollarSign, UserCircle, Settings, LogOut, Home, Briefcase, HelpCircle, ChevronUp, Filter, RefreshCw, Trash2, Download, Upload, Database, Activity, Camera, ShoppingBag, MessageCircle, Bell, Heart } from 'lucide-react';

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

// 토스트 컴포넌트
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const typeStyles = {
    success: 'bg-gradient-to-r from-green-500 to-emerald-500',
    error: 'bg-gradient-to-r from-red-500 to-rose-500',
    warning: 'bg-gradient-to-r from-yellow-500 to-amber-500',
    info: 'bg-gradient-to-r from-blue-500 to-indigo-500'
  };

  return (
    <div className={`fixed top-8 left-1/2 transform -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl ${typeStyles[type]} text-white z-50 animate-bounce-in max-w-sm`}>
      <div className="flex items-center gap-3">
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-80 transition-opacity">
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

// 커스텀 CSS 애니메이션
const customStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  @keyframes scaleUp {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @keyframes bounce-in {
    0% { transform: translateX(-50%) translateY(-100px); opacity: 0; }
    60% { transform: translateX(-50%) translateY(10px); }
    100% { transform: translateX(-50%) translateY(0); opacity: 1; }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
  .animate-slideUp { animation: slideUp 0.4s ease-out; }
  .animate-scaleUp { animation: scaleUp 0.3s ease-out; }
  .animate-bounce-in { animation: bounce-in 0.5s ease-out; }
  .animate-pulse { animation: pulse 2s ease-in-out infinite; }

  .glass-effect {
    backdrop-filter: blur(20px);
    background: rgba(255, 255, 255, 0.85);
  }

  .gradient-border {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2px;
  }

  .hover-lift {
    transition: all 0.3s ease;
  }

  .hover-lift:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  }
`;

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
      <style>{customStyles}</style>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'booking' && <BookingPage />}
        {currentPage === 'search' && <SearchPage />}
        {currentPage === 'confirmation' && <ConfirmationPage />}
        
        <ToastContainer />
      </div>
    </AppContext.Provider>
  );
};

// 홈페이지 컴포넌트
const HomePage = () => {
  const { setCurrentPage, selectedRegion, setSelectedRegion, regionData, loadingRegions, bookingData, setBookingData, api, showToast } = useContext(AppContext);
  const [showDestinationSelect, setShowDestinationSelect] = useState(false);
  const [uniqueDepartures, setUniqueDepartures] = useState([]);
  const [filteredArrivals, setFilteredArrivals] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [quickBookingMode, setQuickBookingMode] = useState(false);

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

  const selectDeparture = (location) => {
    const locationValue = location.full_kor || location.name_kor || location;
    setBookingData(prev => ({ ...prev, departure: locationValue, arrival: null }));
    
    // 도착지 목록 필터링
    const map = new Map();
    allRoutes.forEach(r => {
      if (r.region === selectedRegion && r.departure_kor === locationValue) {
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
    setShowDestinationSelect(true);
  };

  const selectArrival = (location) => {
    const locationValue = location.full_kor || location.name_kor || location;
    setBookingData(prev => ({ ...prev, arrival: locationValue }));
    setShowDestinationSelect(false);
    setQuickBookingMode(true);
  };

  const completeQuickBooking = async () => {
    if (!bookingData.departure || !bookingData.arrival) {
      showToast('출발지와 도착지를 선택해주세요.', 'error');
      return;
    }

    try {
      const bookingRequest = {
        customer_info: {
          name: '간편 예약',
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
          type: 'standard',
          passengers: 1,
          luggage: 0
        }],
        passenger_info: {
          total_passengers: 1,
          total_luggage: 0
        },
        pricing: {
          reservation_fee: priceData?.reservation_fee || 20,
          service_fee: priceData?.local_payment_fee || 60,
          vehicle_upgrade_fee: 0,
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
        setQuickBookingMode(false);
        setCurrentPage('confirmation');
      } else {
        throw new Error(response.message || '예약 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('예약 실패:', error);
      showToast(error.message || '예약 중 오류가 발생했습니다.', 'error');
    }
  };

  const popularRoutes = allRoutes
    .filter(route => route.region === selectedRegion)
    .slice(0, 6);

  return (
    <div className="min-h-screen animate-fadeIn">
      {/* 헤더 */}
      <div className="glass-effect sticky top-0 z-20 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Car className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">YELLORIDE</h1>
              <p className="text-xs text-gray-500">프리미엄 택시 서비스</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2.5 rounded-xl hover:bg-gray-100 transition-all">
              <Bell className="w-6 h-6 text-gray-700" />
            </button>
            <button 
              onClick={() => setCurrentPage('search')}
              className="p-2.5 rounded-xl hover:bg-gray-100 transition-all"
            >
              <Search className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </div>

        {/* 지역 선택 */}
        <button
          onClick={() => setShowRegionModal(true)}
          className="w-full bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl p-4 hover-lift"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-indigo-600" />
              <div className="text-left">
                <p className="text-xs text-gray-600">현재 서비스 지역</p>
                <p className="font-semibold text-gray-800">{regionData[selectedRegion]?.name || selectedRegion}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="px-6 py-6">
        {/* 빠른 예약 섹션 */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">어디로 모실까요? 🚗</h2>
          
          {!bookingData.departure ? (
            <div className="space-y-4">
              <p className="text-gray-600">출발지를 선택해주세요</p>
              <div className="grid grid-cols-2 gap-3">
                {uniqueDepartures.slice(0, 6).map((location, index) => (
                  <button
                    key={index}
                    onClick={() => selectDeparture(location)}
                    className="bg-white rounded-2xl p-4 shadow-md hover-lift text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {location.is_airport === 'Y' ? 
                        <Plane className="w-5 h-5 text-indigo-500" /> : 
                        <MapPin className="w-5 h-5 text-purple-500" />
                      }
                      <span className="font-medium text-gray-800">{location.name_kor}</span>
                    </div>
                    <p className="text-xs text-gray-500">{location.name_eng}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : !bookingData.arrival ? (
            <div className="animate-scaleUp">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <span className="font-medium">출발: {formatKorName(bookingData.departure)}</span>
                </div>
              </div>
              <p className="text-gray-600 mb-4">도착지를 선택해주세요</p>
              <div className="grid grid-cols-2 gap-3">
                {filteredArrivals.slice(0, 6).map((location, index) => (
                  <button
                    key={index}
                    onClick={() => selectArrival(location)}
                    className="bg-white rounded-2xl p-4 shadow-md hover-lift text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {location.is_airport === 'Y' ? 
                        <Plane className="w-5 h-5 text-indigo-500" /> : 
                        <Navigation className="w-5 h-5 text-purple-500" />
                      }
                      <span className="font-medium text-gray-800">{location.name_kor}</span>
                    </div>
                    <p className="text-xs text-gray-500">{location.name_eng}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-scaleUp">
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                    <div>
                      <p className="text-xs text-gray-500">출발</p>
                      <p className="font-semibold text-gray-800">{formatKorName(bookingData.departure)}</p>
                    </div>
                  </div>
                  <div className="border-l-2 border-dashed border-gray-300 ml-1.5 h-8"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>
                    <div>
                      <p className="text-xs text-gray-500">도착</p>
                      <p className="font-semibold text-gray-800">{formatKorName(bookingData.arrival)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-gray-500">예상 요금</p>
                    <p className="text-3xl font-bold text-indigo-600">${priceData?.total || 80}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">예상 시간</p>
                    <p className="text-lg font-semibold text-gray-800">45분</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setBookingData(prev => ({ ...prev, departure: null, arrival: null }));
                      setQuickBookingMode(false);
                    }}
                    className="py-3 bg-gray-100 text-gray-700 rounded-2xl font-medium hover:bg-gray-200 transition-all"
                  >
                    다시 선택
                  </button>
                  <button
                    onClick={completeQuickBooking}
                    className="py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-medium hover:shadow-lg transform hover:scale-105 transition-all"
                  >
                    바로 예약
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 서비스 메뉴 */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">서비스</h3>
          <div className="grid grid-cols-4 gap-4">
            <button
              onClick={() => setCurrentPage('booking')}
              className="bg-white rounded-2xl p-4 shadow-md hover-lift text-center"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Car className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">택시 예약</span>
            </button>
            
            <button className="bg-white rounded-2xl p-4 shadow-md hover-lift text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Plane className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">공항 택시</span>
            </button>
            
            <button className="bg-white rounded-2xl p-4 shadow-md hover-lift text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">시간제</span>
            </button>
            
            <button className="bg-white rounded-2xl p-4 shadow-md hover-lift text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">프리미엄</span>
            </button>
          </div>
        </div>

        {/* 인기 노선 */}
        {popularRoutes.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">인기 노선 🔥</h3>
            <div className="space-y-3">
              {popularRoutes.slice(0, 3).map((route, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setBookingData(prev => ({
                      ...prev,
                      departure: route.departure_kor,
                      arrival: route.arrival_kor
                    }));
                    setQuickBookingMode(true);
                  }}
                  className="w-full bg-white rounded-2xl p-4 shadow-md hover-lift text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-800">
                          {formatKorName(route.departure_kor)}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-medium text-gray-800">
                          {formatKorName(route.arrival_kor)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          45분
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400" />
                          4.8
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-indigo-600">${route.reservation_fee + route.local_payment_fee}</p>
                      <p className="text-xs text-gray-500">예상 요금</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      <div className="glass-effect fixed bottom-0 left-0 right-0 px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          <button className="text-center">
            <Home className="w-6 h-6 mx-auto mb-1 text-indigo-600" />
            <span className="text-xs font-medium text-indigo-600">홈</span>
          </button>
          <button 
            onClick={() => setCurrentPage('search')}
            className="text-center"
          >
            <FileText className="w-6 h-6 mx-auto mb-1 text-gray-400" />
            <span className="text-xs text-gray-400">예약내역</span>
          </button>
          <button className="text-center">
            <MessageCircle className="w-6 h-6 mx-auto mb-1 text-gray-400" />
            <span className="text-xs text-gray-400">문의</span>
          </button>
          <button className="text-center">
            <User className="w-6 h-6 mx-auto mb-1 text-gray-400" />
            <span className="text-xs text-gray-400">내정보</span>
          </button>
        </div>
      </div>

      {/* 지역 선택 모달 */}
      {showRegionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end animate-fadeIn">
          <div className="bg-white w-full rounded-t-3xl p-6 animate-slideUp">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
            <h3 className="text-xl font-bold text-gray-800 mb-6">서비스 지역 선택</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.entries(regionData).map(([code, data]) => (
                <button
                  key={code}
                  onClick={() => {
                    setSelectedRegion(code);
                    setShowRegionModal(false);
                    showToast(`${data.name} 지역이 선택되었습니다.`, 'success');
                  }}
                  className={`w-full p-4 rounded-2xl text-left transition-all ${
                    selectedRegion === code 
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <h4 className="font-semibold">{data.name}</h4>
                  <p className={`text-sm mt-1 ${selectedRegion === code ? 'text-white/80' : 'text-gray-600'}`}>
                    {data.desc}
                  </p>
                </button>
              ))}
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
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    date: '',
    time: '',
    passengers: 1,
    luggage: 0,
    vehicleType: 'standard',
    requests: ''
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.date || !formData.time) {
      showToast('모든 필수 정보를 입력해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      const bookingRequest = {
        customer_info: {
          name: formData.name,
          phone: formData.phone,
          kakao_id: ''
        },
        service_info: {
          type: 'airport',
          region: bookingData.region
        },
        trip_details: {
          departure: {
            location: '예약 위치',
            datetime: new Date(`${formData.date}T${formData.time}`)
          },
          arrival: {
            location: '도착 위치'
          }
        },
        vehicles: [{
          type: formData.vehicleType,
          passengers: formData.passengers,
          luggage: formData.luggage
        }],
        passenger_info: {
          total_passengers: formData.passengers,
          total_luggage: formData.luggage
        },
        pricing: {
          reservation_fee: 20,
          service_fee: 60,
          vehicle_upgrade_fee: formData.vehicleType === 'premium' ? 20 : 0,
          total_amount: formData.vehicleType === 'premium' ? 100 : 80
        }
      };

      const response = await api.createBooking(bookingRequest);
      
      if (response.success) {
        setBookingData(prev => ({
          ...prev,
          bookingNumber: response.data.booking_number || 'YR' + Date.now().toString().slice(-6),
          totalAmount: response.data.total_amount || 80,
          customer: {
            name: formData.name,
            phone: formData.phone
          }
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 animate-fadeIn">
      {/* 헤더 */}
      <div className="glass-effect sticky top-0 z-20 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('home')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">택시 예약</h1>
        </div>
      </div>

      {/* 폼 */}
      <div className="px-6 py-6 space-y-6">
        {/* 고객 정보 */}
        <div className="bg-white rounded-3xl p-6 shadow-lg animate-scaleUp">
          <h2 className="text-lg font-bold text-gray-800 mb-4">예약자 정보</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-2 block">이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-2 block">전화번호</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="010-1234-5678"
              />
            </div>
          </div>
        </div>

        {/* 일정 정보 */}
        <div className="bg-white rounded-3xl p-6 shadow-lg animate-scaleUp" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-lg font-bold text-gray-800 mb-4">일정 정보</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-2 block">날짜</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-2 block">시간</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 탑승 정보 */}
        <div className="bg-white rounded-3xl p-6 shadow-lg animate-scaleUp" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-lg font-bold text-gray-800 mb-4">탑승 정보</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">승객 수</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFormData({ ...formData, passengers: Math.max(1, formData.passengers - 1) })}
                  className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="w-12 text-center font-semibold text-lg">{formData.passengers}</span>
                <button
                  onClick={() => setFormData({ ...formData, passengers: Math.min(8, formData.passengers + 1) })}
                  className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700">짐 개수</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFormData({ ...formData, luggage: Math.max(0, formData.luggage - 1) })}
                  className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="w-12 text-center font-semibold text-lg">{formData.luggage}</span>
                <button
                  onClick={() => setFormData({ ...formData, luggage: formData.luggage + 1 })}
                  className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 차량 선택 */}
        <div className="bg-white rounded-3xl p-6 shadow-lg animate-scaleUp" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-lg font-bold text-gray-800 mb-4">차량 유형</h2>
          <div className="space-y-3">
            <button
              onClick={() => setFormData({ ...formData, vehicleType: 'standard' })}
              className={`w-full p-4 rounded-2xl transition-all ${
                formData.vehicleType === 'standard'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Car className="w-6 h-6" />
                  <div className="text-left">
                    <p className="font-semibold">스탠다드</p>
                    <p className="text-sm opacity-80">편안한 일반 차량</p>
                  </div>
                </div>
                <span className="font-bold">$80</span>
              </div>
            </button>

            <button
              onClick={() => setFormData({ ...formData, vehicleType: 'premium' })}
              className={`w-full p-4 rounded-2xl transition-all ${
                formData.vehicleType === 'premium'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Star className="w-6 h-6" />
                  <div className="text-left">
                    <p className="font-semibold">프리미엄</p>
                    <p className="text-sm opacity-80">고급 차량 서비스</p>
                  </div>
                </div>
                <span className="font-bold">$100</span>
              </div>
            </button>
          </div>
        </div>

        {/* 요청사항 */}
        <div className="bg-white rounded-3xl p-6 shadow-lg animate-scaleUp" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-lg font-bold text-gray-800 mb-4">요청사항</h2>
          <textarea
            value={formData.requests}
            onChange={(e) => setFormData({ ...formData, requests: e.target.value })}
            className="w-full px-4 py-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24"
            placeholder="특별한 요청사항이 있으시면 알려주세요..."
          />
        </div>

        {/* 예약 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-3xl font-bold text-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 animate-scaleUp"
          style={{ animationDelay: '0.5s' }}
        >
          {loading ? '예약 중...' : '예약 완료하기'}
        </button>
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
        showToast('예약을 찾았습니다!', 'success');
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 animate-fadeIn">
      {/* 헤더 */}
      <div className="glass-effect sticky top-0 z-20 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('home')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">예약 조회</h1>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* 검색 섹션 */}
        <div className="bg-white rounded-3xl p-6 shadow-lg mb-6 animate-scaleUp">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">예약 내역을 조회하세요</h2>
            <p className="text-gray-600">예약번호를 입력해주세요</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="예: YR145DD9"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !searchValue.trim()}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? '조회 중...' : '조회하기'}
            </button>
          </div>
        </div>

        {/* 검색 결과 */}
        {booking && (
          <div className="bg-white rounded-3xl p-6 shadow-lg animate-scaleUp">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{booking.booking_number}</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 ${
                  booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  booking.status === 'completed' ? 'bg-gray-100 text-gray-700' :
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
                <p className="text-3xl font-bold text-indigo-600">${booking.pricing?.total_amount || 0}</p>
                <p className="text-sm text-gray-500">총 요금</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">출발</p>
                  <p className="font-semibold text-gray-800">{booking.trip_details?.departure?.location || '-'}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Navigation className="w-5 h-5 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">도착</p>
                  <p className="font-semibold text-gray-800">{booking.trip_details?.arrival?.location || '-'}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">일시</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(booking.trip_details?.departure?.datetime).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">예약자</p>
                  <p className="font-semibold text-gray-800">{booking.customer_info?.name} ({booking.customer_info?.phone})</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button className="py-3 bg-gray-100 text-gray-700 rounded-2xl font-medium hover:bg-gray-200 transition-all">
                예약 수정
              </button>
              <button className="py-3 bg-red-100 text-red-700 rounded-2xl font-medium hover:bg-red-200 transition-all">
                예약 취소
              </button>
            </div>
          </div>
        )}
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 animate-fadeIn">
      {/* 성공 헤더 */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 px-6 py-12 text-white text-center">
        <div className="animate-scaleUp">
          <CheckCircle className="w-20 h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">예약이 완료되었습니다!</h1>
          <p className="text-white/80">곧 기사님이 배정될 예정입니다</p>
        </div>
      </div>

      <div className="px-6 -mt-8 pb-6">
        {/* 예약번호 카드 */}
        <div className="bg-white rounded-3xl p-6 shadow-xl mb-6 animate-slideUp">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">예약번호</p>
            <h2 className="text-3xl font-bold text-gray-800 tracking-wider mb-4">
              {bookingData.bookingNumber || 'YR241201DEMO'}
            </h2>
            <button
              onClick={copyBookingNumber}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all"
            >
              {copied ? '복사완료!' : '예약번호 복사'}
            </button>
          </div>
        </div>

        {/* 예약 정보 */}
        <div className="bg-white rounded-3xl p-6 shadow-lg mb-6 animate-slideUp" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-lg font-bold text-gray-800 mb-4">예약 정보</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">서비스</span>
              <span className="font-semibold text-gray-800">프리미엄 택시</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">출발</span>
              <span className="font-semibold text-gray-800">{bookingData.departure || '출발지'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">도착</span>
              <span className="font-semibold text-gray-800">{bookingData.arrival || '도착지'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">예약자</span>
              <span className="font-semibold text-gray-800">{bookingData.customer?.name || '예약자'}</span>
            </div>
            <div className="border-t pt-4 flex justify-between">
              <span className="text-gray-600">총 요금</span>
              <span className="text-2xl font-bold text-indigo-600">${bookingData.totalAmount || '80'}</span>
            </div>
          </div>
        </div>

        {/* 안내사항 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-6 mb-6 animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-600" />
            이용 안내
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-0.5">•</span>
              예약 확정 후 기사님 정보를 문자로 안내드립니다
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-0.5">•</span>
              출발 1시간 전까지 취소 가능합니다
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 mt-0.5">•</span>
              기사님께 예약번호를 알려주세요
            </li>
          </ul>
        </div>

        {/* 액션 버튼 */}
        <div className="grid grid-cols-2 gap-3 animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <button
            onClick={() => setCurrentPage('search')}
            className="py-3 bg-white text-indigo-600 rounded-2xl font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
          >
            예약 내역 보기
          </button>
          <button
            onClick={() => setCurrentPage('home')}
            className="py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default YellorideApp;
