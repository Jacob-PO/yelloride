import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { ArrowLeft, Plus, Minus, X, ChevronRight, MapPin, Clock, Calendar, Search, Info, Plane, Building2, Car, CheckCircle, Phone, HeadphonesIcon, User, Menu, Globe, FileText, Users, Luggage, CreditCard, Shield, Star, AlertCircle, Check, ChevronDown, Navigation, DollarSign, UserCircle, Settings, LogOut, Home, Briefcase, HelpCircle, ChevronUp, Filter, RefreshCw, Trash2, Download, Upload, Database, Activity, Camera, ShoppingBag } from 'lucide-react';

// 전역 상태 관리
const AppContext = createContext();

// 개선된 API 서비스 클래스 (최종 버전)
class YellorideAPI {
  constructor() {
    this.baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://api.yelloride.com/api' 
      : 'http://localhost:5001/api';
    this.timeout = 30000; // 30초 타임아웃
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'X-Client-Version': '1.0.0',
      'X-Platform': 'web',
      ...options.headers
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      timeout: this.timeout,
      headers,
      ...options
    };

    // 타임아웃 처리
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
      // 네트워크 연결 오류
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
      }
      
      // 타임아웃 오류
      if (error.message.includes('시간이 초과')) {
        throw new Error('서버 응답이 지연되고 있습니다. 다시 시도해주세요.');
      }
      
      // 기타 오류
      console.error('API 요청 오류:', error);
      throw error;
    }
  }

  // 재시도 로직이 포함된 요청
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
        
        // 재시도하지 않을 오류들
        if (error.message.includes('400') || error.message.includes('401') || 
            error.message.includes('403') || error.message.includes('404')) {
          throw error;
        }
        
        // 마지막 시도가 아니면 잠시 대기 후 재시도
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

  async uploadTaxiExcel(formData) {
    return this.requestWithRetry('/taxi/upload', {
      method: 'POST',
      body: formData,
      headers: {}
    });
  }

  async uploadTaxiJson(data) {
    return this.requestWithRetry('/taxi/upload', {
      method: 'POST',
      body: JSON.stringify({ data }),
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 입력 데이터 검증
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

  // 예약 관련 API
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

  // 헬스 체크
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

  // 피드백 전송
  async sendFeedback(feedbackData) {
    return this.requestWithRetry('/feedback', {
      method: 'POST',
      body: JSON.stringify(feedbackData)
    });
  }
}

// 토스트 컴포넌트 (토스 스타일)
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
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border ${typeStyles[type]} max-w-sm transition-all duration-300 transform translate-x-0`}>
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

// 오프라인 감지 훅
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

// 토스 스타일 버튼 컴포넌트
const Button = ({ children, variant = 'primary', size = 'md', disabled = false, loading = false, onClick, className = '', icon: Icon, ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-2xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:cursor-not-allowed select-none';
  
  const variants = {
    primary: 'bg-yellow-400 text-gray-900 hover:bg-yellow-500 focus:ring-yellow-300 disabled:bg-gray-100 disabled:text-gray-400 shadow-sm',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300 disabled:bg-gray-50 disabled:text-gray-400',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300 disabled:text-gray-400',
    outline: 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50 focus:ring-gray-300 disabled:border-gray-100 disabled:text-gray-400',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-300 disabled:bg-gray-50 disabled:text-gray-400'
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm gap-1.5',
    md: 'px-4 py-3 text-base gap-2',
    lg: 'px-6 py-4 text-lg gap-2.5'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} ${isDisabled ? 'opacity-50' : ''}`}
      disabled={isDisabled}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <div className={`${iconSizes[size]} border-2 border-current border-t-transparent rounded-full animate-spin`}></div>
      ) : Icon && (
        <Icon className={iconSizes[size]} />
      )}
      {children}
    </button>
  );
};

