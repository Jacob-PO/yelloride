import React, { useState, useEffect, createContext, useContext } from 'react';
import { ArrowLeft, Plus, Minus, X, ChevronRight, MapPin, Clock, Calendar, Search, Info, Plane, Building2, Car, CheckCircle, Phone, HeadphonesIcon, User, Menu, Globe, FileText, Users, Luggage } from 'lucide-react';

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

    // 타임아웃 처리
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('요청 시간이 초과되었습니다.')), this.timeout)
    );

    try {
      const response = await Promise.race([
        fetch(url, config),
        timeoutPromise
      ]);
      
      // 네트워크 오류 체크
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // 상태 코드별 에러 처리
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

  // 예약 관련 API
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
    warning: 'bg-yellow-500 text-black',
    info: 'bg-blue-500 text-white'
  };

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${typeStyles[type]} max-w-sm animate-pulse`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-3 text-lg font-bold opacity-70 hover:opacity-100">
          ×
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

const Button = ({ children, variant = 'primary', size = 'md', disabled = false, loading = false, onClick, className = '', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500 disabled:bg-gray-300 disabled:text-gray-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 disabled:bg-gray-100 disabled:text-gray-400',
    success: 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500 disabled:bg-gray-300',
    yellow: 'bg-yellow-400 text-black hover:bg-yellow-500 focus:ring-yellow-400 disabled:bg-gray-300',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500 disabled:border-gray-200 disabled:text-gray-400',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 disabled:bg-gray-300'
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg'
  };

  const isDisabled = disabled || loading;

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} ${isDisabled ? 'opacity-50' : ''}`}
      disabled={isDisabled}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
      )}
      {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, error, loading = false, className = '', ...props }) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className={`h-5 w-5 ${loading ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
          </div>
        )}
        <input
          className={`block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-3 text-base transition-colors ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''} ${loading ? 'bg-gray-50' : ''}`}
          disabled={loading}
          {...props}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

const Card = ({ children, className = '', onClick, loading = false }) => {
  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${loading ? 'opacity-50 pointer-events-none' : ''} ${className}`}
      onClick={loading ? undefined : onClick}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-xl">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      {children}
    </div>
  );
};

