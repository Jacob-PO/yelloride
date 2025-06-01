import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { ArrowLeft, Plus, Minus, X, ChevronRight, MapPin, Clock, Calendar, Search, Info, Plane, Building2, Car, CheckCircle, Phone, Headphones, User, Menu, Globe, FileText, Users, Luggage, CreditCard, Shield, Star, AlertCircle, Check, ChevronDown, Navigation, DollarSign, UserCircle, Settings, LogOut, Home, Briefcase, HelpCircle, ChevronUp, Filter, RefreshCw, Trash2, Download, Upload, Database, Activity, Camera, ShoppingBag } from 'lucide-react';

// 전역 상태 관리
const AppContext = createContext();

// API 서비스 클래스 (기존 유지)
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

  // 택시 노선 관련 API
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
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <X className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border ${typeStyles[type]} max-w-sm animate-slide-in`}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">{icons[type]}</div>
        <span className="text-sm font-medium flex-1">{message}</span>
        <button 
          onClick={onClose} 
          className="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity"
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

// 페이지 헤더 컴포넌트
const PageHeader = ({ title, subtitle, left, actions }) => {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          {left}
          <div>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

// 빈 상태 컴포넌트
const EmptyState = ({ title, message, action, icon: Icon = FileText }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      {message && (
        <p className="text-gray-600 mb-6 max-w-md">{message}</p>
      )}
      {action}
    </div>
  );
};

// 연결 상태 표시 컴포넌트
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
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto bg-red-500 text-white p-4 rounded-2xl shadow-lg text-center text-sm font-medium z-50 flex items-center justify-center gap-2">
        <AlertCircle className="w-5 h-5" />
        인터넷 연결이 끊어졌습니다
      </div>
    );
  }

  if (!serverStatus) {
    return (
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto bg-yellow-500 text-gray-900 p-4 rounded-2xl shadow-lg text-center text-sm font-medium z-50 flex items-center justify-center gap-2">
        <AlertCircle className="w-5 h-5" />
        서버 연결이 불안정합니다
      </div>
    );
  }

  return null;
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && currentPage !== 'home') {
        setCurrentPage('home');
      }
      
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setCurrentPage('admin');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage]);

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
      <div className="min-h-screen bg-gray-50">
        <div className="fixed top-0 left-0 right-0 h-6 bg-gray-900 z-50">
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-1">
              <span className="text-xs text-white">4:26</span>
              <Navigation className="w-3 h-3 text-white rotate-45" />
            </div>
            <div className="absolute right-4 flex items-center gap-1">
              <div className="flex gap-1">
                <div className="w-0.5 h-2.5 bg-gray-600"></div>
                <div className="w-0.5 h-3 bg-gray-400"></div>
                <div className="w-0.5 h-3.5 bg-white"></div>
              </div>
              <span className="text-xs text-white ml-1">5G</span>
              <div className="bg-white text-gray-900 px-1 rounded text-xs ml-1">100</div>
            </div>
          </div>
        </div>

        <div className="pt-6">
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'booking' && <BookingPage />}
          {currentPage === 'charter' && <CharterPage />}
          {currentPage === 'search' && <SearchPage />}
          {currentPage === 'confirmation' && <ConfirmationPage />}
          {currentPage === 'admin' && <AdminPage />}
        </div>
        
        <ToastContainer />
        <ConnectionStatus />
      </div>
    </AppContext.Provider>
  );
};

// 홈페이지 컴포넌트
const HomePage = () => {
  const { setCurrentPage, selectedRegion, setSelectedRegion, regionData, loadingRegions, bookingData, setBookingData, api, showToast } = useContext(AppContext);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [locationSelectType, setLocationSelectType] = useState('departure');
  const [uniqueDepartures, setUniqueDepartures] = useState([]);
  const [filteredArrivals, setFilteredArrivals] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allRoutes, setAllRoutes] = useState([]);
  const [loadingAllRoutes, setLoadingAllRoutes] = useState(false);

  const formatKorName = (full) => {
    if (!full) return '';
    return full
      .replace(/^\w+\s+/, '')
      .split(' - ')[0];
  };

  const hasPrice = (route) =>
    Number(route.reservation_fee) > 0 && Number(route.local_payment_fee) > 0;

  const currentRegionData = regionData[selectedRegion] || { airports: [], places: [] };

  const computeLocationLists = () => {
    const list = locationSelectType === 'departure' ? uniqueDepartures : filteredArrivals;

    if (Array.isArray(list) && list.length > 0) {
      const airports = list.filter(l => l.is_airport === 'Y' || l.is_airport === true);
      const places = list.filter(l => !(l.is_airport === 'Y' || l.is_airport === true));
      return { airportsList: airports, placesList: places };
    }

    return { airportsList: [], placesList: [] };
  };

  const { airportsList, placesList } = computeLocationLists();

  useEffect(() => {
    if (!loadingRegions && selectedRegion) {
      loadPopularRoutes();
    }
  }, [selectedRegion, loadingRegions]);

  useEffect(() => {
    loadAllRoutes();
  }, []);

  useEffect(() => {
    const map = new Map();
    allRoutes.forEach(r => {
      if (r.region === selectedRegion && hasPrice(r)) {
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
  }, [selectedRegion, allRoutes]);

  useEffect(() => {
    if (bookingData.departure) {
      const map = new Map();
      allRoutes.forEach(r => {
        if (
          r.region === selectedRegion &&
          r.departure_kor === bookingData.departure &&
          hasPrice(r)
        ) {
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
    } else {
      setFilteredArrivals([]);
    }
  }, [bookingData.departure, selectedRegion, allRoutes]);

  const loadPopularRoutes = async () => {
    try {
      const response = await api.getTaxiItems({
        region: selectedRegion,
        limit: 6,
        sort: 'priority'
      });
      
      if (response.success && Array.isArray(response.data)) {
        const itemsWithPrice = response.data.filter(hasPrice);
        setPopularRoutes(itemsWithPrice);
      } else {
        setPopularRoutes([]);
      }
    } catch (error) {
      console.error('인기 노선 로드 오류:', error);
    }
  };

  const loadAllRoutes = async () => {
    try {
      setLoadingAllRoutes(true);
      const response = await api.getAllTaxiItems();
      if (response.success && Array.isArray(response.data)) {
        const itemsWithPrice = response.data.filter(hasPrice);
        setAllRoutes(itemsWithPrice);
      } else {
        setAllRoutes([]);
      }
    } catch (error) {
      console.error('전체 노선 로드 오류:', error);
      setAllRoutes([]);
    } finally {
      setLoadingAllRoutes(false);
    }
  };

  const selectLocation = (type) => {
    setLocationSelectType(type);
    setShowLocationModal(true);
  };

  const setLocation = (location) => {
    const locationValue = location.full_kor || location.name_kor || location;
    setBookingData(prev => {
      const updated = { ...prev, [locationSelectType]: locationValue };
      if (locationSelectType === 'departure') {
        updated.arrival = null;
      }
      return updated;
    });
    setShowLocationModal(false);

    if (locationSelectType === 'arrival' && bookingData.departure) {
      searchRoutes(bookingData.departure, locationValue);
    }
  };

  const searchRoutes = async (departure, arrival) => {
    if (!departure || !arrival) return;

    setLoading(true);
    try {
      const response = await api.searchRoute(departure, arrival, 'kor');

      if (response.success && response.data && hasPrice(response.data)) {
        setSearchResults([response.data]);
        showToast('경로를 찾았습니다.', 'success');
      } else {
        showToast('해당 경로를 찾을 수 없습니다.', 'warning');
        setSearchResults([]);
      }
    } catch (error) {
      showToast('경로 검색 중 오류가 발생했습니다.', 'error');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const startBooking = (routeData = null) => {
    if (bookingData.departure && bookingData.arrival) {
      const isAirport = bookingData.departure.includes('공항') || bookingData.arrival.includes('공항');

      setBookingData(prev => ({
        ...prev,
        serviceType: isAirport ? 'airport' : 'taxi',
        region: selectedRegion,
        ...(routeData && {
          selectedRoute: routeData,
          priceData: {
            reservation_fee: routeData.reservation_fee,
            local_payment_fee: routeData.local_payment_fee
          }
        })
      }));

      setCurrentPage('booking');
    }
  };

  const quickSelectRoute = (route) => {
    setBookingData(prev => ({ 
      ...prev, 
      departure: route.departure_kor, 
      arrival: route.arrival_kor,
      region: selectedRegion
    }));
    
    setTimeout(() => {
      startBooking(route);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white p-4 flex items-center justify-between">
        <ArrowLeft className="w-6 h-6 invisible" />
        <h1 className="text-xl font-bold text-center">YELLORIDE</h1>
        <div className="w-6"></div>
      </div>

      <div className="p-4">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {currentRegionData?.name || selectedRegion}에서<br />
                <span className="text-blue-500">택시 예약</span>하세요
              </h2>
              <p className="text-gray-800 text-sm">미주 한인 최고의 택시 서비스</p>
            </div>
            <button
              onClick={() => setShowRegionModal(true)}
              className="bg-white bg-opacity-30 backdrop-blur-sm p-3 rounded-xl"
            >
              <Globe className="w-6 h-6 text-gray-900" />
            </button>
          </div>

          <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-1 mt-4">
            <div className="bg-white rounded-lg shadow-sm">
              <button
                onClick={() => selectLocation('departure')}
                className="w-full p-4 flex items-center gap-3 border-b"
              >
                <MapPin className="w-5 h-5 text-gray-400" />
                <div className="flex-1 text-left">
                  <p className="text-xs text-gray-500">출발</p>
                  <p className={`font-medium ${bookingData.departure ? 'text-gray-900' : 'text-gray-400'}`}>
                    {bookingData.departure || '어디에서 출발하시나요?'}
                  </p>
                </div>
              </button>
              <button
                onClick={() => selectLocation('arrival')}
                className="w-full p-4 flex items-center gap-3"
              >
                <MapPin className="w-5 h-5 text-gray-400" />
                <div className="flex-1 text-left">
                  <p className="text-xs text-gray-500">도착</p>
                  <p className={`font-medium ${bookingData.arrival ? 'text-gray-900' : 'text-gray-400'}`}>
                    {bookingData.arrival || '어디로 가시나요?'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-bold mb-4">서비스</h3>
          <div className="grid grid-cols-5 gap-4">
            <button 
              onClick={() => setCurrentPage('booking')}
              className="flex flex-col items-center"
            >
              <div className="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center mb-2">
                <Car className="w-7 h-7 text-yellow-600" />
              </div>
              <span className="text-xs text-gray-700">택시</span>
            </button>
            <button 
              onClick={() => setCurrentPage('booking')}
              className="flex flex-col items-center"
            >
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-2">
                <Calendar className="w-7 h-7 text-blue-600" />
              </div>
              <span className="text-xs text-gray-700">택시예약</span>
            </button>
            <button 
              onClick={() => setCurrentPage('charter')}
              className="flex flex-col items-center"
            >
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-2">
                <Clock className="w-7 h-7 text-purple-600" />
              </div>
              <span className="text-xs text-gray-700">대절</span>
            </button>
            <button className="flex flex-col items-center">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-2">
                <Shield className="w-7 h-7 text-green-600" />
              </div>
              <span className="text-xs text-gray-700">보험</span>
            </button>
            <button className="flex flex-col items-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-2">
                <Menu className="w-7 h-7 text-gray-600" />
              </div>
              <span className="text-xs text-gray-700">더보기</span>
            </button>
          </div>
        </div>

        {popularRoutes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-4">인기 노선</h3>
            <div className="space-y-3">
              {popularRoutes.slice(0, 3).map((route, index) => (
                <button
                  key={index}
                  onClick={() => quickSelectRoute(route)}
                  className="w-full bg-gray-50 rounded-2xl p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                      {route.departure_is_airport === 'Y' || route.arrival_is_airport === 'Y' ? (
                        <Plane className="w-6 h-6 text-yellow-600" />
                      ) : (
                        <Car className="w-6 h-6 text-yellow-600" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">
                        {formatKorName(route.departure_kor)} → {formatKorName(route.arrival_kor)}
                      </p>
                      <p className="text-sm text-gray-500">
                        ${route.reservation_fee + route.local_payment_fee}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-4">검색 결과</h3>
            <div className="space-y-3">
              {searchResults.map((route, index) => (
                <button
                  key={index}
                  onClick={() => startBooking(route)}
                  className="w-full bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center">
                      <Car className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">
                        {formatKorName(route.departure_kor)} → {formatKorName(route.arrival_kor)}
                      </p>
                      <p className="text-sm text-gray-600">
                        예약금 ${route.reservation_fee} + 현지 ${route.local_payment_fee}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-yellow-600">
                      ${route.reservation_fee + route.local_payment_fee}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-yellow-400" />
            <h3 className="text-xl font-bold">안전한 여행의 시작</h3>
          </div>
          <p className="text-gray-300 mb-6">
            미주 한인 커뮤니티가 가장 신뢰하는 택시 예약 서비스
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">24/7</div>
              <div className="text-xs text-gray-400 mt-1">고객지원</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">10K+</div>
              <div className="text-xs text-gray-400 mt-1">만족 고객</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">4.9</div>
              <div className="text-xs text-gray-400 mt-1">평균 평점</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="flex">
          <button className="flex-1 py-4 text-center">
            <Home className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
            <div className="text-xs font-medium text-yellow-600">홈</div>
          </button>
          <button 
            className="flex-1 py-4 text-center" 
            onClick={() => setShowSearchModal(true)}
          >
            <FileText className="w-6 h-6 mx-auto mb-1 text-gray-400" />
            <div className="text-xs text-gray-400">내정보</div>
          </button>
          <button className="flex-1 py-4 text-center">
            <Headphones className="w-6 h-6 mx-auto mb-1 text-gray-400" />
            <div className="text-xs text-gray-400">고객센터</div>
          </button>
          <button className="flex-1 py-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-1 text-gray-400" />
            <div className="text-xs text-gray-400">커뮤니티</div>
          </button>
          <button 
            className="flex-1 py-4 text-center"
            onClick={() => setCurrentPage('admin')}
          >
            <Settings className="w-6 h-6 mx-auto mb-1 text-gray-400" />
            <div className="text-xs text-gray-400">설정</div>
          </button>
        </div>
      </nav>

      {/* 예약 조회 모달 */}
      {showSearchModal && (
        <BookingSearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
        />
      )}

      {/* 지역 선택 모달 */}
      {showRegionModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50"
          onClick={() => setShowRegionModal(false)}
        >
          <div 
            className="bg-white w-full rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
            <h3 className="text-xl font-bold mb-6">서비스 지역 선택</h3>
            <div className="space-y-2">
              {loadingRegions ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-yellow-400 mx-auto mb-4"></div>
                  <p className="text-gray-600">지역 정보를 불러오는 중...</p>
                </div>
              ) : (
                Object.entries(regionData).map(([code, data]) => (
                  <button
                    key={code}
                    className={`w-full p-4 rounded-2xl text-left transition-all ${
                      selectedRegion === code 
                        ? 'bg-yellow-50 border-2 border-yellow-400' 
                        : 'bg-gray-50 border-2 border-transparent'
                    }`}
                    onClick={() => {
                      setSelectedRegion(code);
                      setShowRegionModal(false);
                      showToast(`${data.name} 지역이 선택되었습니다.`, 'success');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900">{data.name}</h4>
                        <p className="text-sm text-gray-600 mt-0.5">{data.desc}</p>
                      </div>
                      {selectedRegion === code && (
                        <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowRegionModal(false)}
              className="w-full mt-6 py-3 bg-gray-100 rounded-2xl font-medium text-gray-700"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 위치 선택 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-white z-50">
          <div className="sticky top-0 bg-white border-b p-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setShowLocationModal(false)}>
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h3 className="text-lg font-bold flex-1">
                {locationSelectType === 'departure' ? '출발지 선택' : '도착지 선택'}
              </h3>
            </div>
          </div>

          <div className="p-4">
            {(loadingAllRoutes &&
              ((locationSelectType === 'departure' && uniqueDepartures.length === 0) ||
                (locationSelectType === 'arrival' && bookingData.departure && filteredArrivals.length === 0))) ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-yellow-400 mx-auto mb-4"></div>
                <p className="text-gray-600">위치 정보를 불러오는 중...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {airportsList.length > 0 && (
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Plane className="w-5 h-5 text-gray-400" />
                      공항
                    </h4>
                    <div className="space-y-2">
                      {airportsList.map((location, index) => (
                        <button
                          key={index}
                          className="w-full p-4 bg-gray-50 rounded-2xl text-left hover:bg-gray-100 transition-colors"
                          onClick={() => setLocation(location)}
                        >
                          <div className="font-medium text-gray-900">{location.name_kor}</div>
                          <div className="text-sm text-gray-500 mt-0.5">{location.name_eng || ''}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {placesList.length > 0 && (
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      일반 지역
                    </h4>
                    <div className="space-y-2">
                      {placesList.map((location, index) => (
                        <button
                          key={index}
                          className="w-full p-4 bg-gray-50 rounded-2xl text-left hover:bg-gray-100 transition-colors"
                          onClick={() => setLocation(location)}
                        >
                          <div className="font-medium text-gray-900">{location.name_kor}</div>
                          <div className="text-sm text-gray-500 mt-0.5">{location.name_eng || ''}</div>
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
    </div>
  );
};

// 예약 검색 모달
const BookingSearchModal = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { api } = useContext(AppContext);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('예약번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.searchBooking(searchTerm);

      if (response.success && response.data) {
        setBooking(response.data);
        setError('');
      } else {
        setBooking(null);
        setError('예약을 찾을 수 없습니다.');
      }
    } catch (err) {
      console.error('검색 오류:', err);
      setBooking(null);
      setError('예약 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '날짜 정보 없음';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { text: '예약 대기', class: 'bg-yellow-100 text-yellow-700' },
      'confirmed': { text: '예약 확정', class: 'bg-blue-100 text-blue-700' },
      'completed': { text: '완료', class: 'bg-green-100 text-green-700' },
      'cancelled': { text: '취소됨', class: 'bg-red-100 text-red-700' }
    };
    
    return statusMap[status] || statusMap['pending'];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">예약 조회</h2>
            <button onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="예약번호를 입력하세요 (예: YR145DD9)"
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <button 
              onClick={handleSearch}
              disabled={loading || !searchTerm.trim()}
              className="w-full py-4 bg-yellow-400 text-gray-900 rounded-2xl font-medium disabled:opacity-50"
            >
              {loading ? '조회 중...' : '조회하기'}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {booking && (
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{booking.booking_number}</h3>
                    <div className="mt-1">
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(booking.status).class}`}>
                        {getStatusBadge(booking.status).text}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600">
                      ${booking.pricing?.total_amount || 0}
                    </div>
                    <div className="text-sm text-gray-500">총 요금</div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">출발</div>
                      <div className="font-medium">{booking.trip_details?.departure?.location || '-'}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Navigation className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">도착</div>
                      <div className="font-medium">{booking.trip_details?.arrival?.location || '-'}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">일시</div>
                      <div className="font-medium">{formatDate(booking.trip_details?.departure?.datetime)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">예약자</div>
                      <div className="font-medium">{booking.customer_info?.name} ({booking.customer_info?.phone})</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button className="w-full py-3 bg-yellow-400 text-gray-900 rounded-2xl font-medium">
                    예약 상세 보기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 예약 페이지 컴포넌트
const BookingPage = () => {
  const { setCurrentPage, bookingData, setBookingData, api, showToast } = useContext(AppContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [priceData, setPriceData] = useState({
    reservation_fee: 20,
    local_payment_fee: 75,
    vehicle_upgrades: { xl_fee: 10, premium_fee: 25 }
  });
  const [errors, setErrors] = useState({});
  const totalSteps = 4;

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setBookingData(prev => ({
      ...prev,
      datetime: { ...prev.datetime, date: today }
    }));

    if (bookingData.priceData) {
      setPriceData({
        reservation_fee: bookingData.priceData.reservation_fee,
        local_payment_fee: bookingData.priceData.local_payment_fee,
        vehicle_upgrades: { xl_fee: 10, premium_fee: 25 }
      });
    }

    if (bookingData.selectedRoute) {
      setRouteData(bookingData.selectedRoute);
    } else {
      loadRouteData();
    }
  }, []);

  const loadRouteData = async () => {
    if (bookingData.departure && bookingData.arrival) {
      try {
        setLoading(true);
        const response = await api.searchRoute(
          bookingData.departure, 
          bookingData.arrival,
          'kor'
        );
        
        if (response.success && response.data) {
          setRouteData(response.data);
          const fetchedPrice = {
            reservation_fee: response.data.reservation_fee || 20,
            local_payment_fee: response.data.local_payment_fee || 75,
            vehicle_upgrades: { xl_fee: 10, premium_fee: 25 }
          };
          setPriceData(fetchedPrice);
          setBookingData(prev => ({
            ...prev,
            priceData: {
              reservation_fee: fetchedPrice.reservation_fee,
              local_payment_fee: fetchedPrice.local_payment_fee
            },
            selectedRoute: response.data
          }));
          showToast('경로 정보를 불러왔습니다.', 'success');
        }
      } catch (error) {
        console.error('경로 정보 조회 오류:', error);
        showToast('경로 정보를 불러오는데 실패했습니다. 기본 요금으로 진행됩니다.', 'warning');
      } finally {
        setLoading(false);
      }
    }
  };

  const calculateTotalPrice = () => {
    let total = priceData.reservation_fee + priceData.local_payment_fee;
    
    if (bookingData.vehicle === 'xl') {
      total += priceData.vehicle_upgrades.xl_fee;
    } else if (bookingData.vehicle === 'premium') {
      total += priceData.vehicle_upgrades.premium_fee;
    }
    
    return total;
  };

  const completeBooking = async () => {
    setLoading(true);
    try {
      const bookingRequest = {
        customer_info: {
          name: bookingData.customer.name,
          phone: bookingData.customer.phone,
          kakao_id: bookingData.customer.kakao || ''
        },
        service_info: {
          type: bookingData.serviceType,
          region: bookingData.region
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
          vehicle_upgrade_fee: bookingData.vehicle === 'xl' ? priceData.vehicle_upgrades.xl_fee :
                              bookingData.vehicle === 'premium' ? priceData.vehicle_upgrades.premium_fee : 0,
          total_amount: calculateTotalPrice()
        }
      };

      const response = await api.createBooking(bookingRequest);
      
      if (response.success) {
        setBookingData(prev => ({
          ...prev,
          bookingNumber: response.data.booking_number || 'YR' + Date.now().toString().slice(-6),
          totalAmount: response.data.total_amount || calculateTotalPrice()
        }));
        
        showToast('예약이 완료되었습니다!', 'success');
        setCurrentPage('confirmation');
      } else {
        throw new Error(response.message || '예약 생성에 실패했습니다.');
      }
    } catch (error) {
      showToast(error.message || '예약 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white p-4 flex items-center justify-between border-b">
        <button onClick={() => setCurrentPage('home')}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">
          {bookingData.departure?.split(' - ')[0]} → {bookingData.arrival?.split(' - ')[0]}
        </h1>
        <div className="w-6"></div>
      </div>

      <div className="p-4">
        <div className="bg-gray-100 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">출발지</span>
            <span className="font-medium">{bookingData.departure}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">도착지</span>
            <span className="font-medium">{bookingData.arrival}</span>
          </div>
        </div>

        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-4">예약 일시</h2>
              <div className="space-y-4">
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
                    className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                    className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>
            </div>
            
            {bookingData.serviceType === 'airport' && (
              <div>
                <h2 className="text-lg font-bold mb-4">항공편 정보 (선택)</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="항공편 번호 (예: KE001)"
                    value={bookingData.flight.number}
                    onChange={(e) => setBookingData(prev => ({
                      ...prev,
                      flight: { ...prev.flight, number: e.target.value }
                    }))}
                    className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <input
                    type="text"
                    placeholder="터미널 (예: T1)"
                    value={bookingData.flight.terminal}
                    onChange={(e) => setBookingData(prev => ({
                      ...prev,
                      flight: { ...prev.flight, terminal: e.target.value }
                    }))}
                    className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-4">탑승 정보</h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">탑승 인원</p>
                      <p className="text-sm text-gray-500">최대 8명 탑승</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => bookingData.passengers > 1 && setBookingData(prev => ({ ...prev, passengers: prev.passengers - 1 }))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold">{bookingData.passengers}</span>
                      <button
                        onClick={() => bookingData.passengers < 8 && setBookingData(prev => ({ ...prev, passengers: prev.passengers + 1 }))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">수하물 개수</p>
                      <p className="text-sm text-gray-500">캐리어, 가방 등</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => bookingData.luggage > 0 && setBookingData(prev => ({ ...prev, luggage: prev.luggage - 1 }))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold">{bookingData.luggage}</span>
                      <button
                        onClick={() => setBookingData(prev => ({ ...prev, luggage: prev.luggage + 1 }))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-4">차량 선택</h2>
              <div className="space-y-3">
                <button
                  onClick={() => setBookingData(prev => ({ ...prev, vehicle: 'standard' }))}
                  className={`w-full p-4 rounded-2xl border-2 ${
                    bookingData.vehicle === 'standard' 
                      ? 'border-yellow-400 bg-yellow-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Car className="w-6 h-6 text-gray-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">일반 택시</p>
                        <p className="text-sm text-gray-500">최대 4명</p>
                      </div>
                    </div>
                    <span className="text-gray-500">기본 요금</span>
                  </div>
                </button>

                <button
                  onClick={() => setBookingData(prev => ({ ...prev, vehicle: 'xl' }))}
                  className={`w-full p-4 rounded-2xl border-2 ${
                    bookingData.vehicle === 'xl' 
                      ? 'border-yellow-400 bg-yellow-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Car className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">대형 택시</p>
                        <p className="text-sm text-gray-500">최대 6명</p>
                      </div>
                    </div>
                    <span className="text-yellow-600">+$10</span>
                  </div>
                </button>

                <button
                  onClick={() => setBookingData(prev => ({ ...prev, vehicle: 'premium' }))}
                  className={`w-full p-4 rounded-2xl border-2 ${
                    bookingData.vehicle === 'premium' 
                      ? 'border-yellow-400 bg-yellow-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Star className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">프리미엄 택시</p>
                        <p className="text-sm text-gray-500">최대 4명</p>
                      </div>
                    </div>
                    <span className="text-yellow-600">+$25</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h2 className="text-lg font-bold mb-4">예약자 정보</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="이름"
                value={bookingData.customer.name}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, name: e.target.value }
                }))}
                className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="tel"
                placeholder="전화번호"
                value={bookingData.customer.phone}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, phone: e.target.value }
                }))}
                className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="text"
                placeholder="카카오톡 ID (선택)"
                value={bookingData.customer.kakao}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, kakao: e.target.value }
                }))}
                className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-4">예약 확인</h2>
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">일시</span>
                  <span className="font-medium">
                    {new Date(bookingData.datetime.date).toLocaleDateString('ko-KR')} {bookingData.datetime.time}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">차량</span>
                  <span className="font-medium">
                    {bookingData.vehicle === 'standard' ? '일반' :
                     bookingData.vehicle === 'xl' ? '대형' : '프리미엄'} 택시
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">탑승</span>
                  <span className="font-medium">{bookingData.passengers}명 / 짐 {bookingData.luggage}개</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">예약자</span>
                  <span className="font-medium">{bookingData.customer.name} ({bookingData.customer.phone})</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-4">결제 정보</h2>
              <div className="bg-yellow-50 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span>예약금</span>
                  <span className="font-medium">${priceData.reservation_fee}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>현지 결제금</span>
                  <span className="font-medium">${priceData.local_payment_fee}</span>
                </div>
                {bookingData.vehicle !== 'standard' && (
                  <div className="flex items-center justify-between">
                    <span>차량 업그레이드</span>
                    <span className="font-medium">
                      +${bookingData.vehicle === 'xl' ? priceData.vehicle_upgrades.xl_fee : priceData.vehicle_upgrades.premium_fee}
                    </span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">총 요금</span>
                    <span className="text-2xl font-bold text-yellow-600">${calculateTotalPrice()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-medium"
            >
              이전
            </button>
          )}
          <button
            onClick={() => {
              if (currentStep < totalSteps) {
                setCurrentStep(prev => prev + 1);
              } else {
                completeBooking();
              }
            }}
            disabled={loading}
            className={`${currentStep === 1 ? 'w-full' : 'flex-1'} py-4 bg-yellow-400 text-gray-900 rounded-2xl font-medium disabled:opacity-50`}
          >
            {loading ? '처리 중...' : (currentStep === totalSteps ? '예약 완료' : '다음')}
          </button>
        </div>
      </div>
    </div>
  );
};

// 대절 페이지 컴포넌트
const CharterPage = () => {
  const { setCurrentPage, selectedRegion, api, showToast } = useContext(AppContext);
  const [charterData, setCharterData] = useState({
    hours: 1,
    location: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    passengers: 1,
    luggage: 0,
    vehicle: 'standard',
    customer: {
      name: '',
      phone: '',
      kakao: ''
    }
  });
  const [loading, setLoading] = useState(false);

  const calculateTotalPrice = () => {
    let hourlyRate = 60;
    
    if (charterData.vehicle === 'xl') {
      hourlyRate = 70;
    } else if (charterData.vehicle === 'premium') {
      hourlyRate = 85;
    }
    
    return hourlyRate * charterData.hours + 30;
  };

  const completeCharter = async () => {
    setLoading(true);
    try {
      const charterRequest = {
        customer_info: {
          name: charterData.customer.name,
          phone: charterData.customer.phone,
          kakao_id: charterData.customer.kakao || ''
        },
        service_info: {
          type: 'charter',
          region: selectedRegion
        },
        trip_details: {
          departure: {
            location: charterData.location || '고객 지정 위치',
            datetime: new Date(`${charterData.date}T${charterData.time}`)
          },
          arrival: {
            location: charterData.location || '고객 지정 위치'
          }
        },
        charter_info: {
          hours: charterData.hours,
          total_amount: calculateTotalPrice()
        },
        vehicles: [{
          type: charterData.vehicle,
          passengers: charterData.passengers,
          luggage: charterData.luggage
        }],
        passenger_info: {
          total_passengers: charterData.passengers,
          total_luggage: charterData.luggage
        },
        pricing: {
          reservation_fee: 30,
          service_fee: calculateTotalPrice() - 30,
          vehicle_upgrade_fee: 0,
          total_amount: calculateTotalPrice()
        }
      };

      const response = await api.createBooking(charterRequest);
      
      if (response.success) {
        showToast('대절 예약이 완료되었습니다!', 'success');
        setCurrentPage('confirmation');
      } else {
        throw new Error(response.message || '예약 실패');
      }
    } catch (error) {
      showToast(error.message || '대절 예약 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white p-4 flex items-center justify-between border-b">
        <button onClick={() => setCurrentPage('home')}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">택시 대절</h1>
        <div className="w-6"></div>
      </div>

      <div className="p-4">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            시간제 택시 대절
          </h2>
          <p className="text-gray-800">여행, 업무, 행사 등 자유롭게 이용하세요</p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-4">대절 시간</h3>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4, 6, 8, 10, 12].map(hour => (
                <button
                  key={hour}
                  onClick={() => setCharterData(prev => ({ ...prev, hours: hour }))}
                  className={`py-3 rounded-xl border-2 font-medium ${
                    charterData.hours === hour
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {hour}시간
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">대기 장소</h3>
            <input
              type="text"
              placeholder="픽업 장소를 입력하세요"
              value={charterData.location}
              onChange={(e) => setCharterData(prev => ({ ...prev, location: e.target.value }))}
              className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">시작 일시</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                value={charterData.date}
                onChange={(e) => setCharterData(prev => ({ ...prev, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="time"
                value={charterData.time}
                onChange={(e) => setCharterData(prev => ({ ...prev, time: e.target.value }))}
                className="p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">차량 선택</h3>
            <div className="space-y-3">
              <button
                onClick={() => setCharterData(prev => ({ ...prev, vehicle: 'standard' }))}
                className={`w-full p-4 rounded-2xl border-2 ${
                  charterData.vehicle === 'standard' 
                    ? 'border-yellow-400 bg-yellow-50' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Car className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">일반 차량</p>
                      <p className="text-sm text-gray-500">시간당 $60</p>
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCharterData(prev => ({ ...prev, vehicle: 'xl' }))}
                className={`w-full p-4 rounded-2xl border-2 ${
                  charterData.vehicle === 'xl' 
                    ? 'border-yellow-400 bg-yellow-50' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Car className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">대형 차량</p>
                      <p className="text-sm text-gray-500">시간당 $70</p>
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setCharterData(prev => ({ ...prev, vehicle: 'premium' }))}
                className={`w-full p-4 rounded-2xl border-2 ${
                  charterData.vehicle === 'premium' 
                    ? 'border-yellow-400 bg-yellow-50' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Star className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">프리미엄 차량</p>
                      <p className="text-sm text-gray-500">시간당 $85</p>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">예약자 정보</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="이름"
                value={charterData.customer.name}
                onChange={(e) => setCharterData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, name: e.target.value }
                }))}
                className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="tel"
                placeholder="전화번호"
                value={charterData.customer.phone}
                onChange={(e) => setCharterData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, phone: e.target.value }
                }))}
                className="w-full p-3 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold">총 요금</span>
              <span className="text-2xl font-bold text-yellow-600">${calculateTotalPrice()}</span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>예약금: $30</p>
              <p>시간당 요금: ${charterData.vehicle === 'standard' ? 60 : charterData.vehicle === 'xl' ? 70 : 85} × {charterData.hours}시간</p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <button
          onClick={completeCharter}
          disabled={loading || !charterData.customer.name || !charterData.customer.phone}
          className="w-full py-4 bg-yellow-400 text-gray-900 rounded-2xl font-medium disabled:opacity-50"
        >
          {loading ? '처리 중...' : '대절 예약하기'}
        </button>
      </div>
    </div>
  );
};

// 검색 페이지 컴포넌트
const SearchPage = () => {
  const { setCurrentPage, api, setBookingData } = useContext(AppContext);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.searchBooking(searchValue.trim());
      setResults(response.success && response.data ? [response.data] : []);
    } catch (error) {
      console.error('검색 오류:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white p-4 flex items-center justify-between border-b">
        <button onClick={() => setCurrentPage('home')}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">예약 조회</h1>
        <div className="w-6"></div>
      </div>

      <div className="p-4">
        <div className="mb-6">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="예약번호를 입력하세요"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !searchValue.trim()}
            className="w-full py-3.5 bg-yellow-400 text-gray-900 rounded-2xl font-medium disabled:opacity-50"
          >
            {loading ? '조회 중...' : '조회하기'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((booking, index) => (
              <div key={index} className="bg-gray-50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">{booking.booking_number}</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {booking.status === 'confirmed' ? '예약 확정' : '예약 대기'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{booking.trip_details?.departure?.location} → {booking.trip_details?.arrival?.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{new Date(booking.trip_details?.departure?.datetime).toLocaleString('ko-KR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="font-bold">${booking.pricing?.total_amount || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && results.length === 0 && searchValue && (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">예약 내역을 찾을 수 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 예약 확인 페이지
const ConfirmationPage = () => {
  const { setCurrentPage, bookingData } = useContext(AppContext);

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 p-8 text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-14 h-14 text-yellow-500" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">예약이 완료되었습니다!</h1>
        <p className="text-gray-800">곧 기사님이 배정될 예정입니다</p>
      </div>

      <div className="p-4 -mt-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 mb-2">예약번호</p>
            <p className="text-2xl font-bold tracking-wider">
              {bookingData.bookingNumber || 'YR241201DEMO'}
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">출발</span>
              <span className="font-medium">{bookingData.departure}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">도착</span>
              <span className="font-medium">{bookingData.arrival}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-600">일시</span>
              <span className="font-medium">
                {new Date(bookingData.datetime?.date).toLocaleDateString('ko-KR')} {bookingData.datetime?.time}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600">총 요금</span>
              <span className="text-xl font-bold text-yellow-600">
                ${bookingData.totalAmount || '95'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 mb-6">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            이용 안내
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 예약 확정 후 기사님 정보를 문자로 안내드립니다</li>
            <li>• 출발 1시간 전까지 취소 가능합니다</li>
            <li>• 기사님께 예약번호를 알려주세요</li>
          </ul>
        </div>

        <button
          onClick={() => setCurrentPage('home')}
          className="w-full py-4 bg-yellow-400 text-gray-900 rounded-2xl font-medium"
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
  const [activeTab, setActiveTab] = useState('data');
  const [taxiData, setTaxiData] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTaxiData = async () => {
    setLoading(true);
    try {
      const response = await api.getTaxiItems({ limit: 20 });
      if (response.success) {
        setTaxiData(response.data);
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
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white p-4 flex items-center justify-between border-b">
        <button onClick={() => setCurrentPage('home')}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">관리자 대시보드</h1>
        <div className="w-6"></div>
      </div>

      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('data')}
            className={`flex-1 py-3 text-center font-medium border-b-2 ${
              activeTab === 'data' 
                ? 'border-yellow-400 text-gray-900' 
                : 'border-transparent text-gray-500'
            }`}
          >
            데이터 조회
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-center font-medium border-b-2 ${
              activeTab === 'stats' 
                ? 'border-yellow-400 text-gray-900' 
                : 'border-transparent text-gray-500'
            }`}
          >
            통계
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'data' && (
          <div>
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-yellow-400 mx-auto mb-4"></div>
                <p className="text-gray-600">데이터를 불러오는 중...</p>
              </div>
            ) : taxiData.length === 0 ? (
              <EmptyState
                title="데이터가 없습니다"
                message="등록된 택시 노선이 없습니다."
                icon={Database}
              />
            ) : (
              <div className="space-y-3">
                {taxiData.map((item, index) => (
                  <div key={index} className="bg-white rounded-2xl p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-lg">
                        {item.region}
                      </span>
                      <span className="font-bold text-yellow-600">
                        ${item.reservation_fee + item.local_payment_fee}
                      </span>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 mb-1">
                        {item.departure_kor} → {item.arrival_kor}
                      </p>
                      <p className="text-gray-500">
                        예약금 ${item.reservation_fee} + 현지 ${item.local_payment_fee}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-200 border-t-yellow-400 mx-auto mb-4"></div>
                <p className="text-gray-600">통계를 불러오는 중...</p>
              </div>
            ) : stats.length === 0 ? (
              <EmptyState
                title="통계 데이터가 없습니다"
                message="아직 수집된 통계가 없습니다."
                icon={Activity}
              />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {stats.map((stat, index) => (
                    <div key={index} className="bg-white rounded-2xl p-4 border">
                      <h4 className="font-bold text-gray-900 mb-2">{stat._id}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">노선 수</span>
                          <span className="font-medium">{stat.count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">평균 요금</span>
                          <span className="font-medium text-yellow-600">
                            ${Math.round(stat.avgReservationFee + stat.avgLocalPaymentFee)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default YellorideApp;