// 토스 스타일 입력 컴포넌트
const Input = ({ label, icon: Icon, error, loading = false, className = '', ...props }) => {
  return (
    <div className={`${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Icon className={`h-5 w-5 ${loading ? 'text-yellow-500 animate-pulse' : 'text-gray-400'}`} />
          </div>
        )}
        <input
          className={`block w-full rounded-2xl border-2 ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-300' : 'border-gray-200 focus:border-yellow-400 focus:ring-yellow-300'} shadow-sm focus:ring-4 focus:ring-offset-0 ${Icon ? 'pl-12' : 'pl-4'} pr-4 py-3.5 text-base transition-all ${loading ? 'bg-gray-50' : 'bg-white'} placeholder-gray-400`}
          disabled={loading}
          {...props}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
};

// 토스 스타일 카드 컴포넌트
const Card = ({ children, className = '', onClick, loading = false, hover = false }) => {
  return (
    <div 
      className={`bg-white rounded-3xl shadow-sm border border-gray-100 ${hover || onClick ? 'hover:shadow-lg hover:scale-[1.02] cursor-pointer' : ''} transition-all duration-200 ${loading ? 'opacity-50 pointer-events-none' : ''} ${className}`}
      onClick={loading ? undefined : onClick}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-3xl z-10">
          <div className="w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      {children}
    </div>
  );
};

// 로딩 컴포넌트
const Loading = ({ text = '로딩 중...', size = 'md' }) => {
  const sizes = {
    sm: { spinner: 'w-6 h-6', text: 'text-sm', container: 'py-8' },
    md: { spinner: 'w-10 h-10', text: 'text-base', container: 'py-12' },
    lg: { spinner: 'w-14 h-14', text: 'text-lg', container: 'py-16' }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex flex-col items-center justify-center ${currentSize.container}`}>
      <div className={`animate-spin rounded-full ${currentSize.spinner} border-3 border-gray-200 border-t-yellow-400 mb-4`}></div>
      <p className={`text-gray-600 font-medium ${currentSize.text}`}>{text}</p>
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

// 예약 검색 모달 (토스 스타일)
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
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">예약 조회</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="space-y-4">
            <Input
              icon={Search}
              placeholder="예약번호를 입력하세요 (예: YR145DD9)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            
            <Button 
              className="w-full" 
              onClick={handleSearch} 
              disabled={loading || !searchTerm.trim()}
              loading={loading}
            >
              조회하기
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {booking && (
            <Card className="p-6">
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

                <div className="border-t border-gray-100 pt-4 space-y-3">
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
                  <Button className="w-full" variant="secondary">
                    예약 상세 보기
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
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
    const interval = setInterval(checkServerStatus, 30000); // 30초마다 체크

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

// 관리자 페이지 (토스 스타일)
const AdminPage = () => {
  const { setCurrentPage, api, showToast, regionData } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('data');
  const [taxiData, setTaxiData] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({
    region: '',
    search: '',
    departure_is_airport: '',
    arrival_is_airport: '',
    priceOnly: false
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const loadTaxiData = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };
      
      // 빈 필터 제거
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === false) {
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
        
        if (response.data.length === 0) {
          showToast('검색된 데이터가 없습니다.', 'info');
        }
      } else {
        throw new Error(response.message || '데이터 로드 실패');
      }
    } catch (error) {
      showToast(error.message || '데이터를 불러오는데 실패했습니다.', 'error');
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
        if (response.data.length === 0) {
          showToast('통계 데이터가 없습니다. 먼저 택시 데이터를 업로드해주세요.', 'info');
        }
      } else {
        throw new Error(response.message || '통계 로드 실패');
      }
    } catch (error) {
      showToast(error.message || '통계를 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteAllData = async () => {
    if (!window.confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    const confirmText = prompt('전체 데이터를 삭제하려면 "DELETE_ALL"을 입력하세요:');
    if (confirmText !== 'DELETE_ALL') {
      showToast('삭제가 취소되었습니다.', 'info');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/taxi/all', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirm: 'DELETE_ALL' })
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message, 'success');
        setTaxiData([]);
        setStats([]);
        setPagination(prev => ({ ...prev, total: 0, pages: 1 }));
      } else {
        showToast(data.message || '삭제 실패', 'error');
      }
    } catch (error) {
      showToast('서버 연결 실패', 'error');
    } finally {
      setLoading(false);
    }
  };

  const uploadExcel = async () => {
    if (!selectedFile) {
      showToast('업로드할 파일을 선택해주세요.', 'warning');
      return;
    }

    setUploading(true);
    try {
      let response;
      if (selectedFile.name.endsWith('.json')) {
        const text = await selectedFile.text();
        const data = JSON.parse(text);
        response = await api.uploadTaxiJson(data);
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        response = await api.uploadTaxiExcel(formData);
      }
      if (response.success) {
        showToast('업로드가 완료되었습니다.', 'success');
        loadTaxiData();
      } else {
        showToast(response.message || '업로드 실패', 'error');
      }
    } catch (error) {
      showToast(error.message || '업로드 실패', 'error');
    } finally {
      setUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // 필터 변경 시 첫 페이지로
  };

  const resetFilters = () => {
    setFilters({
      region: '',
      search: '',
      departure_is_airport: '',
      arrival_is_airport: '',
      priceOnly: false
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  useEffect(() => {
    if (activeTab === 'data') {
      loadTaxiData();
    } else if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab, pagination.page, filters]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    
    // 탭 변경 시 필터와 페이지네이션 초기화
    if (tabId === 'data') {
      resetFilters();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentPage('home')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
                <p className="text-sm text-gray-500 mt-1">택시 데이터 관리 시스템</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">Admin</span>
              </div>
              <Button variant="ghost" size="sm">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'data', label: '데이터 조회', icon: Database },
              { id: 'stats', label: '통계', icon: Activity }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-yellow-400 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 데이터 조회 탭 */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h4 className="font-bold text-lg mb-6">엑셀 업로드</h4>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="flex-1"
                />
                <Button onClick={uploadExcel} loading={uploading} icon={Upload}>
                  업로드
                </Button>
              </div>
            </Card>
            {/* 필터 섹션 */}
            <Card className="p-6">
              <h4 className="font-bold text-lg mb-6">필터 및 검색</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">지역</label>
                  <select
                    value={filters.region}
                    onChange={(e) => handleFilterChange('region', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-300 focus:ring-offset-0 transition-all"
                  >
                    <option value="">전체 지역</option>
                    {Object.entries(regionData).map(([code, data]) => (
                      <option key={code} value={code}>{data.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">출발지 공항</label>
                  <select
                    value={filters.departure_is_airport}
                    onChange={(e) => handleFilterChange('departure_is_airport', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-300 focus:ring-offset-0 transition-all"
                  >
                    <option value="">전체</option>
                    <option value="Y">공항</option>
                    <option value="N">일반 지역</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">도착지 공항</label>
                  <select
                    value={filters.arrival_is_airport}
                    onChange={(e) => handleFilterChange('arrival_is_airport', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-300 focus:ring-offset-0 transition-all"
                  >
                    <option value="">전체</option>
                    <option value="Y">공항</option>
                    <option value="N">일반 지역</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
                  <input
                    type="text"
                    placeholder="출발지 또는 도착지 검색"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-300 focus:ring-offset-0 transition-all"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.priceOnly}
                      onChange={(e) => handleFilterChange('priceOnly', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-yellow-400 focus:ring-yellow-300"
                    />
                    <span className="text-sm font-medium text-gray-700">가격 있음</span>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button onClick={loadTaxiData} loading={loading} icon={Search}>
                  검색
                </Button>
                <Button onClick={resetFilters} variant="outline" icon={RefreshCw}>
                  필터 초기화
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">택시 노선 데이터</h3>
                <div className="flex gap-3">
                  <Button onClick={loadTaxiData} variant="outline" size="sm" loading={loading} icon={RefreshCw}>
                    새로고침
                  </Button>
                  <Button onClick={deleteAllData} variant="danger" size="sm" icon={Trash2}>
                    전체 삭제
                  </Button>
                </div>
              </div>

              {loading ? (
                <Loading text="데이터를 불러오는 중..." />
              ) : taxiData.length === 0 ? (
                <EmptyState
                  title="데이터가 없습니다"
                  message="필터 조건을 변경하거나 새로운 데이터를 등록해주세요."
                  icon={Database}
                />
              ) : (
                <div>
                  <div className="mb-4 text-sm text-gray-600 flex justify-between items-center">
                    <span>
                      총 {pagination.total}개 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
                    </span>
                    <span>
                      페이지 {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto -mx-6">
                    <div className="inline-block min-w-full align-middle px-6">
                      <div className="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-2xl">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">지역</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출발지</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">도착지</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">예약료</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">현지료</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총액</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">우선순위</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {taxiData.map((item, index) => (
                              <tr key={index} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    {item.region}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    {item.departure_is_airport === 'Y' && <Plane className="w-4 h-4 text-gray-400" />}
                                    <div>
                                      <div className="font-medium text-gray-900">{item.departure_kor}</div>
                                      <div className="text-xs text-gray-500">{item.departure_eng}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    {item.arrival_is_airport === 'Y' && <Plane className="w-4 h-4 text-gray-400" />}
                                    <div>
                                      <div className="font-medium text-gray-900">{item.arrival_kor}</div>
                                      <div className="text-xs text-gray-500">{item.arrival_eng}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">${item.reservation_fee}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">${item.local_payment_fee}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-yellow-600">
                                  ${item.reservation_fee + item.local_payment_fee}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.priority || 99}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* 페이지네이션 */}
                  <div className="mt-6 flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1 || loading}
                    >
                      이전
                    </Button>
                    
                    <div className="flex gap-2">
                      {[...Array(Math.min(5, Math.ceil(pagination.total / pagination.limit)))].map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            variant={pagination.page === pageNum ? "primary" : "ghost"}
                            size="sm"
                            onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(Math.ceil(pagination.total / pagination.limit), prev.page + 1) }))}
                      disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit) || loading}
                    >
                      다음
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
        

        {/* 통계 탭 */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">지역별 통계</h3>
                <Button onClick={loadStats} variant="outline" loading={loading} icon={RefreshCw}>
                  새로고침
                </Button>
              </div>

              {loading ? (
                <Loading text="통계를 불러오는 중..." />
              ) : stats.length === 0 ? (
                <EmptyState
                  title="통계 데이터가 없습니다"
                  message="먼저 택시 노선 데이터를 등록해주세요."
                  icon={Activity}
                />
              ) : (
                <div className="space-y-6">
                  {/* 요약 카드 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-gray-900 rounded-3xl p-6 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <Database className="w-8 h-8 opacity-20" />
                        <div className="text-3xl font-bold">{stats.reduce((sum, stat) => sum + stat.count, 0)}</div>
                      </div>
                      <h4 className="text-lg font-semibold">총 노선 수</h4>
                      <p className="text-sm opacity-75 mt-1">등록된 전체 택시 노선</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-400 to-green-500 text-white rounded-3xl p-6 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <DollarSign className="w-8 h-8 opacity-20" />
                        <div className="text-3xl font-bold">
                          ${Math.round(stats.reduce((sum, stat) => sum + (stat.avgReservationFee + stat.avgLocalPaymentFee), 0) / stats.length)}
                        </div>
                      </div>
                      <h4 className="text-lg font-semibold">평균 총 요금</h4>
                      <p className="text-sm opacity-90 mt-1">노선별 평균 요금</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-400 to-blue-500 text-white rounded-3xl p-6 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <Globe className="w-8 h-8 opacity-20" />
                        <div className="text-3xl font-bold">{stats.length}</div>
                      </div>
                      <h4 className="text-lg font-semibold">서비스 지역</h4>
                      <p className="text-sm opacity-90 mt-1">운영 중인 지역 수</p>
                    </div>
                  </div>

                  {/* 지역별 상세 통계 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stats.map((stat, index) => (
                      <Card key={index} className="p-6 hover:shadow-lg" hover>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-xl font-bold text-gray-900">{stat._id}</h4>
                            <p className="text-sm text-gray-500 mt-1">지역 통계</p>
                          </div>
                          <div className="text-3xl font-bold text-yellow-500">{stat.count}</div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">평균 예약료</span>
                            <span className="font-semibold">${Math.round(stat.avgReservationFee)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">평균 현지료</span>
                            <span className="font-semibold">${Math.round(stat.avgLocalPaymentFee)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">평균 총액</span>
                            <span className="font-semibold text-yellow-600">${Math.round(stat.avgReservationFee + stat.avgLocalPaymentFee)}</span>
                          </div>
                          
                          <div className="pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 flex items-center gap-1">
                                <Plane className="w-4 h-4" />
                                공항 출발
                              </span>
                              <span className="font-semibold">{stat.airportDepartures}개</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 flex items-center gap-1">
                                <Plane className="w-4 h-4" />
                                공항 도착
                              </span>
                              <span className="font-semibold">{stat.airportArrivals}개</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">공항 노선 비율</span>
                              <span className="font-semibold text-blue-600">
                                {Math.round((stat.airportDepartures + stat.airportArrivals) / stat.count * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

// PWA 설치 프롬프트 (토스 스타일)
const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstall(false);
      setDeferredPrompt(null);
    }
  };

  if (!showInstall) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto bg-gray-900 text-white p-6 rounded-3xl shadow-2xl z-30">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-yellow-400 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-gray-900" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-1">앱으로 설치하기</h3>
          <p className="text-sm text-gray-300">홈 화면에 추가하고 더 빠르게 이용하세요</p>
          <div className="flex gap-3 mt-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowInstall(false)}
              className="bg-gray-700 text-white hover:bg-gray-600"
            >
              나중에
            </Button>
            <Button 
              size="sm" 
              onClick={handleInstall}
              className="bg-yellow-400 text-gray-900 hover:bg-yellow-500"
            >
              설치하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 성능 모니터링 훅
const usePerformance = () => {
  useEffect(() => {
    // 페이지 로드 성능 측정
    if ('performance' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            console.log('페이지 로드 시간:', entry.loadEventEnd - entry.loadEventStart, 'ms');
          }
        }
      });
      
      observer.observe({ entryTypes: ['navigation'] });
      
      return () => observer.disconnect();
    }
  }, []);
};

// 메인 앱 컴포넌트 - MongoDB 연동 버전 (토스 스타일)
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
  usePerformance();

  // MongoDB에서 지역 데이터 로드
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

  // 지역 코드를 한글 이름으로 변환
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

  // 지역 설명 생성
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

  // 지역 선택 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('selectedRegion', selectedRegion);
  }, [selectedRegion]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC로 이전 페이지로
      if (e.key === 'Escape' && currentPage !== 'home') {
        setCurrentPage('home');
      }
      
      // Ctrl+K로 관리자 페이지 (개발자용)
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

        {currentPage === 'home' && <HomePage />}
        {currentPage === 'booking' && <BookingPage />}
        {currentPage === 'charter' && <CharterPage />}
        {currentPage === 'search' && <SearchPage />}
        {currentPage === 'confirmation' && <ConfirmationPage />}
        {currentPage === 'admin' && <AdminPage />}
        
        {/* 전역 컴포넌트들 */}
        <ToastContainer />
        <ConnectionStatus />
        <PWAInstallPrompt />
        
        {/* 개발자 힌트 (프로덕션에서는 제거) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 left-4 text-xs text-gray-400 bg-gray-900 bg-opacity-90 text-white px-3 py-2 rounded-full z-50 backdrop-blur-sm">
            ESC: 홈으로 | Ctrl+K: 관리자
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
};

// 홈페이지 컴포넌트 - MongoDB 연동 버전 (토스 스타일)
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

  // 지역 코드와 영문 표기를 제거한 한글 이름 반환
  const formatKorName = (full) => {
    if (!full) return '';
    return full
      .replace(/^\w+\s+/, '') // 앞의 지역 코드 제거
      .split(' - ')[0];        // 영문 표기 제거
  };

  // 가격 정보가 존재하는지 확인
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

  // 선택된 지역에 따라 출발지 목록 필터링
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
        updated.arrival = null; // 출발지 변경 시 도착지 초기화
      }
      return updated;
    });
    setShowLocationModal(false);

    // 선택 완료 후 자동으로 경로 검색
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
    
    // 자동으로 예약 페이지로 이동
    setTimeout(() => {
      startBooking(route);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-gray-900" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">YELLORIDE</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <HelpCircle className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCurrentPage('admin')}
                title="관리자 페이지"
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm">
                <UserCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 지역 선택 배너 */}
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-500">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div 
            className="flex items-center justify-between cursor-pointer group"
            onClick={() => setShowRegionModal(true)}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Globe className="w-7 h-7 text-gray-900" />
              </div>
              <div>
                <p className="text-sm text-gray-800 font-medium">현재 서비스 지역</p>
                <h3 className="text-2xl font-bold text-gray-900">{currentRegionData?.name || selectedRegion}</h3>
                <p className="text-sm text-gray-800 mt-0.5">{currentRegionData?.desc || '서비스 지역'}</p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-900 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6 page-transition">
        {/* 여행 계획 카드 */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">어디로 모실까요?</h2>
          
          <div className="space-y-3">
            <button
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                bookingData.departure 
                  ? 'border-yellow-400 bg-yellow-50' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => selectLocation('departure')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-500 mb-1">출발지</div>
                  <div className={`font-semibold ${bookingData.departure ? 'text-gray-900' : 'text-gray-400'}`}>
                    {bookingData.departure || '어디서 출발하시나요?'}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
            
            <button
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                bookingData.arrival 
                  ? 'border-yellow-400 bg-yellow-50' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              onClick={() => selectLocation('arrival')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-500 mb-1">도착지</div>
                  <div className={`font-semibold ${bookingData.arrival ? 'text-gray-900' : 'text-gray-400'}`}>
                    {bookingData.arrival || '어디로 가시나요?'}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          </div>

          <Button
            className="w-full mt-6"
            size="lg"
            disabled={!bookingData.departure || !bookingData.arrival || loading}
            loading={loading}
            onClick={() => startBooking()}
            icon={ArrowLeft}
          >
            {loading ? '경로 검색 중...' : 
             bookingData.departure && bookingData.arrival ? '예약하기' : 
             '출발지와 도착지를 선택하세요'}
          </Button>
        </Card>

        {/* 인기 노선 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">인기 노선</h3>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">HOT</span>
          </div>
          
          {popularRoutes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {popularRoutes.map((route, index) => (
                <button
                  key={index}
                  className="p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all text-left group"
                  onClick={() => quickSelectRoute(route)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-yellow-600 transition-colors">
                        {route.departure_kor.split(' - ')[0]}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {route.arrival_kor.split(' - ')[0]}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="text-lg font-bold text-yellow-600">
                    ${route.reservation_fee + route.local_payment_fee}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">인기 노선을 불러오는 중...</p>
            </div>
          )}
        </Card>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">검색 결과</h3>
            <div className="space-y-3">
              {searchResults.map((route, index) => (
                <div
                  key={index}
                  className="p-4 border-2 border-gray-200 rounded-2xl hover:border-yellow-400 cursor-pointer transition-all group"
                  onClick={() => startBooking(route)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-lg">
                          {route.region}
                        </span>
                        {route.departure_is_airport === 'Y' && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Plane className="w-3 h-3" />
                            공항출발
                          </span>
                        )}
                        {route.arrival_is_airport === 'Y' && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Plane className="w-3 h-3" />
                            공항도착
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-gray-900 mb-1">
                        {route.departure_kor} → {route.arrival_kor}
                      </div>
                      <div className="text-xs text-gray-500">
                        {route.departure_eng} → {route.arrival_eng}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-yellow-600">
                        ${route.reservation_fee + route.local_payment_fee}
                      </div>
                      <div className="text-xs text-gray-500">
                        예약비 ${route.reservation_fee}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 서비스 메뉴 */}
        <div>
          <h3 className="text-lg font-bold mb-4">서비스</h3>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-6 text-center group" onClick={() => setCurrentPage('booking')} hover>
              <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Plane className="w-8 h-8 text-yellow-600" />
              </div>
              <h4 className="font-bold mb-1">공항 이동</h4>
              <p className="text-sm text-gray-600">빠르고 안전하게</p>
            </Card>
            
            <Card className="p-6 text-center group" onClick={() => setCurrentPage('charter')} hover>
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Briefcase className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="font-bold mb-1">택시 대절</h4>
              <p className="text-sm text-gray-600">시간제 이용</p>
            </Card>
            
            <Card className="p-6 text-center group" onClick={() => setShowSearchModal(true)} hover>
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="font-bold mb-1">예약 조회</h4>
              <p className="text-sm text-gray-600">예약 확인/변경</p>
            </Card>
            
            <Card className="p-6 text-center group" hover>
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <HeadphonesIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="font-bold mb-1">고객센터</h4>
              <p className="text-sm text-gray-600">24시간 지원</p>
            </Card>
          </div>
        </div>

        {/* 신뢰도 배너 */}
        <Card className="p-6 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div className="flex items-center gap-4 mb-4">
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
        </Card>
      </div>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe">
        <div className="max-w-lg mx-auto flex">
          <button className="flex-1 py-4 text-center group">
            <Home className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
            <div className="text-xs font-medium text-yellow-600">홈</div>
          </button>
          <button className="flex-1 py-4 text-center group" onClick={() => setShowSearchModal(true)}>
            <FileText className="w-6 h-6 mx-auto mb-1 text-gray-400 group-hover:text-gray-600" />
            <div className="text-xs text-gray-400 group-hover:text-gray-600">예약내역</div>
          </button>
          <button className="flex-1 py-4 text-center group">
            <HeadphonesIcon className="w-6 h-6 mx-auto mb-1 text-gray-400 group-hover:text-gray-600" />
            <div className="text-xs text-gray-400 group-hover:text-gray-600">고객센터</div>
          </button>
          <button className="flex-1 py-4 text-center group">
            <UserCircle className="w-6 h-6 mx-auto mb-1 text-gray-400 group-hover:text-gray-600" />
            <div className="text-xs text-gray-400 group-hover:text-gray-600">내정보</div>
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50 animate-fade-in"
          onClick={() => setShowRegionModal(false)}
        >
          <div 
            className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 animate-slide-up pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">서비스 지역 선택</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowRegionModal(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {loadingRegions ? (
                <Loading text="지역 정보를 불러오는 중..." size="sm" />
              ) : (
                Object.entries(regionData).map(([code, data]) => (
                  <button
                    key={code}
                    className={`w-full p-4 rounded-2xl text-left transition-all ${
                      selectedRegion === code 
                        ? 'bg-yellow-50 border-2 border-yellow-400' 
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
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
          </div>
        </div>
      )}

      {/* 위치 선택 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-white z-50 animate-fade-in">
          <div className="max-w-lg mx-auto h-full flex flex-col">
            <header className="bg-white border-b border-gray-100 p-4 sticky top-0">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowLocationModal(false)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h3 className="text-xl font-bold">
                  {locationSelectType === 'departure' ? '출발지 선택' : '도착지 선택'}
                </h3>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {(loadingAllRoutes &&
                ((locationSelectType === 'departure' && uniqueDepartures.length === 0) ||
                  (locationSelectType === 'arrival' && bookingData.departure && filteredArrivals.length === 0))) ? (
                <Loading text="위치 정보를 불러오는 중..." />
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
                            className="w-full p-4 rounded-2xl border-2 border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 text-left transition-all group"
                            onClick={() => setLocation(location)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-gray-900 group-hover:text-yellow-600">
                                  {location.name_kor}
                                </div>
                                <div className="text-sm text-gray-500 mt-0.5">{location.name_eng || ''}</div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                            </div>
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
                            className="w-full p-4 rounded-2xl border-2 border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 text-left transition-all group"
                            onClick={() => setLocation(location)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-gray-900 group-hover:text-yellow-600">
                                  {location.name_kor}
                                </div>
                                <div className="text-sm text-gray-500 mt-0.5">{location.name_eng || ''}</div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 예약 페이지 컴포넌트 (토스 스타일)
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

  const vehicleColorClasses = {
    standard: 'bg-gray-100',
    xl: 'bg-blue-100',
    premium: 'bg-purple-100'
  };

  const vehicleIconClasses = {
    standard: 'text-gray-600',
    xl: 'text-blue-600',
    premium: 'text-purple-600'
  };

  useEffect(() => {
    // 오늘 날짜 설정
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
      // 경로 정보 및 가격 조회
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

  const computeStepErrors = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 1:
        if (!bookingData.datetime.date) {
          newErrors.date = '날짜를 선택해주세요.';
        } else {
          const selectedDate = new Date(bookingData.datetime.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate < today) {
            newErrors.date = '오늘 이후 날짜를 선택해주세요.';
          }
        }
        if (!bookingData.datetime.time) {
          newErrors.time = '시간을 선택해주세요.';
        }
        break;
        
      case 2:
        if (bookingData.passengers < 1) {
          newErrors.passengers = '최소 1명의 승객이 필요합니다.';
        }
        if (bookingData.passengers > 8) {
          newErrors.passengers = '최대 8명까지 예약 가능합니다.';
        }
        break;
        
      case 3:
        if (!bookingData.customer.name.trim()) {
          newErrors.name = '이름을 입력해주세요.';
        }
        if (!bookingData.customer.phone.trim()) {
          newErrors.phone = '전화번호를 입력해주세요.';
        } else {
          const phoneRegex = /^[0-9-+\s()]+$/;
          if (!phoneRegex.test(bookingData.customer.phone)) {
            newErrors.phone = '올바른 전화번호 형식을 입력해주세요.';
          }
        }
        break;
        
      case 4:
        // 최종 확인 단계는 항상 valid
        break;
        
      default:
        return false;
    }
    
    return newErrors;
  };

  const validateStep = (step) => {
    const newErrors = computeStepErrors(step);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isStepValid = React.useMemo(() => {
    return Object.keys(computeStepErrors(currentStep)).length === 0;
  }, [currentStep, bookingData]);

  const updateBookingData = (field, value) => {
    setBookingData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 에러 클리어
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
      if (validateStep(currentStep)) {
        setCurrentStep(prev => prev + 1);
      } else {
        showToast('입력 정보를 확인해주세요.', 'error');
      }
    } else {
      await completeBooking();
    }
  };

  const completeBooking = async () => {
    console.log('=== 예약 요청 데이터 ===');
    console.log('bookingData:', bookingData);
    console.log('priceData:', priceData);
    if (!validateStep(currentStep)) {
      showToast('예약 정보를 다시 확인해주세요.', 'error');
      return;
    }

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

      console.log('전송할 예약 데이터:', JSON.stringify(bookingRequest, null, 2));

      if (typeof bookingRequest.vehicles === 'string') {
        console.error('❌ vehicles가 문자열입니다!');
        showToast('데이터 형식 오류가 발생했습니다', 'error');
        return;
      }

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
      console.error('예약 실패 상세:', error);
      showToast(error.message || '예약 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / totalSteps) * 100;

  const stepTitles = {
    1: '날짜와 시간',
    2: '인원과 차량',
    3: '예약자 정보',
    4: '예약 확인'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage('home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{stepTitles[currentStep]}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{currentStep}/{totalSteps} 단계</p>
            </div>
          </div>
        </div>
      </header>

      {/* 진행률 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto">
          <div className="h-1 bg-gray-200">
            <div 
              className="h-full bg-yellow-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pb-32">
        {/* 경로 정보 카드 */}
        <Card className="p-4 mb-6 bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center justify-between mb-3">
            <span className="px-3 py-1 bg-yellow-400 text-gray-900 rounded-full text-sm font-bold">
              {bookingData.serviceType === 'airport' ? '공항 이동' : '일반 택시'}
            </span>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">${calculateTotalPrice()}</div>
              <div className="text-xs text-gray-700">총 예상 요금</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-600">출발</div>
                <div className="font-medium text-gray-900">{bookingData.departure}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Navigation className="w-4 h-4 text-gray-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-600">도착</div>
                <div className="font-medium text-gray-900">{bookingData.arrival}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* 단계별 컨텐츠 */}
        <div className="page-transition">
          {currentStep === 1 && (
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-6">언제 이용하시나요?</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Input
                  type="date"
                  label="날짜"
                  value={bookingData.datetime.date}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    datetime: { ...prev.datetime, date: e.target.value }
                  }))}
                  min={new Date().toISOString().split('T')[0]}
                  error={errors.date}
                />
                <Input
                  type="time"
                  label="시간"
                  value={bookingData.datetime.time}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    datetime: { ...prev.datetime, time: e.target.value }
                  }))}
                  error={errors.time}
                />
              </div>

              {bookingData.serviceType === 'airport' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900">항공편 정보 (선택사항)</h4>
                  <Input
                    icon={Plane}
                    placeholder="항공편 번호 (예: KE001)"
                    value={bookingData.flight.number}
                    onChange={(e) => setBookingData(prev => ({
                      ...prev,
                      flight: { ...prev.flight, number: e.target.value }
                    }))}
                  />
                  <Input
                    icon={Building2}
                    placeholder="터미널 (예: T1)"
                    value={bookingData.flight.terminal}
                    onChange={(e) => setBookingData(prev => ({
                      ...prev,
                      flight: { ...prev.flight, terminal: e.target.value }
                    }))}
                  />
                </div>
              )}
            </Card>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">인원과 짐을 알려주세요</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-semibold">승객 수</div>
                        <div className="text-sm text-gray-500">성인 및 아동 포함</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => bookingData.passengers > 1 && updateBookingData('passengers', bookingData.passengers - 1)}
                      >
                        <Minus className="w-5 h-5" />
                      </Button>
                      <span className="w-12 text-center font-bold text-lg">{bookingData.passengers}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => bookingData.passengers < 8 && updateBookingData('passengers', bookingData.passengers + 1)}
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Luggage className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-semibold">짐 개수</div>
                        <div className="text-sm text-gray-500">수하물 및 기내용 짐</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => bookingData.luggage > 0 && updateBookingData('luggage', bookingData.luggage - 1)}
                      >
                        <Minus className="w-5 h-5" />
                      </Button>
                      <span className="w-12 text-center font-bold text-lg">{bookingData.luggage}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateBookingData('luggage', bookingData.luggage + 1)}
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">차량을 선택해주세요</h3>
                <div className="space-y-3">
                  {[
                    { 
                      type: 'standard', 
                      name: '일반 택시', 
                      desc: '최대 4명 승차 가능한 일반 승용차', 
                      price: '기본 요금',
                      icon: Car,
                      color: 'gray'
                    },
                    { 
                      type: 'xl', 
                      name: '대형 택시', 
                      desc: '최대 6명 승차 가능한 SUV 또는 밴', 
                      price: '+$10',
                      icon: Car,
                      color: 'blue'
                    },
                    { 
                      type: 'premium', 
                      name: '프리미엄 택시', 
                      desc: '최대 4명 승차 가능한 고급 승용차', 
                      price: '+$25',
                      icon: Star,
                      color: 'purple'
                    }
                  ].map((vehicle) => (
                    <button
                      key={vehicle.type}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                        bookingData.vehicle === vehicle.type 
                          ? 'border-yellow-400 bg-yellow-50' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      onClick={() => updateBookingData('vehicle', vehicle.type)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 ${vehicleColorClasses[vehicle.type]} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <vehicle.icon className={`w-6 h-6 ${vehicleIconClasses[vehicle.type]}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-900">{vehicle.name}</span>
                            <span className="font-bold text-yellow-600">{vehicle.price}</span>
                          </div>
                          <p className="text-sm text-gray-600">{vehicle.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {currentStep === 3 && (
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-6">연락처 정보를 입력해주세요</h3>
              
              <div className="space-y-4">
                <Input
                  label="이름 *"
                  icon={User}
                  placeholder="성함을 입력하세요"
                  value={bookingData.customer.name}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    customer: { ...prev.customer, name: e.target.value }
                  }))}
                  error={errors.name}
                />
                <Input
                  label="전화번호 *"
                  type="tel"
                  icon={Phone}
                  placeholder="010-1234-5678"
                  value={bookingData.customer.phone}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    customer: { ...prev.customer, phone: e.target.value }
                  }))}
                  error={errors.phone}
                />
                <Input
                  label="카카오톡 ID (선택사항)"
                  icon={HeadphonesIcon}
                  placeholder="원활한 소통을 위해 입력해주세요"
                  value={bookingData.customer.kakao}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    customer: { ...prev.customer, kakao: e.target.value }
                  }))}
                />
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-2xl">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">개인정보 보호 안내</p>
                    <p>입력하신 정보는 예약 진행 및 고객 서비스 제공을 위해서만 사용되며, 안전하게 보호됩니다.</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">예약 내용을 확인해주세요</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      이용 일시
                    </span>
                    <span className="font-semibold text-gray-900">
                      {new Date(bookingData.datetime.date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })} {bookingData.datetime.time}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      이용 경로
                    </span>
                    <span className="font-semibold text-gray-900 text-right max-w-[60%]">
                      {bookingData.departure} → {bookingData.arrival}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      승객 정보
                    </span>
                    <span className="font-semibold text-gray-900">
                      {bookingData.passengers}명, 짐 {bookingData.luggage}개
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600 flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      차량 유형
                    </span>
                    <span className="font-semibold text-gray-900">
                      {bookingData.vehicle === 'standard' ? '일반 택시' :
                       bookingData.vehicle === 'xl' ? '대형 택시' : '프리미엄 택시'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-3">
                    <span className="text-gray-600 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      예약자
                    </span>
                    <span className="font-semibold text-gray-900 text-right">
                      {bookingData.customer.name} ({bookingData.customer.phone})
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  결제 정보
                </h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-700">
                    <span>예약 수수료</span>
                    <span className="font-medium">${priceData.reservation_fee}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>서비스 요금</span>
                    <span className="font-medium">${priceData.local_payment_fee}</span>
                  </div>
                  {bookingData.vehicle !== 'standard' && (
                    <div className="flex justify-between text-gray-700">
                      <span>차량 업그레이드</span>
                      <span className="font-medium">
                        +${bookingData.vehicle === 'xl' ? priceData.vehicle_upgrades.xl_fee : priceData.vehicle_upgrades.premium_fee}
                      </span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">총 결제 금액</span>
                      <span className="text-2xl font-bold text-yellow-600">${calculateTotalPrice()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-100 rounded-xl">
                  <p className="text-sm text-yellow-800 font-medium">
                    💳 온라인 결제: ${priceData.reservation_fee} (예약금)
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    💵 현지 결제: ${priceData.local_payment_fee + (bookingData.vehicle === 'xl' ? priceData.vehicle_upgrades.xl_fee : bookingData.vehicle === 'premium' ? priceData.vehicle_upgrades.premium_fee : 0)} (서비스 요금)
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentStep > 1 && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={loading}
            >
              이전
            </Button>
          )}
          <Button
            className={currentStep === 1 ? "w-full" : "flex-1"}
            size="lg"
            onClick={nextStep}
            disabled={loading || !isStepValid}
            loading={loading}
          >
            {currentStep === totalSteps ? '예약 완료하기' : '다음'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// 검색 페이지 컴포넌트 (토스 스타일)
const SearchPage = () => {
  const { setCurrentPage, api, setBookingData } = useContext(AppContext);
  const [searchType, setSearchType] = useState('number');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return '날짜 정보 없음';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (searchType === 'number') {
        response = await api.searchBooking(searchValue.trim());
        setResults(response.success && response.data ? [response.data] : []);
      } else {
        // 전화번호로 검색 (실제로는 별도 API 필요)
        setResults([]);
      }
    } catch (error) {
      console.error('검색 오류:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { text: '예약 대기', class: 'bg-yellow-100 text-yellow-700' },
      'confirmed': { text: '예약 확정', class: 'bg-blue-100 text-blue-700' },
      'driver_assigned': { text: '기사 배정', class: 'bg-green-100 text-green-700' },
      'completed': { text: '완료', class: 'bg-gray-100 text-gray-700' },
      'cancelled': { text: '취소됨', class: 'bg-red-100 text-red-700' }
    };
    
    const statusInfo = statusMap[status] || statusMap['pending'];
    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${statusInfo.class}`}>
        {statusInfo.text}
      </span>
    );
  };

  const openDetail = (booking) => {
    setSelectedBooking(booking);
    setShowDetail(true);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage('home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">예약 조회</h1>
          </div>
        </div>
      </header>

      {/* 검색 탭 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto flex">
          <button
            className={`flex-1 py-4 text-center font-medium border-b-2 transition-colors ${
              searchType === 'number' 
                ? 'border-yellow-400 text-gray-900' 
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setSearchType('number')}
          >
            예약번호
          </button>
          <button
            className={`flex-1 py-4 text-center font-medium border-b-2 transition-colors ${
              searchType === 'phone' 
                ? 'border-yellow-400 text-gray-900' 
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setSearchType('phone')}
          >
            전화번호
          </button>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <Card className="p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">예약 내역을 조회하세요</h2>
            <p className="text-gray-600">
              {searchType === 'number' 
                ? '예약번호를 입력해주세요' 
                : '예약 시 등록한 전화번호를 입력해주세요'
              }
            </p>
          </div>
          
          <div className="space-y-4">
            <Input
              icon={searchType === 'number' ? FileText : Phone}
              placeholder={searchType === 'number' ? '예: YR145DD9' : '010-1234-5678'}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            
            <Button 
              className="w-full"
              size="lg"
              onClick={handleSearch}
              disabled={loading || !searchValue.trim()}
              loading={loading}
            >
              조회하기
            </Button>
          </div>
        </Card>

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">검색 결과</h3>
              <span className="text-sm text-gray-600">{results.length}개</span>
            </div>
            
            {results.map((booking, index) => (
              <Card key={index} className="p-5" onClick={() => openDetail(booking)} hover>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-lg text-gray-900">{booking.booking_number}</h4>
                    <div className="mt-1">{getStatusBadge(booking.status)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-600">
                      ${booking.pricing?.total_amount || 0}
                    </div>
                    <div className="text-xs text-gray-500">총 요금</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Car className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{booking.service_info?.type === 'airport' ? '공항 택시' : '일반 택시'}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-700">
                      {booking.trip_details?.departure?.location || '출발지 정보 없음'} → {booking.trip_details?.arrival?.location || '도착지 정보 없음'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{formatDate(booking.trip_details?.departure?.datetime)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    예약일: {formatDate(booking.createdAt)}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 빈 결과 */}
        {!loading && results.length === 0 && searchValue && (
          <Card className="p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="font-bold text-lg mb-2">예약 내역이 없습니다</h3>
            <p className="text-gray-600 text-sm mb-6">
              입력하신 정보로 등록된 예약이 없습니다.<br />
              예약번호나 전화번호를 다시 확인해주세요.
            </p>
            <Button variant="outline" onClick={() => setSearchValue('')}>
              다시 검색
            </Button>
          </Card>
        )}

        {/* 빠른 메뉴 */}
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4">빠른 메뉴</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setCurrentPage('booking')} className="h-auto py-4">
              <div className="text-center">
                <Car className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">새 예약</div>
              </div>
            </Button>
            <Button variant="secondary" className="h-auto py-4">
              <div className="text-center">
                <HeadphonesIcon className="w-6 h-6 mx-auto mb-2" />
                <div className="text-sm font-medium">예약 문의</div>
              </div>
            </Button>
          </div>
        </Card>
      </div>

      {/* 상세 모달 */}
      {showDetail && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50 animate-fade-in">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto animate-slide-up pb-safe">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">예약 상세 정보</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowDetail(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-sm text-gray-500 mb-2">예약번호</h4>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{selectedBooking.booking_number}</span>
                  {getStatusBadge(selectedBooking.status)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm text-gray-500 mb-2">서비스</h4>
                  <p className="font-semibold">{selectedBooking.service_info?.type === 'airport' ? '공항 택시' : '일반 택시'}</p>
                </div>
                <div>
                  <h4 className="text-sm text-gray-500 mb-2">차량</h4>
                  <p className="font-semibold">
                    {selectedBooking.vehicles?.[0]?.type === 'standard' ? '일반' :
                     selectedBooking.vehicles?.[0]?.type === 'xl' ? '대형' : '프리미엄'} 택시
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm text-gray-500 mb-2">이용 일시</h4>
                <p className="font-semibold">{formatDate(selectedBooking.trip_details?.departure?.datetime)}</p>
              </div>

              <div>
                <h4 className="text-sm text-gray-500 mb-2">경로</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">출발</p>
                      <p className="font-semibold">{selectedBooking.trip_details?.departure?.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Navigation className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">도착</p>
                      <p className="font-semibold">{selectedBooking.trip_details?.arrival?.location}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm text-gray-500 mb-2">예약자 정보</h4>
                <div className="space-y-1">
                  <p className="font-semibold">{selectedBooking.customer_info?.name}</p>
                  <p className="text-gray-600">{selectedBooking.customer_info?.phone}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl">
                <h4 className="font-bold mb-3">요금 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">예약금</span>
                    <span className="font-medium">${selectedBooking.pricing?.reservation_fee || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">서비스 요금</span>
                    <span className="font-medium">${selectedBooking.pricing?.service_fee || 0}</span>
                  </div>
                  {selectedBooking.pricing?.vehicle_upgrade_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">차량 업그레이드</span>
                      <span className="font-medium">${selectedBooking.pricing.vehicle_upgrade_fee}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between">
                      <span className="font-bold">총 요금</span>
                      <span className="text-xl font-bold text-yellow-600">
                        ${selectedBooking.pricing?.total_amount || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              <Button className="w-full" onClick={() => {
                setShowDetail(false);
                setBookingData(prev => ({
                  ...prev,
                  bookingNumber: selectedBooking.booking_number,
                  totalAmount: selectedBooking.pricing?.total_amount || 0
                }));
                setCurrentPage('confirmation');
              }}>
                예약 확인서 보기
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline">예약 수정</Button>
                <Button variant="outline" className="text-red-600 hover:bg-red-50">예약 취소</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 대절 페이지 - MongoDB 연동 버전 (토스 스타일)
const CharterPage = () => {
  const { setCurrentPage, selectedRegion, regionData, api, showToast } = useContext(AppContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState([]);
  const totalSteps = 5;

  const getColorClasses = (color) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-600',
      pink: 'bg-pink-100 text-pink-600',
      gray: 'bg-gray-100 text-gray-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      yellow: 'bg-yellow-100 text-yellow-600'
    };
    return colorMap[color] || 'bg-gray-100 text-gray-600';
  };

  const vehicleColorClasses = {
    standard: 'bg-gray-100',
    xl: 'bg-blue-100',
    premium: 'bg-purple-100'
  };

  const vehicleIconClasses = {
    standard: 'text-gray-600',
    xl: 'text-blue-600',
    premium: 'text-purple-600'
  };
  
  const [charterData, setCharterData] = useState({
    purpose: null,
    hours: 1,
    waitingLocation: null,
    date: '',
    time: '',
    passengers: 1,
    luggage: 0,
    vehicle: 'standard',
    customer: {
      name: '',
      phone: '',
      kakao: '',
      requests: ''
    }
  });

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const timeString = now.toTimeString().slice(0, 5);
    
    setCharterData(prev => ({
      ...prev,
      date: today,
      time: timeString
    }));

    loadLocationOptions();
  }, [selectedRegion]);

  const loadLocationOptions = async () => {
    try {
      const response = await api.getDepartures(selectedRegion, 'kor');
      if (response.success && Array.isArray(response.data)) {
        setLocationOptions(response.data.slice(0, 5));
      }
    } catch (error) {
      console.error('대기 장소 로드 오류:', error);
      if (regionData[selectedRegion]) {
        setLocationOptions([
          ...regionData[selectedRegion].places.slice(0, 3),
          ...regionData[selectedRegion].airports.slice(0, 2)
        ]);
      }
    }
  };

  const updateCharterData = (field, value) => {
    setCharterData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateTotalPrice = () => {
    let hourlyRate = 60;
    
    if (charterData.vehicle === 'xl') {
      hourlyRate = 70;
    } else if (charterData.vehicle === 'premium') {
      hourlyRate = 85;
    }
    
    return hourlyRate * charterData.hours + 30;
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return charterData.purpose;
      case 2:
        return charterData.hours > 0 && charterData.waitingLocation;
      case 3:
        return charterData.date && charterData.time;
      case 4:
        return charterData.customer.name && charterData.customer.phone;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeCharter();
    }
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
            location: charterData.waitingLocation,
            datetime: new Date(`${charterData.date}T${charterData.time}`)
          },
          arrival: {
            location: charterData.waitingLocation
          }
        },
        charter_info: {
          hours: charterData.hours,
          purpose: charterData.purpose,
          waiting_location: charterData.waitingLocation,
          special_requests: charterData.customer.requests,
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

  const progress = (currentStep / totalSteps) * 100;

  const stepTitles = {
    1: '대절 용도',
    2: '시간과 장소',
    3: '일정 설정',
    4: '예약자 정보',
    5: '예약 확인'
  };

  const purposeOptions = [
    { id: 'tourism', icon: Camera, title: '관광', desc: '여행지 투어', color: 'blue' },
    { id: 'shopping', icon: ShoppingBag, title: '쇼핑', desc: '쇼핑몰 이동', color: 'pink' },
    { id: 'business', icon: Briefcase, title: '업무', desc: '업무 미팅', color: 'gray' },
    { id: 'medical', icon: Building2, title: '병원', desc: '병원 방문', color: 'green' },
    { id: 'event', icon: Star, title: '행사', desc: '특별 행사', color: 'purple' },
    { id: 'other', icon: FileText, title: '기타', desc: '기타 용도', color: 'yellow' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setCurrentPage('home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">택시 대절</h1>
              <p className="text-sm text-gray-500 mt-0.5">{stepTitles[currentStep]}</p>
            </div>
          </div>
        </div>
      </header>

      {/* 진행률 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto">
          <div className="h-1 bg-gray-200">
            <div 
              className="h-full bg-yellow-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pb-32">
        <div className="page-transition">
          {/* 1단계: 대절 용도 선택 */}
          {currentStep === 1 && (
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-2">대절 용도를 선택해주세요</h3>
              <p className="text-gray-600 mb-6">용도에 맞는 최적의 서비스를 제공해드립니다</p>
              
              <div className="grid grid-cols-2 gap-4">
                {purposeOptions.map((purpose) => (
                  <button
                    key={purpose.id}
                    className={`p-6 rounded-2xl border-2 transition-all text-center group ${
                      charterData.purpose === purpose.id 
                        ? 'border-yellow-400 bg-yellow-50' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    onClick={() => updateCharterData('purpose', purpose.id)}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform ${getColorClasses(purpose.color).split(' ')[0]}`}>
                      <purpose.icon className={`w-8 h-8 ${getColorClasses(purpose.color).split(' ')[1]}`} />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">{purpose.title}</h4>
                    <p className="text-sm text-gray-600">{purpose.desc}</p>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* 2단계: 시간 및 대기 장소 선택 */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-2">대절 시간을 선택해주세요</h3>
                <p className="text-gray-600 mb-6">시간당 $60, 최소 1시간부터 이용 가능합니다</p>
                
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[1, 2, 3, 4, 6, 8, 10, 12].map((hour) => (
                    <button
                      key={hour}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                        charterData.hours === hour 
                          ? 'border-yellow-400 bg-yellow-50 text-yellow-700' 
                          : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                      }`}
                      onClick={() => updateCharterData('hours', hour)}
                    >
                      {hour}시간
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">직접 입력:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={charterData.hours}
                      onChange={(e) => updateCharterData('hours', parseInt(e.target.value) || 1)}
                      className="w-16 px-3 py-2 text-center border-2 border-gray-200 rounded-xl focus:border-yellow-400 focus:ring-4 focus:ring-yellow-300 focus:ring-offset-0"
                    />
                    <span className="text-sm text-gray-600">시간</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">대기 장소를 선택해주세요</h3>
                <div className="space-y-3">
                  {locationOptions.map((location, index) => (
                    <button
                      key={index}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                        charterData.waitingLocation === (location.name_kor || location) 
                          ? 'border-yellow-400 bg-yellow-50' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      onClick={() => updateCharterData('waitingLocation', location.name_kor || location)}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="font-semibold text-gray-900">{location.name_kor || location}</div>
                          <div className="text-sm text-gray-500">{location.name_eng || ''}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* 3단계: 날짜/시간 및 승객 정보 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">시작 일정을 설정해주세요</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="date"
                    label="시작 날짜"
                    icon={Calendar}
                    value={charterData.date}
                    onChange={(e) => updateCharterData('date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Input
                    type="time"
                    label="시작 시간"
                    icon={Clock}
                    value={charterData.time}
                    onChange={(e) => updateCharterData('time', e.target.value)}
                  />
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">승객 정보</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-semibold">승객 수</div>
                        <div className="text-sm text-gray-500">성인 및 아동 포함</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => charterData.passengers > 1 && updateCharterData('passengers', charterData.passengers - 1)}
                      >
                        <Minus className="w-5 h-5" />
                      </Button>
                      <span className="w-12 text-center font-bold text-lg">{charterData.passengers}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => charterData.passengers < 8 && updateCharterData('passengers', charterData.passengers + 1)}
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Luggage className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-semibold">짐 개수</div>
                        <div className="text-sm text-gray-500">수하물 및 기내용 짐</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => charterData.luggage > 0 && updateCharterData('luggage', charterData.luggage - 1)}
                      >
                        <Minus className="w-5 h-5" />
                      </Button>
                      <span className="w-12 text-center font-bold text-lg">{charterData.luggage}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateCharterData('luggage', charterData.luggage + 1)}
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">차량 선택</h3>
                <div className="space-y-3">
                  {[
                    { type: 'standard', name: '일반 차량', price: '시간당 $60', desc: '최대 4명 승차 가능한 일반 승용차', icon: Car, color: 'gray' },
                    { type: 'xl', name: '대형 차량', price: '시간당 $70', desc: '최대 6명 승차 가능한 SUV 또는 밴', icon: Car, color: 'blue' },
                    { type: 'premium', name: '프리미엄 차량', price: '시간당 $85', desc: '최대 4명 승차 가능한 고급 승용차', icon: Star, color: 'purple' }
                  ].map((vehicle) => (
                    <button
                      key={vehicle.type}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                        charterData.vehicle === vehicle.type 
                          ? 'border-yellow-400 bg-yellow-50' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                      onClick={() => updateCharterData('vehicle', vehicle.type)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 ${vehicleColorClasses[vehicle.type]} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <vehicle.icon className={`w-6 h-6 ${vehicleIconClasses[vehicle.type]}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-900">{vehicle.name}</span>
                            <span className="font-bold text-yellow-600">{vehicle.price}</span>
                          </div>
                          <p className="text-sm text-gray-600">{vehicle.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* 4단계: 고객 정보 */}
          {currentStep === 4 && (
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-6">연락처 정보를 입력해주세요</h3>
              
              <div className="space-y-4">
                <Input
                  label="이름 *"
                  icon={User}
                  placeholder="성함을 입력해주세요"
                  value={charterData.customer.name}
                  onChange={(e) => setCharterData(prev => ({
                    ...prev,
                    customer: { ...prev.customer, name: e.target.value }
                  }))}
                />
                <Input
                  label="전화번호 *"
                  type="tel"
                  icon={Phone}
                  placeholder="010-1234-5678"
                  value={charterData.customer.phone}
                  onChange={(e) => setCharterData(prev => ({
                    ...prev,
                    customer: { ...prev.customer, phone: e.target.value }
                  }))}
                />
                <Input
                  label="카카오톡 ID (선택사항)"
                  icon={HeadphonesIcon}
                  placeholder="원활한 소통을 위해 입력해주세요"
                  value={charterData.customer.kakao}
                  onChange={(e) => setCharterData(prev => ({
                    ...prev,
                    customer: { ...prev.customer, kakao: e.target.value }
                  }))}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    요청사항 (선택사항)
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl resize-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-300 focus:ring-offset-0 transition-all"
                    rows="3"
                    placeholder="특별한 요청사항이 있으시면 알려주세요"
                    value={charterData.customer.requests}
                    onChange={(e) => setCharterData(prev => ({
                      ...prev,
                      customer: { ...prev.customer, requests: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* 5단계: 예약 확인 */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-6">대절 내용을 확인해주세요</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">용도</span>
                    <span className="font-semibold text-gray-900">
                      {purposeOptions.find(p => p.id === charterData.purpose)?.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">대기 장소</span>
                    <span className="font-semibold text-gray-900 text-right max-w-[60%]">{charterData.waitingLocation}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">시작 일시</span>
                    <span className="font-semibold text-gray-900">
                      {new Date(charterData.date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })} {charterData.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">대절 시간</span>
                    <span className="font-semibold text-gray-900">{charterData.hours}시간</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">승객 정보</span>
                    <span className="font-semibold text-gray-900">{charterData.passengers}명, 짐 {charterData.luggage}개</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">선택 차량</span>
                    <span className="font-semibold text-gray-900">
                      {{
                        'standard': '일반 차량',
                        'xl': '대형 차량',
                        'premium': '프리미엄 차량'
                      }[charterData.vehicle]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-gray-600">예약자</span>
                    <span className="font-semibold text-gray-900 text-right">
                      {charterData.customer.name} ({charterData.customer.phone})
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  결제 정보
                </h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-700">
                    <span>예약금</span>
                    <span className="font-medium">$30</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>시간당 요금 x {charterData.hours}시간</span>
                    <span className="font-medium">${calculateTotalPrice() - 30}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">총 결제 금액</span>
                      <span className="text-2xl font-bold text-yellow-600">${calculateTotalPrice()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-100 rounded-xl">
                  <p className="text-sm text-yellow-800 font-medium">
                    💳 온라인 결제: $30 (예약금)
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    💵 현지 결제: ${calculateTotalPrice() - 30} (시간당 요금)
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe">
        <div className="max-w-lg mx-auto flex gap-3">
          {currentStep > 1 && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={loading}
            >
              이전
            </Button>
          )}
          <Button
            className={currentStep === 1 ? "w-full" : "flex-1"}
            size="lg"
            onClick={nextStep}
            disabled={loading || !validateStep(currentStep)}
            loading={loading}
          >
            {currentStep === totalSteps ? '대절 예약 완료' : '다음'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// 예약 확인 페이지 (토스 스타일)
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

  const formatDateTime = (date, time) => {
    if (!date || !time) return '-';
    
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString('ko-KR', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      weekday: 'short'
    });
    
    return `${dateStr} ${time}`;
  };

  const getVehicleName = (type) => {
    const vehicles = {
      'standard': '일반 택시',
      'xl': '대형 택시',
      'premium': '프리미엄 택시'
    };
    return vehicles[type] || '일반 택시';
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-center">예약 완료</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto pb-8">
        {/* 성공 헤더 */}
        <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 p-8 text-center">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="w-14 h-14 text-yellow-500" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">예약이 완료되었습니다!</h2>
          <p className="text-gray-800">곧 기사님이 배정될 예정입니다</p>
        </div>

        <div className="px-4 -mt-8 space-y-4">
          {/* 예약번호 카드 */}
          <Card className="p-6 shadow-xl bg-white">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600 mb-2">예약번호</div>
              <div className="text-3xl font-bold tracking-wider text-gray-900 mb-4">
                {bookingData.bookingNumber || 'YR241201DEMO'}
              </div>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={copyBookingNumber}
                icon={copied ? Check : FileText}
              >
                {copied ? '복사완료!' : '복사하기'}
              </Button>
            </div>
          </Card>

          {/* 예약 상세 정보 */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center">
                <Car className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">예약 정보</h3>
                <span className="inline-flex px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full mt-1">
                  예약 확인중
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">서비스</span>
                <span className="font-semibold text-gray-900">
                  {bookingData.serviceType === 'airport' ? '공항 택시' : 
                   bookingData.serviceType === 'charter' ? '택시 대절' : '일반 택시'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">일시</span>
                <span className="font-semibold text-gray-900">
                  {formatDateTime(bookingData.datetime?.date, bookingData.datetime?.time)}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-gray-600">출발</span>
                <span className="font-semibold text-gray-900 text-right max-w-[60%]">
                  {bookingData.departure}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-gray-600">도착</span>
                <span className="font-semibold text-gray-900 text-right max-w-[60%]">
                  {bookingData.arrival}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">승객/짐</span>
                <span className="font-semibold text-gray-900">{bookingData.passengers}명 / 짐 {bookingData.luggage}개</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">차량</span>
                <span className="font-semibold text-gray-900">{getVehicleName(bookingData.vehicle)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">예약자</span>
                <span className="font-semibold text-gray-900 text-right">
                  {bookingData.customer?.name} ({bookingData.customer?.phone})
                </span>
              </div>
            </div>
          </Card>

          {/* 결제 정보 */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-bold text-lg">결제 정보</h3>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">총 결제금액</p>
                  <p className="text-sm text-gray-600 mt-0.5">예약금 + 서비스 요금</p>
                </div>
                <div className="text-3xl font-bold text-yellow-600">
                  ${bookingData.totalAmount || '95'}
                </div>
              </div>
            </div>
          </Card>

          {/* 안내사항 */}
          <Card className="p-6 bg-blue-50 border-blue-100">
            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              이용 안내
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                <span className="text-gray-700">예약 확정 후 기사님 정보를 문자로 안내드립니다</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                <span className="text-gray-700">출발 1시간 전까지 취소 가능합니다</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                <span className="text-gray-700">기사님께 예약번호를 알려주세요</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                <span className="text-gray-700">늦으실 경우 미리 연락 부탁드립니다</span>
              </div>
            </div>
          </Card>

          {/* 고객센터 */}
          <Card className="p-6">
            <h4 className="font-bold text-gray-900 mb-6 text-center">도움이 필요하신가요?</h4>
            <div className="grid grid-cols-3 gap-4">
              <button className="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all text-center group">
                <Phone className="w-6 h-6 mx-auto mb-2 text-gray-600 group-hover:text-gray-900" />
                <span className="text-sm font-medium text-gray-700">전화하기</span>
              </button>
              <button className="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all text-center group">
                <HeadphonesIcon className="w-6 h-6 mx-auto mb-2 text-gray-600 group-hover:text-gray-900" />
                <span className="text-sm font-medium text-gray-700">카카오톡</span>
              </button>
              <button className="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all text-center group">
                <FileText className="w-6 h-6 mx-auto mb-2 text-gray-600 group-hover:text-gray-900" />
                <span className="text-sm font-medium text-gray-700">이메일</span>
              </button>
            </div>
          </Card>
        </div>

        {/* 하단 버튼 */}
        <div className="px-4 mt-8 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setCurrentPage('search')}>
              예약 내역
            </Button>
            <Button onClick={() => setCurrentPage('home')}>
              홈으로
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YellorideApp;