const Loading = ({ text = '로딩 중...', size = 'md' }) => {
  const sizes = {
    sm: { spinner: 'w-4 h-4', text: 'text-sm', container: 'py-4' },
    md: { spinner: 'w-8 h-8', text: 'text-base', container: 'py-8' },
    lg: { spinner: 'w-12 h-12', text: 'text-lg', container: 'py-12' }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex flex-col items-center justify-center ${currentSize.container}`}>
      <div className={`animate-spin rounded-full ${currentSize.spinner} border-b-2 border-blue-500 mb-4`}></div>
      <p className={`text-gray-600 ${currentSize.text}`}>{text}</p>
    </div>
  );
};

// 빈 상태 컴포넌트
const EmptyState = ({ title, message, action, icon = '📭' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-4xl mb-4 opacity-50">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {message && (
        <p className="text-gray-600 mb-4 max-w-md">{message}</p>
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
    const interval = setInterval(checkServerStatus, 30000); // 30초마다 체크

    return () => clearInterval(interval);
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-red-500 text-white p-3 rounded-lg text-center text-sm font-medium z-50">
        🔴 인터넷 연결이 끊어졌습니다
      </div>
    );
  }

  if (!serverStatus) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-yellow-500 text-black p-3 rounded-lg text-center text-sm font-medium z-50">
        ⚠️ 서버 연결이 불안정합니다
      </div>
    );
  }

  return null;
};

// 관리자 페이지
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
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" className="p-2" onClick={() => setCurrentPage('home')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-xl font-bold">택시 데이터 관리</h1>
            </div>
            <div className="text-sm text-gray-600">
              관리자 모드
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-8">
            {[
              { id: 'data', label: '데이터 조회', icon: '📊' },
              { id: 'stats', label: '통계', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* 데이터 조회 탭 */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            {/* 필터 섹션 */}
            <Card className="p-6">
              <h4 className="font-semibold mb-4">필터 및 검색</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">지역</label>
                  <select
                    value={filters.region}
                    onChange={(e) => handleFilterChange('region', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
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
                    className="w-full p-2 border border-gray-300 rounded-lg"
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
                    className="w-full p-2 border border-gray-300 rounded-lg"
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
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="flex items-center mt-6 md:mt-0">
                  <input
                    id="priceOnly"
                    type="checkbox"
                    checked={filters.priceOnly}
                    onChange={(e) => handleFilterChange('priceOnly', e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="priceOnly" className="text-sm font-medium text-gray-700">가격 있음</label>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={loadTaxiData} variant="primary" size="sm" loading={loading}>
                  검색
                </Button>
                <Button onClick={resetFilters} variant="outline" size="sm">
                  필터 초기화
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">택시 노선 데이터</h3>
                <div className="flex gap-2">
                  <Button onClick={loadTaxiData} variant="outline" size="sm" loading={loading}>
                    새로고침
                  </Button>
                  <Button onClick={deleteAllData} variant="danger" size="sm">
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
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">지역</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">출발지</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">도착지</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">예약료</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">현지료</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">총액</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">우선순위</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {taxiData.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {item.region}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center">
                                <span>{item.departure_kor}</span>
                                {item.departure_is_airport === 'Y' && <span className="ml-1">✈️</span>}
                              </div>
                              <div className="text-xs text-gray-500">{item.departure_eng}</div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center">
                                <span>{item.arrival_kor}</span>
                                {item.arrival_is_airport === 'Y' && <span className="ml-1">✈️</span>}
                              </div>
                              <div className="text-xs text-gray-500">{item.arrival_eng}</div>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">${item.reservation_fee}</td>
                            <td className="px-4 py-3 text-sm font-medium">${item.local_payment_fee}</td>
                            <td className="px-4 py-3 text-sm font-bold text-yellow-600">
                              ${item.reservation_fee + item.local_payment_fee}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.priority || 99}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이지네이션 */}
                  <div className="mt-4 flex justify-between items-center">
                    <Button
                      variant="outline"
                      size="sm"
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
                            variant={pagination.page === pageNum ? "primary" : "outline"}
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
                      size="sm"
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">지역별 통계</h3>
                <Button onClick={loadStats} variant="outline" size="sm" loading={loading}>
                  새로고침
                </Button>
              </div>

              {loading ? (
                <Loading text="통계를 불러오는 중..." />
              ) : stats.length === 0 ? (
                <EmptyState
                  title="통계 데이터가 없습니다"
                  message="먼저 택시 노선 데이터를 등록해주세요."
                  icon="📊"
                />
              ) : (
                <div className="space-y-6">
                  {/* 요약 카드 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6">
                      <h4 className="text-lg font-semibold mb-2">총 노선 수</h4>
                      <p className="text-3xl font-bold">{stats.reduce((sum, stat) => sum + stat.count, 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6">
                      <h4 className="text-lg font-semibold mb-2">평균 총 요금</h4>
                      <p className="text-3xl font-bold">
                        ${Math.round(stats.reduce((sum, stat) => sum + (stat.avgReservationFee + stat.avgLocalPaymentFee), 0) / stats.length)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6">
                      <h4 className="text-lg font-semibold mb-2">서비스 지역</h4>
                      <p className="text-3xl font-bold">{stats.length}</p>
                    </div>
                  </div>

                  {/* 지역별 상세 통계 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.map((stat, index) => (
                      <Card key={index} className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-bold text-blue-900">{stat._id}</h4>
                          <span className="text-2xl font-bold text-blue-600">{stat.count}</span>
                        </div>
                        
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-blue-700">평균 예약료:</span>
                            <span className="font-semibold">${Math.round(stat.avgReservationFee)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">평균 현지료:</span>
                            <span className="font-semibold">${Math.round(stat.avgLocalPaymentFee)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">평균 총액:</span>
                            <span className="font-semibold text-blue-800">${Math.round(stat.avgReservationFee + stat.avgLocalPaymentFee)}</span>
                          </div>
                          <hr className="border-blue-200" />
                          <div className="flex justify-between">
                            <span className="text-blue-700">공항 출발:</span>
                            <span className="font-semibold">{stat.airportDepartures}개</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">공항 도착:</span>
                            <span className="font-semibold">{stat.airportArrivals}개</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-700">공항 노선:</span>
                            <span className="font-semibold">{Math.round((stat.airportDepartures + stat.airportArrivals) / stat.count * 100)}%</span>
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

// PWA 및 최종 개선사항
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
    <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto bg-blue-500 text-white p-4 rounded-lg shadow-lg z-30">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-semibold text-sm">앱으로 설치</div>
          <div className="text-xs opacity-90">홈 화면에 추가하여 빠르게 이용하세요</div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setShowInstall(false)}
            className="text-xs px-3 py-1"
          >
            나중에
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleInstall}
            className="text-xs px-3 py-1 bg-white text-blue-500"
          >
            설치
          </Button>
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

// 메인 앱 컴포넌트 - MongoDB 연동 버전
const YellorideApp = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedRegion, setSelectedRegion] = useState(() => {
    return localStorage.getItem('selectedRegion') || 'NY';
  });
  const [regionData, setRegionData] = useState({}); // DB에서 동적으로 로드
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
      // 모든 지역의 고유 값을 가져오는 API 호출
      const response = await api.getRegions();
      
      if (response.success && response.data) {
        // 서버에서 지역별로 그룹화된 데이터를 받아서 처리
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
        {/* 메타 태그 (실제 프로덕션에서는 HTML head에 위치) */}
        <div style={{ display: 'none' }}>
          {/* PWA를 위한 메타 정보는 실제 HTML에서 설정 */}
          <meta name="theme-color" content="#4285f4" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="YelloRide" />
          <link rel="apple-touch-icon" href="/icon-192x192.png" />
          <link rel="manifest" href="/manifest.json" />
        </div>

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
          <div className="fixed bottom-2 left-2 text-xs text-gray-400 bg-black bg-opacity-50 text-white px-2 py-1 rounded z-50">
            ESC: 홈으로 | Ctrl+K: 관리자
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
};

// 홈페이지 컴포넌트 - MongoDB 연동 버전
const HomePage = () => {
  const { setCurrentPage, selectedRegion, setSelectedRegion, regionData, loadingRegions, bookingData, setBookingData, api, showToast } = useContext(AppContext);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
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

  // fetchArrivals와 fetchDepartures 함수는 전체 데이터 로드 방식으로 대체되었습니다.

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
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-blue-500">YELLORIDE</h1>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="p-2">
                🔔
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                className="p-2"
                onClick={() => setCurrentPage('admin')}
                title="관리자 페이지"
              >
                ⚙️
              </Button>
              <Button variant="secondary" size="sm" className="p-2">
                👤
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 지역 선택 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-4">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowRegionModal(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                {selectedRegion}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{currentRegionData?.name || selectedRegion}</h3>
                <p className="text-sm text-gray-600">{currentRegionData?.desc || '서비스 지역'}</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* 여행 계획 카드 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-6">어디로 모실까요?</h2>
          
          <div className="space-y-1 relative">
            <div 
              className={`p-4 rounded-lg border cursor-pointer transition-all ${bookingData.departure ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
              onClick={() => selectLocation('departure')}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">출발지</div>
                  <div className={`font-medium ${bookingData.departure ? 'text-gray-900' : 'text-gray-400'}`}>
                    {bookingData.departure || '어디서 출발하시나요?'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute left-6 top-12 w-0.5 h-4 bg-gray-300"></div>
            
            <div 
              className={`p-4 rounded-lg border cursor-pointer transition-all ${bookingData.arrival ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
              onClick={() => selectLocation('arrival')}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">도착지</div>
                  <div className={`font-medium ${bookingData.arrival ? 'text-gray-900' : 'text-gray-400'}`}>
                    {bookingData.arrival || '어디로 가시나요?'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 인기 노선 */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-semibold">인기 노선</h3>
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-semibold">HOT</span>
          </div>
          
          {popularRoutes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {popularRoutes.map((route, index) => (
                <button
                  key={index}
                  className="bg-gray-100 hover:bg-blue-100 hover:border-blue-300 border border-gray-200 rounded-full px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                  onClick={() => quickSelectRoute(route)}
                >
                  <span>{route.departure_kor.split(' - ')[0]} → {route.arrival_kor.split(' - ')[0]}</span>
                  <span className="text-xs text-green-600 font-semibold">${route.reservation_fee + route.local_payment_fee}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">인기 노선을 불러오는 중...</p>
          )}
        </Card>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">검색 결과</h3>
            <div className="space-y-3">
              {searchResults.map((route, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition-colors"
                  onClick={() => startBooking(route)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {route.departure_kor} → {route.arrival_kor}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {route.departure_eng} → {route.arrival_eng}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">${route.reservation_fee + route.local_payment_fee}</div>
                      <div className="text-xs text-gray-500">예약비 ${route.reservation_fee} + 현지비 ${route.local_payment_fee}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-full ${route.region === 'NY' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {route.region}
                    </span>
                    {route.departure_is_airport === 'Y' && <span>✈️ 공항출발</span>}
                    {route.arrival_is_airport === 'Y' && <span>✈️ 공항도착</span>}
                    <span className="ml-auto bg-gray-100 px-2 py-1 rounded">우선순위 {route.priority || 99}</span>
                  </div>
                </div>
              ))}
            </div>
        </Card>
      )}

        {/* 모든 노선 */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">모든 노선</h3>
          {loadingAllRoutes ? (
            <p className="text-sm text-gray-500">모든 노선을 불러오는 중...</p>
          ) : allRoutes.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allRoutes.map((route, index) => (
                <div
                  key={index}
                  className="flex justify-between text-sm border-b pb-1"
                >
                  <span>
                    {route.departure_kor} → {route.arrival_kor}
                  </span>
                  <span className="text-blue-600 font-medium">
                    ${route.reservation_fee + route.local_payment_fee}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">노선 데이터가 없습니다.</p>
          )}
        </Card>

        {/* 서비스 메뉴 */}
        <div>
          <h3 className="font-semibold mb-4">서비스 메뉴</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 text-center" onClick={() => setCurrentPage('booking')}>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                ✈️
              </div>
              <div className="font-semibold mb-1">공항 이동</div>
              <div className="text-sm text-gray-600">빠르고 안전하게</div>
            </Card>
            
            <Card className="p-4 text-center" onClick={() => setCurrentPage('charter')}>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                🚙
              </div>
              <div className="font-semibold mb-1">택시 대절</div>
              <div className="text-sm text-gray-600">시간제 이용</div>
            </Card>
            
            <Card className="p-4 text-center" onClick={() => setCurrentPage('search')}>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                📋
              </div>
              <div className="font-semibold mb-1">예약 조회</div>
              <div className="text-sm text-gray-600">예약 확인/변경</div>
            </Card>
            
            <Card className="p-4 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                💬
              </div>
              <div className="font-semibold mb-1">고객센터</div>
              <div className="text-sm text-gray-600">24시간 지원</div>
            </Card>
          </div>
        </div>

        {/* 프로모션 */}
        <Card className="p-6 bg-gradient-to-r from-blue-500 to-green-500 text-white">
          <h3 className="text-lg font-bold mb-2">첫 예약 $10 할인!</h3>
          <p className="text-sm opacity-90 mb-4">신규 고객님께 특별한 혜택을 드립니다</p>
          <Button variant="secondary" size="sm">
            자세히 보기
          </Button>
        </Card>
      </div>

      {/* 예약하기 버튼 */}
      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40">
        <Button
          className="w-full shadow-lg"
          disabled={!bookingData.departure || !bookingData.arrival || loading}
          loading={loading}
          onClick={() => startBooking()}
        >
          {loading ? '경로 검색 중...' : 
           bookingData.departure && bookingData.arrival ? '예약하기' : 
           '출발지와 도착지를 선택하세요'}
        </Button>
      </div>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto flex">
          <button className="flex-1 py-3 text-center">
            <div className="text-blue-500 mb-1">🏠</div>
            <div className="text-xs font-medium text-blue-500">홈</div>
          </button>
          <button className="flex-1 py-3 text-center" onClick={() => setCurrentPage('search')}>
            <div className="text-gray-400 mb-1">📋</div>
            <div className="text-xs text-gray-400">예약내역</div>
          </button>
          <button className="flex-1 py-3 text-center">
            <div className="text-gray-400 mb-1">💬</div>
            <div className="text-xs text-gray-400">고객센터</div>
          </button>
          <button className="flex-1 py-3 text-center">
            <div className="text-gray-400 mb-1">👤</div>
            <div className="text-xs text-gray-400">내정보</div>
          </button>
        </div>
      </nav>

      {/* 지역 선택 모달 */}
      {showRegionModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50"
          onClick={() => setShowRegionModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowRegionModal(false)}
          tabIndex={-1}
        >
          <div 
            className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">서비스 지역 선택</h3>
              <Button 
                variant="secondary" 
                size="sm" 
                className="p-2"
                onClick={() => setShowRegionModal(false)}
                aria-label="모달 닫기"
              >
                ✕
              </Button>
            </div>
            <div className="space-y-2">
              {loadingRegions ? (
                <Loading text="지역 정보를 불러오는 중..." size="sm" />
              ) : (
                Object.entries(regionData).map(([code, data]) => (
                  <button
                    key={code}
                    className={`w-full p-4 rounded-lg cursor-pointer transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500 ${selectedRegion === code ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
                    onClick={() => {
                      setSelectedRegion(code);
                      setShowRegionModal(false);
                      showToast(`${data.name} 지역이 선택되었습니다.`, 'success');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold">{data.name}</h4>
                        <p className="text-sm text-gray-600">{data.desc}</p>
                      </div>
                      {selectedRegion === code && (
                        <CheckCircle className="w-5 h-5 text-blue-500" />
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
        <div className="fixed inset-0 bg-white z-50">
          <div className="max-w-md mx-auto h-full flex flex-col">
            <header className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="p-2" 
                  onClick={() => setShowLocationModal(false)}
                  aria-label="뒤로 가기"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h3 className="text-lg font-semibold">
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
                <>
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <span>✈️</span>
                      공항
                    </h4>
                    <div className="space-y-2">
                      {airportsList.map((location, index) => (
                        <button
                          key={index}
                          className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={() => setLocation(location)}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                        >
                          <div className="font-medium">{location.name_kor}</div>
                          <div className="text-sm text-gray-600">{location.name_eng || ''}</div>
                        </button>
                      ))}
                      {airportsList.length === 0 && (
                        <p className="text-sm text-gray-500">공항 목록이 없습니다.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <span>🏙️</span>
                      일반 지역
                    </h4>
                    <div className="space-y-2">
                      {placesList.map((location, index) => (
                        <button
                          key={index}
                          className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={() => setLocation(location)}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                        >
                          <div className="font-medium">{location.name_kor}</div>
                          <div className="text-sm text-gray-600">{location.name_eng || ''}</div>
                        </button>
                      ))}
                      {placesList.length === 0 && (
                        <p className="text-sm text-gray-500">일반 지역 목록이 없습니다.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
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
  const [routeData, setRouteData] = useState(null);
  const [priceData, setPriceData] = useState({
    reservation_fee: 20,
    local_payment_fee: 75,
    vehicle_upgrades: { xl_fee: 10, premium_fee: 25 }
  });
  const [errors, setErrors] = useState({});
  const totalSteps = 4;

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
        // 실제 API 호출로 경로 정보 및 가격 조회
        const response = await api.searchRoute(
          bookingData.departure, 
          bookingData.arrival,
          'kor'
        );
        
        if (response.success && response.data) {
          setRouteData(response.data);
          // 가격 정보 업데이트
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
        // 기본값 유지
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
          // 전화번호 형식 검증
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
    if (!validateStep(currentStep)) {
      showToast('예약 정보를 다시 확인해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      // 실제 백엔드 스펙에 맞는 예약 데이터 구성
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
        // 예약 번호를 전역 상태에 저장
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
      console.error('예약 오류:', error);
      showToast(error.message || '예약 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" className="p-2" onClick={() => setCurrentPage('home')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">예약하기</h1>
          </div>
        </div>
      </header>

      {/* 진행률 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">{currentStep}단계 / {totalSteps}단계</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 pb-32">
        {/* 경로 정보 카드 */}
        <Card className="p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
              {bookingData.serviceType === 'airport' ? '공항 이동' : '일반 택시'}
            </span>
            <span className="text-lg font-bold">${calculateTotalPrice()}</span>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <div>
                <div className="text-xs text-gray-600">출발지</div>
                <div className="font-medium">{bookingData.departure}</div>
              </div>
            </div>
            <div className="ml-1.5 w-0.5 h-4 bg-gray-300"></div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <div className="text-xs text-gray-600">도착지</div>
                <div className="font-medium">{bookingData.arrival}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* 단계별 컨텐츠 */}
        {currentStep === 1 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">언제 이용하시나요?</h3>
            
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
              <div className="space-y-4">
                <h4 className="font-medium">항공편 정보 (선택사항)</h4>
                <Input
                  placeholder="항공편 번호 (예: KE001)"
                  value={bookingData.flight.number}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    flight: { ...prev.flight, number: e.target.value }
                  }))}
                />
                <Input
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
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">인원과 짐을 알려주세요</h3>
            
            <div className="space-y-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">승객 수</div>
                  <div className="text-sm text-gray-600">성인 및 아동 포함</div>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={() => bookingData.passengers > 1 && updateBookingData('passengers', bookingData.passengers - 1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold">{bookingData.passengers}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={() => updateBookingData('passengers', bookingData.passengers + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">짐 개수</div>
                  <div className="text-sm text-gray-600">수하물 및 기내용 짐</div>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={() => bookingData.luggage > 0 && updateBookingData('luggage', bookingData.luggage - 1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold">{bookingData.luggage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={() => updateBookingData('luggage', bookingData.luggage + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <h4 className="font-medium mb-4">차량을 선택해주세요</h4>
            <div className="space-y-3">
              {[
                { type: 'standard', name: '일반 택시', desc: '최대 4명 승차 가능한 일반 승용차', price: '기본 요금' },
                { type: 'xl', name: '대형 택시', desc: '최대 6명 승차 가능한 SUV 또는 밴', price: '+$10' },
                { type: 'premium', name: '프리미엄 택시', desc: '최대 4명 승차 가능한 고급 승용차', price: '+$25' }
              ].map((vehicle) => (
                <div
                  key={vehicle.type}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    bookingData.vehicle === vehicle.type 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => updateBookingData('vehicle', vehicle.type)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium">{vehicle.name}</div>
                    <div className="text-sm font-semibold text-blue-600">{vehicle.price}</div>
                  </div>
                  <div className="text-sm text-gray-600">{vehicle.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {currentStep === 3 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">연락처 정보를 입력해주세요</h3>
            
            <div className="space-y-4">
              <Input
                label="이름 *"
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
                placeholder="원활한 소통을 위해 입력해주세요"
                value={bookingData.customer.kakao}
                onChange={(e) => setBookingData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, kakao: e.target.value }
                }))}
              />
            </div>
          </Card>
        )}

        {currentStep === 4 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">예약 내용을 확인해주세요</h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">이용 일시</span>
                <span className="font-medium">{bookingData.datetime.date} {bookingData.datetime.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">이용 경로</span>
                <span className="font-medium text-right">{bookingData.departure} → {bookingData.arrival}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">승객 정보</span>
                <span className="font-medium">{bookingData.passengers}명, 짐 {bookingData.luggage}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">연락처</span>
                <span className="font-medium">{bookingData.customer.name} ({bookingData.customer.phone})</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span>예약 수수료</span>
                <span>${priceData.reservation_fee}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>서비스 요금</span>
                <span>${priceData.local_payment_fee}</span>
              </div>
              {bookingData.vehicle !== 'standard' && (
                <div className="flex justify-between mb-2">
                  <span>차량 업그레이드</span>
                  <span>
                    ${bookingData.vehicle === 'xl' ? priceData.vehicle_upgrades.xl_fee : priceData.vehicle_upgrades.premium_fee}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between font-semibold text-lg">
                  <span>총 결제 금액</span>
                  <span className="text-yellow-600">${calculateTotalPrice()}</span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-md mx-auto flex gap-3">
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
            onClick={nextStep}
            disabled={loading || !isStepValid}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                처리 중...
              </div>
            ) : (
              currentStep === totalSteps ? '예약 완료' : '다음'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// 검색 페이지 컴포넌트
const SearchPage = () => {
  const { setCurrentPage, api } = useContext(AppContext);
  const [searchType, setSearchType] = useState('number'); // 'number' | 'phone'
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      alert('검색어를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (searchType === 'number') {
        // 예약번호로 검색
        response = await api.getBookingByNumber(searchValue.trim());
        setResults(response.success ? [response.data] : []);
      } else {
        // 전화번호로 검색 (실제로는 별도 API 필요)
        // 데모용 데이터
        if (searchValue.includes('1234')) {
          setResults([
            {
              booking_number: 'YR241201DEMO',
              status: 'confirmed',
              service_type: '공항 택시',
              departure: 'JFK 공항',
              arrival: '맨하탄 미드타운',
              date: '2024년 12월 5일',
              time: '오후 2:00',
              customer_name: '김철수',
              customer_phone: searchValue,
              total_amount: 95,
              created_at: '2024.12.01'
            }
          ]);
        } else {
          setResults([]);
        }
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
      'pending': { text: '예약 대기', class: 'bg-yellow-100 text-yellow-800' },
      'confirmed': { text: '예약 확정', class: 'bg-blue-100 text-blue-800' },
      'driver_assigned': { text: '기사 배정', class: 'bg-green-100 text-green-800' },
      'completed': { text: '완료', class: 'bg-gray-100 text-gray-800' },
      'cancelled': { text: '취소됨', class: 'bg-red-100 text-red-800' }
    };
    
    const statusInfo = statusMap[status] || statusMap['pending'];
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.class}`}>
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
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" className="p-2" onClick={() => setCurrentPage('home')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">예약 조회</h1>
          </div>
        </div>
      </header>

      {/* 검색 탭 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto flex">
          <button
            className={`flex-1 py-4 text-center font-medium border-b-2 transition-colors ${
              searchType === 'number' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setSearchType('number')}
          >
            예약번호
          </button>
          <button
            className={`flex-1 py-4 text-center font-medium border-b-2 transition-colors ${
              searchType === 'phone' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500'
            }`}
            onClick={() => setSearchType('phone')}
          >
            전화번호
          </button>
        </div>
      </div>
      
      <div className="max-w-md mx-auto p-4">
        <Card className="p-6 mb-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-lg font-semibold mb-2">예약 내역을 조회하세요</h2>
            <p className="text-gray-600">
              {searchType === 'number' 
                ? '예약번호를 입력해주세요' 
                : '예약 시 등록한 전화번호를 입력해주세요'
              }
            </p>
          </div>
          
          <Input
            icon={searchType === 'number' ? Search : Phone}
            placeholder={searchType === 'number' ? '예: YR241201ABCD' : '010-1234-5678'}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="mb-4"
          />
          
          <Button 
            className="w-full"
            onClick={handleSearch}
            disabled={loading || !searchValue.trim()}
          >
            {loading ? '조회 중...' : '조회하기'}
          </Button>
        </Card>

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">검색 결과</h3>
              <span className="text-sm text-gray-600">{results.length}개</span>
            </div>
            
            {results.map((booking, index) => (
              <Card key={index} className="p-4" onClick={() => openDetail(booking)}>
                <div className="flex justify-between items-start mb-3">
                  <div className="font-semibold">{booking.booking_number}</div>
                  {getStatusBadge(booking.status)}
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
                
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">예약일: {booking.created_at}</span>
                  <span className="font-bold text-yellow-600">${booking.total_amount}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 빈 결과 */}
        {!loading && results.length === 0 && searchValue && (
          <Card className="p-8 text-center">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="font-semibold mb-2">예약 내역이 없습니다</h3>
            <p className="text-gray-600 text-sm mb-4">
              입력하신 정보로 등록된 예약이 없습니다.<br />
              예약번호나 전화번호를 다시 확인해주세요.
            </p>
            <Button variant="outline" onClick={() => setSearchValue('')}>
              다시 검색
            </Button>
          </Card>
        )}

        {/* 빠른 메뉴 */}
        <Card className="p-6 mt-6">
          <h3 className="font-semibold mb-4">빠른 메뉴</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setCurrentPage('booking')}>
              <div className="text-center">
                <div className="text-xl mb-1">🚕</div>
                <div className="text-sm">새 예약</div>
              </div>
            </Button>
            <Button variant="outline" onClick={() => setSearchValue('YR241201DEMO')}>
              <div className="text-center">
                <div className="text-xl mb-1">📱</div>
                <div className="text-sm">예약 문의</div>
              </div>
            </Button>
          </div>
        </Card>
      </div>

      {/* 상세 모달 */}
      {showDetail && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="bg-white w-full max-w-md mx-auto rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">예약 상세 정보</h3>
              <Button variant="secondary" size="sm" className="p-2" onClick={() => setShowDetail(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">예약번호</div>
                <div className="font-semibold">{selectedBooking.booking_number}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-1">상태</div>
                <div>{getStatusBadge(selectedBooking.status)}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-1">서비스</div>
                <div className="font-medium">{selectedBooking.service_type}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-1">이용 일시</div>
                <div className="font-medium">{selectedBooking.date} {selectedBooking.time}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-1">경로</div>
                <div className="font-medium">{selectedBooking.departure} → {selectedBooking.arrival}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-1">예약자</div>
                <div className="font-medium">{selectedBooking.customer_name} ({selectedBooking.customer_phone})</div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600 mb-1">총 요금</div>
                <div className="text-xl font-bold text-yellow-600">${selectedBooking.total_amount}</div>
              </div>
            </div>
            
            <div className="mt-6 space-y-3">
              <Button className="w-full" onClick={() => {
                setShowDetail(false);
                setCurrentPage('confirmation');
              }}>
                예약 확인서 보기
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline">수정</Button>
                <Button variant="outline">취소</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 대절 페이지 - MongoDB 연동 버전
const CharterPage = () => {
  const { setCurrentPage, selectedRegion, regionData, api, showToast } = useContext(AppContext);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState([]);
  const totalSteps = 5;
  
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
    // 오늘 날짜와 시간 설정
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const timeString = now.toTimeString().slice(0, 5);
    
    setCharterData(prev => ({
      ...prev,
      date: today,
      time: timeString
    }));

    // 대기 장소 옵션 로드
    loadLocationOptions();
  }, [selectedRegion]);

  const loadLocationOptions = async () => {
    try {
      const response = await api.getDepartures(selectedRegion, 'kor');
      if (response.success && Array.isArray(response.data)) {
        setLocationOptions(response.data.slice(0, 5)); // 상위 5개만 표시
      }
    } catch (error) {
      console.error('대기 장소 로드 오류:', error);
      // 폴백으로 regionData 사용
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
    let hourlyRate = 60; // 기본 시간당 요금
    
    if (charterData.vehicle === 'xl') {
      hourlyRate = 70;
    } else if (charterData.vehicle === 'premium') {
      hourlyRate = 85;
    }
    
    return hourlyRate * charterData.hours + 30; // 예약비 $30 포함
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" className="p-2" onClick={() => setCurrentPage('home')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">택시 대절</h1>
          </div>
        </div>
      </header>

      {/* 진행률 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">{currentStep}단계 / {totalSteps}단계</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 pb-32">
        {/* 1단계: 대절 용도 선택 */}
        {currentStep === 1 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">대절 용도를 선택해주세요</h3>
            <p className="text-gray-600 mb-6">용도에 맞는 최적의 서비스를 제공해드립니다</p>
            
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'tourism', icon: '🗽', title: '관광', desc: '여행지 투어' },
                { id: 'shopping', icon: '🛍', title: '쇼핑', desc: '쇼핑몰 이동' },
                { id: 'business', icon: '💼', title: '업무', desc: '업무 미팅' },
                { id: 'medical', icon: '🏥', title: '병원', desc: '병원 방문' },
                { id: 'event', icon: '🎉', title: '행사', desc: '특별 행사' },
                { id: 'other', icon: '📋', title: '기타', desc: '기타 용도' }
              ].map((purpose) => (
                <div
                  key={purpose.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all text-center ${
                    charterData.purpose === purpose.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => updateCharterData('purpose', purpose.id)}
                >
                  <div className="text-2xl mb-2">{purpose.icon}</div>
                  <div className="font-semibold text-sm mb-1">{purpose.title}</div>
                  <div className="text-xs text-gray-600">{purpose.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 2단계: 시간 및 대기 장소 선택 */}
        {currentStep === 2 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">대절 시간을 선택해주세요</h3>
            <p className="text-gray-600 mb-6">시간당 $60, 최소 1시간부터 이용 가능합니다</p>
            
            <div className="mb-6">
              <h4 className="font-medium mb-3">대절 시간</h4>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[1, 2, 3, 4, 6, 8, 10, 12].map((hour) => (
                  <button
                    key={hour}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      charterData.hours === hour 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => updateCharterData('hours', hour)}
                  >
                    {hour}시간
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm">직접 입력:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={charterData.hours}
                    onChange={(e) => updateCharterData('hours', parseInt(e.target.value) || 1)}
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-gray-600">시간</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">대기 장소</h4>
              <div className="space-y-2">
                {locationOptions.map((location, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      charterData.waitingLocation === (location.name_kor || location) 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => updateCharterData('waitingLocation', location.name_kor || location)}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-sm">{location.name_kor || location}</div>
                        <div className="text-xs text-gray-600">{location.name_eng || ''}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* 3단계: 날짜/시간 및 승객 정보 */}
        {currentStep === 3 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">시작 일정을 설정해주세요</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Input
                type="date"
                label="시작 날짜"
                value={charterData.date}
                onChange={(e) => updateCharterData('date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <Input
                type="time"
                label="시작 시간"
                value={charterData.time}
                onChange={(e) => updateCharterData('time', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-sm">승객 수</span>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={() => charterData.passengers > 1 && updateCharterData('passengers', charterData.passengers - 1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold">{charterData.passengers}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={() => updateCharterData('passengers', charterData.passengers + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Luggage className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-sm">짐 개수</span>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={() => charterData.luggage > 0 && updateCharterData('luggage', charterData.luggage - 1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold">{charterData.luggage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 p-0 rounded-full"
                    onClick={() => updateCharterData('luggage', charterData.luggage + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <h4 className="font-medium mb-4">차량 선택</h4>
            <div className="space-y-3">
              {[
                { type: 'standard', name: '일반 차량', price: '시간당 $60', desc: '최대 4명 승차 가능한 일반 승용차', icon: '🚗' },
                { type: 'xl', name: '대형 차량', price: '시간당 $70', desc: '최대 6명 승차 가능한 SUV 또는 밴', icon: '🚙' },
                { type: 'premium', name: '프리미엄 차량', price: '시간당 $85', desc: '최대 4명 승차 가능한 고급 승용차', icon: '🏆' }
              ].map((vehicle) => (
                <div
                  key={vehicle.type}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    charterData.vehicle === vehicle.type 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => updateCharterData('vehicle', vehicle.type)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{vehicle.icon}</span>
                      <span className="font-semibold">{vehicle.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">{vehicle.price}</span>
                  </div>
                  <div className="text-sm text-gray-600 ml-8">{vehicle.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 4단계: 고객 정보 */}
        {currentStep === 4 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">연락처 정보를 입력해주세요</h3>
            
            <div className="space-y-4">
              <Input
                label="이름 *"
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
                placeholder="010-1234-5678"
                value={charterData.customer.phone}
                onChange={(e) => setCharterData(prev => ({
                  ...prev,
                  customer: { ...prev.customer, phone: e.target.value }
                }))}
              />
              <Input
                label="카카오톡 ID (선택사항)"
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
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none"
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
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">대절 내용을 확인해주세요</h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">용도</span>
                <span className="font-medium">
                  {{
                    'tourism': '관광',
                    'shopping': '쇼핑', 
                    'business': '업무',
                    'medical': '병원',
                    'event': '행사',
                    'other': '기타'
                  }[charterData.purpose]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">대기 장소</span>
                <span className="font-medium text-right max-w-[60%]">{charterData.waitingLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">시작 일시</span>
                <span className="font-medium">{charterData.date} {charterData.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">대절 시간</span>
                <span className="font-medium">{charterData.hours}시간</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">승객 정보</span>
                <span className="font-medium">{charterData.passengers}명, 짐 {charterData.luggage}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">선택 차량</span>
                <span className="font-medium">
                  {{
                    'standard': '일반 차량',
                    'xl': '대형 차량',
                    'premium': '프리미엄 차량'
                  }[charterData.vehicle]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">연락처</span>
                <span className="font-medium text-right">{charterData.customer.name} ({charterData.customer.phone})</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between font-semibold text-lg">
                <span>총 결제 금액</span>
                <span className="text-yellow-600">${calculateTotalPrice()}</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                예약비 $30 + 시간당 요금 포함
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-md mx-auto flex gap-3">
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
            onClick={nextStep}
            disabled={loading || !validateStep(currentStep)}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                처리 중...
              </div>
            ) : (
              currentStep === totalSteps ? '대절 완료' : '다음'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ConfirmationPage = () => {
  const { setCurrentPage, bookingData } = useContext(AppContext);
  const [copied, setCopied] = useState(false);

  const copyBookingNumber = async () => {
    const bookingNumber = bookingData.bookingNumber || 'YR241201DEMO';
    
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(bookingNumber);
      } else {
        // 폴백 방법
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
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-center">예약 완료</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto">
        {/* 성공 헤더 */}
        <div className="bg-white p-8 text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">예약이 완료되었습니다!</h2>
          <p className="text-gray-600 mb-8">곧 기사님이 배정될 예정입니다</p>
        </div>

        <div className="px-4 space-y-4">
          {/* 예약번호 카드 */}
          <Card className="p-6 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black">
            <div className="text-center">
              <div className="text-sm opacity-80 mb-2">예약번호</div>
              <div className="text-2xl font-bold tracking-wide mb-4">
                {bookingData.bookingNumber || 'YR241201DEMO'}
              </div>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={copyBookingNumber}
                className="bg-black bg-opacity-10 hover:bg-opacity-20 border-0"
              >
                {copied ? '✅ 복사완료!' : '📋 복사하기'}
              </Button>
            </div>
          </Card>

          {/* 예약 상세 정보 */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                🚕
              </div>
              <div>
                <h3 className="font-semibold">예약 정보</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">예약 확인중</span>
              </div>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">서비스</span>
                <span className="font-medium">
                  {bookingData.serviceType === 'airport' ? '공항 택시' : 
                   bookingData.serviceType === 'charter' ? '택시 대절' : '일반 택시'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">일시</span>
                <span className="font-medium">
                  {formatDateTime(bookingData.datetime?.date, bookingData.datetime?.time)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">출발</span>
                <span className="font-medium text-right max-w-[60%]">
                  {bookingData.departure}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">도착</span>
                <span className="font-medium text-right max-w-[60%]">
                  {bookingData.arrival}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">승객/짐</span>
                <span className="font-medium">{bookingData.passengers}명 / 짐 {bookingData.luggage}개</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">차량</span>
                <span className="font-medium">{getVehicleName(bookingData.vehicle)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">예약자</span>
                <span className="font-medium text-right">
                  {bookingData.customer?.name} ({bookingData.customer?.phone})
                </span>
              </div>
            </div>
          </Card>

          {/* 결제 정보 */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                💰
              </div>
              <h3 className="font-semibold">결제 정보</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">예약비</span>
                <span>$20</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">서비스비</span>
                <span>$75</span>
              </div>
              {bookingData.vehicle !== 'standard' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">차량 업그레이드</span>
                  <span>
                    ${bookingData.vehicle === 'xl' ? '10' : '25'}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between font-semibold text-base">
                  <span>총 결제금액</span>
                  <span className="text-yellow-600">${bookingData.totalAmount || '95'}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* 안내사항 */}
          <Card className="p-6 bg-blue-50">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <span>📢</span>
              이용 안내
            </h4>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>예약 확정 후 기사님 정보를 문자로 안내드립니다</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>출발 1시간 전까지 취소 가능합니다</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>기사님께 예약번호를 알려주세요</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-500">•</span>
                <span>늦으실 경우 미리 연락 부탁드립니다</span>
              </div>
            </div>
          </Card>

          {/* 고객센터 */}
          <Card className="p-6">
            <h4 className="font-semibold mb-4 text-center">도움이 필요하신가요?</h4>
            <div className="grid grid-cols-3 gap-3">
              <button className="flex flex-col items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className="text-xl mb-2">📞</span>
                <span className="text-xs text-gray-600">전화하기</span>
              </button>
              <button className="flex flex-col items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className="text-xl mb-2">💬</span>
                <span className="text-xs text-gray-600">카카오톡</span>
              </button>
              <button className="flex flex-col items-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className="text-xl mb-2">✉️</span>
                <span className="text-xs text-gray-600">이메일</span>
              </button>
            </div>
          </Card>
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 space-y-3 pb-8">
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
