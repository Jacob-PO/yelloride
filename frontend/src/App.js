import React, { useState, useEffect, createContext, useContext } from 'react';
import { ArrowLeft, Plus, Minus, X, ChevronRight, MapPin, Clock, Calendar, Search, Info, Plane, Building2, Car, CheckCircle, Phone, HeadphonesIcon, User, Menu, Globe, FileText } from 'lucide-react';

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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        switch (response.status) {
          case 400:
            throw new Error(errorData.message || '잘못된 요청입니다.');
          case 401:
            throw new Error('인증이 필요합니다.');
          case 403:
            throw new Error('접근이 거부되었습니다.');
          case 404:
            throw new Error('요청한 데이터를 찾을 수 없습니다.');
          case 429:
            throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
          case 500:
            throw new Error('서버 내부 오류가 발생했습니다.');
          default:
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      const data = await response.json();
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

  // 택시 노선 API
  async getTaxiItems(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.requestWithRetry(`/taxi?${queryString}`);
  }

  async searchRoute(departure, arrival, lang = 'kor') {
    const params = new URLSearchParams({ departure, arrival, lang });
    return this.requestWithRetry(`/taxi/route?${params}`);
  }

  async getArrivals(departure, region, lang = 'kor') {
    const params = new URLSearchParams({ departure, region, lang });
    return this.requestWithRetry(`/taxi/arrivals?${params}`);
  }

  async getDepartures(region, lang = 'kor') {
    const params = new URLSearchParams({ region, lang });
    return this.requestWithRetry(`/taxi/departures?${params}`);
  }

  async getStats() {
    return this.requestWithRetry('/taxi/stats');
  }

  // 예약 API
  async createBooking(bookingData) {
    return this.requestWithRetry('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  }

  async getBookingByNumber(bookingNumber) {
    return this.requestWithRetry(`/bookings/number/${bookingNumber}`);
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
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <X className="w-5 h-5" />,
    warning: <Info className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  return (
    <div className={`fixed bottom-20 left-4 right-4 max-w-sm mx-auto z-50 p-4 rounded-2xl border ${typeStyles[type]} shadow-lg backdrop-blur-sm transition-all duration-300 animate-slideIn`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button 
          onClick={onClose} 
          className="flex-shrink-0 ml-2 text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// 토스트 훅
const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
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

// 온라인 상태 훅
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// 연결 상태 표시
const ConnectionStatus = () => {
  const isOnline = useOnlineStatus();
  const [serverStatus, setServerStatus] = useState(true);
  const api = new YellorideAPI();

  useEffect(() => {
    const checkServerStatus = async () => {
      const isHealthy = await api.healthCheck();
      setServerStatus(isHealthy);
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-gray-900 text-white p-4 rounded-2xl text-center text-sm font-medium z-50 shadow-lg max-w-sm mx-auto">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          인터넷 연결이 끊어졌습니다
        </div>
      </div>
    );
  }

  if (!serverStatus) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-yellow-50 text-yellow-800 border border-yellow-200 p-4 rounded-2xl text-center text-sm font-medium z-50 shadow-lg max-w-sm mx-auto">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          서버 연결이 불안정합니다
        </div>
      </div>
    );
  }

  return null;
};

// 메인 앱
const YellorideApp = () => {
  const [currentPage, setCurrentPage] = useState('regionSelect');
  const [selectedRegion, setSelectedRegion] = useState(null);
  const { showToast, ToastContainer } = useToast();
  const [bookingData, setBookingData] = useState({
    departure: null,
    arrival: null,
    region: null,
    serviceType: null,
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
      email: '',
      kakao: ''
    },
    flight: {
      number: '',
      terminal: ''
    },
    bookingNumber: '',
    totalAmount: 0
  });

  const api = new YellorideAPI();

  const contextValue = {
    currentPage, setCurrentPage,
    selectedRegion, setSelectedRegion,
    bookingData, setBookingData,
    api,
    showToast
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-50">
        <style jsx global>{`
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          button {
            cursor: pointer;
            border: none;
            background: none;
            font-family: inherit;
          }
          
          input {
            font-family: inherit;
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
          
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}</style>

        {currentPage === 'regionSelect' && <RegionSelectPage />}
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'booking' && <BookingPage />}
        {currentPage === 'charter' && <CharterPage />}
        {currentPage === 'search' && <SearchPage />}
        {currentPage === 'confirmation' && <ConfirmationPage />}
        {currentPage === 'admin' && <AdminPage />}
        
        <ToastContainer />
        <ConnectionStatus />
      </div>
    </AppContext.Provider>
  );
};

// 지역 선택 페이지 (뉴욕/LA 선택)
const RegionSelectPage = () => {
  const { setCurrentPage, setSelectedRegion, setBookingData } = useContext(AppContext);

  const handleRegionSelect = (region) => {
    setSelectedRegion(region);
    setBookingData(prev => ({ ...prev, region }));
    localStorage.setItem('selectedRegion', region);
    setCurrentPage('home');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">YELLORIDE</h1>
          <p className="text-gray-600">서비스 지역을 선택해주세요</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleRegionSelect('NY')}
            className="w-full p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">
                  🗽
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-1">뉴욕</h3>
                  <p className="text-gray-500 text-sm">맨해튼, 브루클린, JFK/LGA 공항</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </button>

          <button
            onClick={() => handleRegionSelect('CA')}
            className="w-full p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-yellow-200 transition-colors">
                  🌴
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-1">로스앤젤레스</h3>
                  <p className="text-gray-500 text-sm">LA, 샌프란시스코, LAX/SFO 공항</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </button>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          더 많은 지역이 곧 추가됩니다
        </div>
      </div>
    </div>
  );
};

// 홈페이지
const HomePage = () => {
  const { setCurrentPage, selectedRegion, bookingData, setBookingData, api, showToast } = useContext(AppContext);
  const [selectedService, setSelectedService] = useState(null);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPopularRoutes();
  }, [selectedRegion]);

  const loadPopularRoutes = async () => {
    try {
      const response = await api.getTaxiItems({
        region: selectedRegion,
        limit: 6,
        sort: 'priority'
      });
      
      if (response.success && Array.isArray(response.data)) {
        setPopularRoutes(response.data);
      }
    } catch (error) {
      console.error('인기 노선 로드 오류:', error);
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setBookingData(prev => ({ ...prev, serviceType: service }));
    setCurrentPage('booking');
  };

  const quickSelectRoute = (route) => {
    setBookingData(prev => ({ 
      ...prev, 
      departure: route.departure_kor,
      arrival: route.arrival_kor,
      serviceType: route.departure_is_airport === 'Y' || route.arrival_is_airport === 'Y' ? 'airport' : 'taxi',
      priceData: {
        reservation_fee: route.reservation_fee,
        local_payment_fee: route.local_payment_fee
      }
    }));
    setCurrentPage('booking');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 헤더 */}
      <header className="bg-white p-4 sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">
            {selectedRegion === 'NY' ? '뉴욕' : '로스앤젤레스'}
          </h1>
          <button
            onClick={() => setCurrentPage('regionSelect')}
            className="text-sm text-gray-600 flex items-center gap-1"
          >
            지역변경
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-4 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-2">어디로 모실까요?</h2>
        <p className="text-gray-600 mb-6">원하는 서비스를 선택해주세요</p>

        <div className="space-y-3">
          <button
            onClick={() => handleServiceSelect('airport')}
            className="w-full p-5 bg-white rounded-2xl border-2 border-gray-100 hover:border-blue-500 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Plane className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">공항 갈 때</h3>
                  <p className="text-gray-500 text-sm">비행기 놓치면 곤란하니까</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => handleServiceSelect('taxi')}
            className="w-full p-5 bg-white rounded-2xl border-2 border-gray-100 hover:border-blue-500 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Car className="w-7 h-7 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">일반 택시</h3>
                  <p className="text-gray-500 text-sm">어디든 편하게</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>

          <button
            onClick={() => setCurrentPage('charter')}
            className="w-full p-5 bg-white rounded-2xl border-2 border-gray-100 hover:border-blue-500 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">시간제 대절</h3>
                  <p className="text-gray-500 text-sm">여유있게 다니고 싶을 때</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>
        </div>

        {/* 인기 노선 */}
        {popularRoutes.length > 0 && (
          <div className="mt-8">
            <h3 className="font-semibold text-lg mb-4">인기 노선</h3>
            <div className="space-y-2">
              {popularRoutes.slice(0, 4).map((route, index) => (
                <button
                  key={index}
                  onClick={() => quickSelectRoute(route)}
                  className="w-full p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(route.departure_is_airport === 'Y' || route.arrival_is_airport === 'Y') && 
                        <Plane className="w-4 h-4 text-blue-500" />
                      }
                      <div>
                        <div className="font-medium text-sm">
                          {route.departure_kor.split(' - ')[0]} → {route.arrival_kor.split(' - ')[0]}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          예약비 ${route.reservation_fee} + 현지비 ${route.local_payment_fee}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">
                        ${route.reservation_fee + route.local_payment_fee}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto flex">
          <button className="flex-1 py-4 text-center">
            <div className="text-2xl mb-1">🏠</div>
            <div className="text-xs font-medium text-gray-900">홈</div>
          </button>
          <button className="flex-1 py-4 text-center" onClick={() => setCurrentPage('search')}>
            <div className="text-2xl mb-1 opacity-40">📋</div>
            <div className="text-xs text-gray-400">예약내역</div>
          </button>
          <button className="flex-1 py-4 text-center">
            <div className="text-2xl mb-1 opacity-40">💬</div>
            <div className="text-xs text-gray-400">고객센터</div>
          </button>
          <button className="flex-1 py-4 text-center" onClick={() => setCurrentPage('admin')}>
            <div className="text-2xl mb-1 opacity-40">⚙️</div>
            <div className="text-xs text-gray-400">관리</div>
          </button>
        </div>
      </nav>
    </div>
  );
};

// 예약 페이지
const BookingPage = () => {
  const { setCurrentPage, bookingData, setBookingData, api, showToast, selectedRegion } = useContext(AppContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState({ departures: [], arrivals: [] });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSelectType, setLocationSelectType] = useState('departure');
  const [priceData, setPriceData] = useState(bookingData.priceData || {
    reservation_fee: 20,
    local_payment_fee: 75
  });

  const totalSteps = 4;

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setBookingData(prev => ({
      ...prev,
      datetime: { ...prev.datetime, date: today }
    }));

    if (!bookingData.departure || !bookingData.arrival) {
      loadDepartures();
    }
  }, []);

  const loadDepartures = async () => {
    try {
      const response = await api.getDepartures(selectedRegion, 'kor');
      if (response.success && Array.isArray(response.data)) {
        setLocations(prev => ({ ...prev, departures: response.data }));
      }
    } catch (error) {
      console.error('출발지 로드 오류:', error);
    }
  };

  const loadArrivals = async (departure) => {
    try {
      const response = await api.getArrivals(departure.split(' - ')[0], selectedRegion, 'kor');
      if (response.success && Array.isArray(response.data)) {
        setLocations(prev => ({ ...prev, arrivals: response.data }));
      }
    } catch (error) {
      console.error('도착지 로드 오류:', error);
    }
  };

  const openLocationSelect = (type) => {
    setLocationSelectType(type);
    setShowLocationModal(true);
    
    if (type === 'arrival' && bookingData.departure) {
      loadArrivals(bookingData.departure);
    }
  };

  const selectLocation = async (location) => {
    const locationName = location.name_kor || location;
    
    setBookingData(prev => ({
      ...prev,
      [locationSelectType]: locationName
    }));
    setShowLocationModal(false);

    if (locationSelectType === 'departure') {
      setLocations(prev => ({ ...prev, arrivals: [] }));
      setBookingData(prev => ({ ...prev, arrival: null }));
    }

    // 경로 검색해서 가격 정보 가져오기
    if (locationSelectType === 'arrival' && bookingData.departure) {
      try {
        const response = await api.searchRoute(
          bookingData.departure.split(' - ')[0],
          locationName.split(' - ')[0],
          'kor'
        );
        if (response.success && response.data.length > 0) {
          setPriceData({
            reservation_fee: response.data[0].reservation_fee,
            local_payment_fee: response.data[0].local_payment_fee
          });
        }
      } catch (error) {
        console.error('경로 검색 오류:', error);
      }
    }
  };

  const calculateTotalPrice = () => {
    let total = priceData.reservation_fee + priceData.local_payment_fee;
    
    if (bookingData.vehicle === 'xl') {
      total += 10;
    } else if (bookingData.vehicle === 'premium') {
      total += 25;
    }
    
    return total;
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return bookingData.departure && bookingData.arrival;
      case 2:
        return bookingData.datetime.date && bookingData.datetime.time;
      case 3:
        return bookingData.passengers >= 1;
      case 4:
        return bookingData.customer.name && bookingData.customer.phone && bookingData.customer.email;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
      } else {
        completeBooking();
      }
    } else {
      showToast('필수 정보를 입력해주세요.', 'warning');
    }
  };

  const completeBooking = async () => {
    setLoading(true);
    try {
      const bookingRequest = {
        customer_info: {
          name: bookingData.customer.name,
          phone: bookingData.customer.phone,
          email: bookingData.customer.email,
          kakao_id: bookingData.customer.kakao || ''
        },
        service_info: {
          type: bookingData.serviceType,
          region: selectedRegion
        },
        trip_details: {
          departure: {
            location: bookingData.departure,
            datetime: new Date(`${bookingData.datetime.date}T${bookingData.datetime.time}`)
          },
          arrival: {
            location: bookingData.arrival
          }
        },
        vehicles: [{
          type: bookingData.vehicle,
          passengers: bookingData.passengers,
          luggage: bookingData.luggage
        }],
        passenger_info: {
          total_passengers: bookingData.passengers,
          total_luggage: bookingData.luggage
        },
        flight_info: bookingData.flight.number ? {
          flight_number: bookingData.flight.number,
          terminal: bookingData.flight.terminal
        } : null,
        pricing: {
          reservation_fee: priceData.reservation_fee,
          service_fee: priceData.local_payment_fee,
          vehicle_upgrade_fee: bookingData.vehicle === 'xl' ? 10 : 
                              bookingData.vehicle === 'premium' ? 25 : 0,
          total_amount: calculateTotalPrice()
        }
      };

      const response = await api.createBooking(bookingRequest);
      
      if (response.success) {
        setBookingData(prev => ({
          ...prev,
          bookingNumber: response.data.booking_number,
          totalAmount: response.data.total_amount
        }));
        
        showToast('예약이 완료되었습니다!', 'success');
        setCurrentPage('confirmation');
      } else {
        throw new Error(response.message || '예약 생성에 실패했습니다.');
      }
    } catch (error) {
      showToast(error.message || '예약 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center p-4">
          <button onClick={() => setCurrentPage('home')} className="p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="ml-4 text-lg font-semibold">예약하기</h1>
        </div>
        <div className="px-4 pb-4">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <div className="p-4 pb-24">
        {/* Step 1: 경로 선택 */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-6">어디로 가시나요?</h2>
            
            <button
              onClick={() => openLocationSelect('departure')}
              className="w-full p-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">출발지</p>
                  <p className={`font-medium ${bookingData.departure ? 'text-black' : 'text-gray-400'}`}>
                    {bookingData.departure || '출발지를 선택하세요'}
                  </p>
                </div>
              </div>
            </button>

            <div className="relative">
              <div className="absolute left-[6px] top-[-8px] bottom-[-8px] w-[2px] bg-gray-300"></div>
            </div>

            <button
              onClick={() => openLocationSelect('arrival')}
              className="w-full p-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 transition-all text-left"
              disabled={!bookingData.departure}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">도착지</p>
                  <p className={`font-medium ${bookingData.arrival ? 'text-black' : 'text-gray-400'}`}>
                    {bookingData.arrival || '도착지를 선택하세요'}
                  </p>
                </div>
              </div>
            </button>

            {bookingData.departure && bookingData.arrival && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">예상 요금</span>
                  <span className="text-xl font-bold text-blue-600">
                    ${calculateTotalPrice()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 날짜/시간 선택 */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-6">언제 출발하시나요?</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
              <input
                type="date"
                value={bookingData.datetime.date}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  datetime: { ...prev.datetime, date: e.target.value }
                }))}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 border border-gray-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
              <input
                type="time"
                value={bookingData.datetime.time}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  datetime: { ...prev.datetime, time: e.target.value }
                }))}
                className="w-full p-3 border border-gray-300 rounded-xl"
              />
            </div>

            {bookingData.serviceType === 'airport' && (
              <div className="space-y-4 mt-6">
                <h3 className="font-medium">항공편 정보 (선택)</h3>
                <input
                  type="text"
                  placeholder="항공편 번호"
                  value={bookingData.flight.number}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    flight: { ...prev.flight, number: e.target.value }
                  }))}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                />
                <input
                  type="text"
                  placeholder="터미널"
                  value={bookingData.flight.terminal}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    flight: { ...prev.flight, terminal: e.target.value }
                  }))}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: 인원/차량 선택 */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-6">인원과 차량을 선택하세요</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white rounded-xl">
                <div>
                  <p className="font-medium">탑승 인원</p>
                  <p className="text-sm text-gray-500">최대 8명</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => bookingData.passengers > 1 && 
                      setBookingData(prev => ({ ...prev, passengers: prev.passengers - 1 }))}
                    className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-lg w-8 text-center">{bookingData.passengers}</span>
                  <button
                    onClick={() => setBookingData(prev => ({ ...prev, passengers: prev.passengers + 1 }))}
                    className="w-8 h-8 rounded-full border-2 border-blue-500 bg-blue-500 text-white flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white rounded-xl">
                <div>
                  <p className="font-medium">수하물</p>
                  <p className="text-sm text-gray-500">캐리어 개수</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => bookingData.luggage > 0 && 
                      setBookingData(prev => ({ ...prev, luggage: prev.luggage - 1 }))}
                    className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-lg w-8 text-center">{bookingData.luggage}</span>
                  <button
                    onClick={() => setBookingData(prev => ({ ...prev, luggage: prev.luggage + 1 }))}
                    className="w-8 h-8 rounded-full border-2 border-blue-500 bg-blue-500 text-white flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">차량 선택</h3>
              <div className="space-y-3">
                {[
                  { id: 'standard', name: '일반 택시', desc: '최대 4명', price: '기본 요금' },
                  { id: 'xl', name: '대형 택시', desc: '최대 6명', price: '+$10' },
                  { id: 'premium', name: '프리미엄 택시', desc: '최대 4명', price: '+$25' }
                ].map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => setBookingData(prev => ({ ...prev, vehicle: vehicle.id }))}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      bookingData.vehicle === vehicle.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{vehicle.name}</p>
                        <p className="text-sm text-gray-500">{vehicle.desc}</p>
                      </div>
                      <span className="font-medium text-blue-600">{vehicle.price}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: 연락처 정보 */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-6">연락처 정보</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이름 *</label>
              <input
                type="text"
                value={bookingData.customer.name}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, name: e.target.value }
                }))}
                placeholder="성함을 입력하세요"
                className="w-full p-3 border border-gray-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">전화번호 *</label>
              <input
                type="tel"
                value={bookingData.customer.phone}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, phone: e.target.value }
                }))}
                placeholder="010-1234-5678"
                className="w-full p-3 border border-gray-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이메일 *</label>
              <input
                type="email"
                value={bookingData.customer.email}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, email: e.target.value }
                }))}
                placeholder="example@email.com"
                className="w-full p-3 border border-gray-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">카카오톡 ID (선택)</label>
              <input
                type="text"
                value={bookingData.customer.kakao}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, kakao: e.target.value }
                }))}
                placeholder="카카오톡 ID"
                className="w-full p-3 border border-gray-300 rounded-xl"
              />
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium mb-2">최종 요금</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>예약비</span>
                  <span>${priceData.reservation_fee}</span>
                </div>
                <div className="flex justify-between">
                  <span>현지 지불료</span>
                  <span>${priceData.local_payment_fee}</span>
                </div>
                {bookingData.vehicle !== 'standard' && (
                  <div className="flex justify-between">
                    <span>차량 업그레이드</span>
                    <span>${bookingData.vehicle === 'xl' ? 10 : 25}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-bold text-base">
                    <span>총 요금</span>
                    <span className="text-blue-600">${calculateTotalPrice()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-medium"
            >
              이전
            </button>
          )}
          <button
            onClick={nextStep}
            disabled={!validateStep(currentStep) || loading}
            className={`flex-1 py-3 px-4 rounded-xl font-medium text-white transition-all ${
              validateStep(currentStep) && !loading
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-300'
            }`}
          >
            {loading ? '처리 중...' : currentStep === totalSteps ? '예약 완료' : '다음'}
          </button>
        </div>
      </div>

      {/* 위치 선택 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-white z-50">
          <header className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setShowLocationModal(false)}>
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h3 className="text-lg font-semibold">
                {locationSelectType === 'departure' ? '출발지 선택' : '도착지 선택'}
              </h3>
            </div>
          </header>

          <div className="p-4 overflow-y-auto h-[calc(100vh-73px)]">
            {locationSelectType === 'departure' ? (
              <>
                <div className="mb-6">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Plane className="w-5 h-5 text-gray-600" />
                    공항
                  </h4>
                  <div className="space-y-2">
                    {locations.departures.filter(loc => loc.is_airport === 'Y').map((location, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectLocation(location)}
                        className="w-full p-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-left"
                      >
                        <p className="font-medium">{location.name_kor}</p>
                        <p className="text-sm text-gray-500">{location.name_eng}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-600" />
                    일반 지역
                  </h4>
                  <div className="space-y-2">
                    {locations.departures.filter(loc => loc.is_airport !== 'Y').map((location, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectLocation(location)}
                        className="w-full p-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-left"
                      >
                        <p className="font-medium">{location.name_kor}</p>
                        <p className="text-sm text-gray-500">{location.name_eng}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {locations.arrivals.length > 0 ? (
                  <>
                    <div className="mb-6">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Plane className="w-5 h-5 text-gray-600" />
                        공항
                      </h4>
                      <div className="space-y-2">
                        {locations.arrivals.filter(loc => loc.is_airport === 'Y').map((location, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectLocation(location)}
                            className="w-full p-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-left"
                          >
                            <p className="font-medium">{location.name_kor}</p>
                            <p className="text-sm text-gray-500">{location.name_eng}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-600" />
                        일반 지역
                      </h4>
                      <div className="space-y-2">
                        {locations.arrivals.filter(loc => loc.is_airport !== 'Y').map((location, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectLocation(location)}
                            className="w-full p-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-left"
                          >
                            <p className="font-medium">{location.name_kor}</p>
                            <p className="text-sm text-gray-500">{location.name_eng}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">도착지 목록을 불러오는 중...</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 검색 페이지
const SearchPage = () => {
  const { setCurrentPage, api, showToast } = useContext(AppContext);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      showToast('예약번호를 입력해주세요.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await api.getBookingByNumber(searchValue.trim());
      if (response.success) {
        setResults([response.data]);
        showToast('예약을 찾았습니다.', 'success');
      } else {
        setResults([]);
        showToast('예약을 찾을 수 없습니다.', 'warning');
      }
    } catch (error) {
      console.error('검색 오류:', error);
      showToast('검색 중 오류가 발생했습니다.', 'error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center p-4">
          <button onClick={() => setCurrentPage('home')} className="p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="ml-4 text-lg font-semibold">예약 조회</h1>
        </div>
      </header>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4">예약번호로 조회</h2>
          <div className="space-y-4">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="예약번호를 입력하세요"
              className="w-full p-3 border border-gray-300 rounded-xl"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !searchValue.trim()}
              className={`w-full py-3 rounded-xl font-medium text-white transition-all ${
                loading || !searchValue.trim() 
                  ? 'bg-gray-300' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {loading ? '조회 중...' : '조회하기'}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((booking, index) => (
              <div key={index} className="bg-white rounded-2xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold">{booking.booking_number}</h3>
                    <p className="text-sm text-gray-500">{booking.created_at}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'confirmed' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {booking.status === 'confirmed' ? '예약 확정' : '대기중'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-gray-400" />
                    <span>{booking.service_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{booking.departure} → {booking.arrival}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{booking.date} {booking.time}</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">총 요금</span>
                    <span className="font-bold text-lg">${booking.total_amount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && results.length === 0 && searchValue && (
          <div className="text-center py-8">
            <p className="text-gray-500">예약 내역이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 대절 페이지
const CharterPage = () => {
  const { setCurrentPage, selectedRegion, api, showToast } = useContext(AppContext);
  const [charterData, setCharterData] = useState({
    purpose: '',
    hours: 4,
    startLocation: '',
    date: '',
    time: '',
    passengers: 1,
    vehicle: 'standard',
    customer: {
      name: '',
      phone: '',
      email: '',
      requests: ''
    }
  });
  const [loading, setLoading] = useState(false);

  const calculatePrice = () => {
    const hourlyRate = charterData.vehicle === 'premium' ? 100 : 80;
    return hourlyRate * charterData.hours;
  };

  const handleSubmit = async () => {
    if (!charterData.purpose || !charterData.startLocation || !charterData.date || 
        !charterData.time || !charterData.customer.name || !charterData.customer.phone) {
      showToast('필수 정보를 모두 입력해주세요.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const charterRequest = {
        customer_info: {
          name: charterData.customer.name,
          phone: charterData.customer.phone,
          email: charterData.customer.email,
          kakao_id: ''
        },
        service_info: {
          type: 'charter',
          region: selectedRegion
        },
        trip_details: {
          departure: {
            location: charterData.startLocation,
            datetime: new Date(`${charterData.date}T${charterData.time}`)
          },
          arrival: {
            location: charterData.startLocation
          }
        },
        charter_info: {
          hours: charterData.hours,
          purpose: charterData.purpose,
          special_requests: charterData.customer.requests
        },
        vehicles: [{
          type: charterData.vehicle,
          passengers: charterData.passengers,
          luggage: 0
        }],
        pricing: {
          total_amount: calculatePrice()
        }
      };

      const response = await api.createBooking(charterRequest);
      
      if (response.success) {
        showToast('대절 예약이 완료되었습니다!', 'success');
        setCurrentPage('home');
      } else {
        throw new Error(response.message || '예약 생성에 실패했습니다.');
      }
    } catch (error) {
      showToast(error.message || '예약 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center p-4">
          <button onClick={() => setCurrentPage('home')} className="p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="ml-4 text-lg font-semibold">시간제 대절</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">대절 정보</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이용 목적</label>
              <select
                value={charterData.purpose}
                onChange={(e) => setCharterData(prev => ({ ...prev, purpose: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-xl"
              >
                <option value="">선택하세요</option>
                <option value="tour">관광</option>
                <option value="business">비즈니스</option>
                <option value="shopping">쇼핑</option>
                <option value="event">행사</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이용 시간</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => charterData.hours > 1 && 
                    setCharterData(prev => ({ ...prev, hours: prev.hours - 1 }))}
                  className="w-10 h-10 rounded-xl border-2 border-gray-300 flex items-center justify-center"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="font-semibold text-lg w-16 text-center">{charterData.hours}시간</span>
                <button
                  onClick={() => setCharterData(prev => ({ ...prev, hours: prev.hours + 1 }))}
                  className="w-10 h-10 rounded-xl border-2 border-blue-500 bg-blue-500 text-white flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">출발 장소</label>
              <input
                type="text"
                value={charterData.startLocation}
                onChange={(e) => setCharterData(prev => ({ ...prev, startLocation: e.target.value }))}
                placeholder="출발 장소를 입력하세요"
                className="w-full p-3 border border-gray-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
                <input
                  type="date"
                  value={charterData.date}
                  onChange={(e) => setCharterData(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
                <input
                  type="time"
                  value={charterData.time}
                  onChange={(e) => setCharterData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">차량 선택</label>
              <div className="space-y-3">
                <button
                  onClick={() => setCharterData(prev => ({ ...prev, vehicle: 'standard' }))}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    charterData.vehicle === 'standard'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium">일반 차량</p>
                  <p className="text-sm text-gray-500">시간당 $80</p>
                </button>
                <button
                  onClick={() => setCharterData(prev => ({ ...prev, vehicle: 'premium' }))}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    charterData.vehicle === 'premium'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium">프리미엄 차량</p>
                  <p className="text-sm text-gray-500">시간당 $100</p>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">예약자 정보</h2>
          
          <div className="space-y-4">
            <input
              type="text"
              value={charterData.customer.name}
              onChange={(e) => setCharterData(prev => ({
                ...prev,
                customer: { ...prev.customer, name: e.target.value }
              }))}
              placeholder="이름"
              className="w-full p-3 border border-gray-300 rounded-xl"
            />
            <input
              type="tel"
              value={charterData.customer.phone}
              onChange={(e) => setCharterData(prev => ({
                ...prev,
                customer: { ...prev.customer, phone: e.target.value }
              }))}
              placeholder="전화번호"
              className="w-full p-3 border border-gray-300 rounded-xl"
            />
            <input
              type="email"
              value={charterData.customer.email}
              onChange={(e) => setCharterData(prev => ({
                ...prev,
                customer: { ...prev.customer, email: e.target.value }
              }))}
              placeholder="이메일 (선택)"
              className="w-full p-3 border border-gray-300 rounded-xl"
            />
            <textarea
              value={charterData.customer.requests}
              onChange={(e) => setCharterData(prev => ({
                ...prev,
                customer: { ...prev.customer, requests: e.target.value }
              }))}
              placeholder="요청사항 (선택)"
              rows="3"
              className="w-full p-3 border border-gray-300 rounded-xl resize-none"
            />
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700">예상 요금</span>
            <span className="text-2xl font-bold text-blue-600">${calculatePrice()}</span>
          </div>
          <p className="text-sm text-gray-600">
            {charterData.hours}시간 × ${charterData.vehicle === 'premium' ? 100 : 80}
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-4 rounded-xl font-medium text-white transition-all ${
            loading ? 'bg-gray-300' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {loading ? '예약 중...' : '대절 예약하기'}
        </button>
      </div>
    </div>
  );
};

// 예약 확인 페이지
const ConfirmationPage = () => {
  const { setCurrentPage, bookingData } = useContext(AppContext);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">예약이 완료되었습니다!</h1>
        <p className="text-gray-600 mb-8">예약 확인서가 이메일로 발송되었습니다</p>

        <div className="bg-gray-100 rounded-2xl p-6 mb-6">
          <p className="text-sm text-gray-600 mb-2">예약번호</p>
          <p className="text-2xl font-bold">{bookingData.bookingNumber}</p>
        </div>

        <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
          <div className="flex justify-between">
            <span className="text-gray-600">경로</span>
            <span className="font-medium">{bookingData.departure} → {bookingData.arrival}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">일시</span>
            <span className="font-medium">{bookingData.datetime.date} {bookingData.datetime.time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">총 요금</span>
            <span className="font-bold text-lg">${bookingData.totalAmount}</span>
          </div>
        </div>

        <button
          onClick={() => setCurrentPage('home')}
          className="w-full max-w-sm py-3 bg-blue-500 text-white rounded-xl font-medium"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
};

// 관리자 페이지
const AdminPage = () => {
  const { setCurrentPage, api, showToast } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('upload');
  const [taxiData, setTaxiData] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    region: '',
    search: '',
    departure_is_airport: '',
    arrival_is_airport: ''
  });

  const handleFileUpload = async () => {
    if (!uploadFile) {
      showToast('파일을 선택해주세요.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('clearExisting', clearExisting);

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/taxi/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message, 'success');
        setUploadFile(null);
        setClearExisting(false);
        
        if (activeTab === 'data') {
          loadTaxiData();
        }
        
        if (activeTab === 'stats') {
          loadStats();
        }
      } else {
        showToast(data.message || '업로드 실패', 'error');
      }
    } catch (error) {
      showToast('서버 연결 실패: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTaxiData = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };
      
      Object.keys(params).forEach(key => {
        if (params[key] === '') {
          delete params[key];
        }
      });

      const response = await api.getTaxiItems(params);
      
      if (response.success) {
        setTaxiData(response.data);
        setPagination(prev => ({ 
          ...prev, 
          total: response.pagination?.total || 0,
          pages: response.pagination?.pages || 1
        }));
      }
    } catch (error) {
      showToast('데이터를 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await api.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      showToast('통계를 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'data') {
      loadTaxiData();
    } else if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab, pagination.page, filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center p-4">
          <button onClick={() => setCurrentPage('home')} className="p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="ml-4 text-lg font-semibold">관리자 페이지</h1>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          {[
            { id: 'upload', label: '파일 업로드' },
            { id: 'data', label: '데이터 조회' },
            { id: 'stats', label: '통계' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 py-3 text-center font-medium ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* 파일 업로드 탭 */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">엑셀 파일 업로드</h3>
            
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📁</div>
                <p className="text-gray-600">파일을 선택하세요</p>
                {uploadFile && (
                  <p className="text-sm text-green-600 mt-2">
                    선택됨: {uploadFile.name}
                  </p>
                )}
              </label>
            </div>

            <label className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">기존 데이터 모두 삭제 후 업로드</span>
            </label>

            <button
              onClick={handleFileUpload}
              disabled={!uploadFile || loading}
              className={`w-full py-3 rounded-xl font-medium text-white ${
                !uploadFile || loading
                  ? 'bg-gray-300'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {loading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        )}

        {/* 데이터 조회 탭 */}
        {activeTab === 'data' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <select
                  value={filters.region}
                  onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
                  className="p-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">전체 지역</option>
                  <option value="NY">뉴욕</option>
                  <option value="CA">캘리포니아</option>
                  <option value="NJ">뉴저지</option>
                </select>
                
                <input
                  type="text"
                  placeholder="검색"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">로딩 중...</p>
              </div>
            ) : taxiData.length > 0 ? (
              <div className="space-y-2">
                {taxiData.map((item, index) => (
                  <div key={index} className="bg-white rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {item.departure_kor} → {item.arrival_kor}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.departure_eng} → {item.arrival_eng}
                        </p>
                      </div>
                      <span className="text-sm font-bold">
                        ${item.reservation_fee + item.local_payment_fee}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded">{item.region}</span>
                      {item.departure_is_airport === 'Y' && 
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">공항출발</span>
                      }
                      {item.arrival_is_airport === 'Y' && 
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">공항도착</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">데이터가 없습니다</p>
              </div>
            )}

            {/* 페이지네이션 */}
            {taxiData.length > 0 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
                >
                  이전
                </button>
                <span className="px-3 py-1 text-sm">
                  {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ 
                    ...prev, 
                    page: Math.min(Math.ceil(pagination.total / pagination.limit), prev.page + 1) 
                  }))}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                  className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}

        {/* 통계 탭 */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">로딩 중...</p>
              </div>
            ) : stats.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {stats.reduce((sum, stat) => sum + stat.count, 0)}
                    </p>
                    <p className="text-sm text-gray-600">총 노선 수</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      ${Math.round(stats.reduce((sum, stat) => 
                        sum + (stat.avgReservationFee + stat.avgLocalPaymentFee), 0) / stats.length)}
                    </p>
                    <p className="text-sm text-gray-600">평균 요금</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {stats.map((stat, index) => (
                    <div key={index} className="bg-white rounded-xl p-4">
                      <h4 className="font-semibold mb-3">{stat._id} 지역</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">노선 수:</span>
                          <span className="font-medium ml-2">{stat.count}개</span>
                        </div>
                        <div>
                          <span className="text-gray-600">평균 예약비:</span>
                          <span className="font-medium ml-2">${Math.round(stat.avgReservationFee)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">공항 출발:</span>
                          <span className="font-medium ml-2">{stat.airportDepartures}개</span>
                        </div>
                        <div>
                          <span className="text-gray-600">공항 도착:</span>
                          <span className="font-medium ml-2">{stat.airportArrivals}개</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">통계 데이터가 없습니다</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default YellorideApp;
