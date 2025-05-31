import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { Calendar, Phone, MapPin, Clock, Users, Luggage, Car, CreditCard, CheckCircle, ArrowLeft, Search, Plus, Minus, X } from 'lucide-react';

// 전역 상태 관리
const AppContext = createContext();

// API 서비스 클래스 (하나로 통합)
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
    const params = new URLSearchParams({ departure, arrival, lang });
    return this.requestWithRetry(`/taxi/route?${params}`);
  }

  async getStats() {
    return this.requestWithRetry('/taxi/stats');
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

// 지역별 공항/장소 데이터는 상수로 분리해 렌더 간 재생성을 방지
const REGION_DATA = {
  NY: {
    name: '뉴욕',
    desc: '맨해튼, 브루클린, 퀸즈, JFK/LGA 공항',
    airports: [
      { name_kor: 'NY 존에프케네디 공항', name_eng: 'JFK Airport', is_airport: true },
      { name_kor: 'NY 라과디아 공항', name_eng: 'LGA Airport', is_airport: true },
      { name_kor: 'NJ 뉴와크 공항', name_eng: 'EWR Airport', is_airport: true }
    ],
    places: [
      { name_kor: 'NY 맨해튼 미드타운', name_eng: 'Manhattan Midtown' },
      { name_kor: 'NY 맨해튼 다운타운', name_eng: 'Manhattan Downtown' },
      { name_kor: 'NY 브루클린', name_eng: 'Brooklyn' },
      { name_kor: 'NY 플러싱', name_eng: 'Flushing' },
      { name_kor: 'NY 자메이카', name_eng: 'Jamaica' }
    ]
  },
  CA: {
    name: '캘리포니아',
    desc: 'LA, 샌프란시스코, LAX/SFO 공항',
    airports: [
      { name_kor: 'LAX 국제공항', name_eng: 'LAX Airport', is_airport: true },
      { name_kor: 'SFO 국제공항', name_eng: 'SFO Airport', is_airport: true },
      { name_kor: '버뱅크 공항', name_eng: 'Burbank Airport', is_airport: true }
    ],
    places: [
      { name_kor: 'LA 다운타운', name_eng: 'Downtown LA' },
      { name_kor: 'LA 할리우드', name_eng: 'Hollywood' },
      { name_kor: 'LA 베벌리힐스', name_eng: 'Beverly Hills' },
      { name_kor: 'SF 유니언 스퀘어', name_eng: 'Union Square' },
      { name_kor: 'SF 피셔맨스 워프', name_eng: "Fisherman's Wharf" }
    ]
  }
};

// 접근성 및 SEO 개선 훅
const useAccessibility = () => {
  useEffect(() => {
    // 포커스 관리
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('using-keyboard');
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove('using-keyboard');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
};

// 개선된 로딩 상태 관리 훅
const useLoadingState = () => {
  const [loadingStates, setLoadingStates] = useState({});

  const setLoading = (key, isLoading) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  };

  const isLoading = (key) => loadingStates[key] || false;
  const isAnyLoading = () => Object.values(loadingStates).some(Boolean);

  return { setLoading, isLoading, isAnyLoading };
};

// Toast 컴포넌트
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

// UI 컴포넌트들
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

// 에러 상태 컴포넌트
const ErrorState = ({ title = '오류가 발생했습니다', message, onRetry, icon = '⚠️' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-4xl mb-4 opacity-50">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {message && (
        <p className="text-gray-600 mb-4 max-w-md">{message}</p>
      )}
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          다시 시도
        </Button>
      )}
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
  const { api } = useContext(AppContext);
  const isOnline = useOnlineStatus();
  const [serverStatus, setServerStatus] = useState(true);

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

// 에러 바운더리
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl mb-4">😵</div>
            <h2 className="text-xl font-semibold mb-2">앗! 문제가 발생했습니다</h2>
            <p className="text-gray-600 mb-4">
              예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-left mb-4 p-3 bg-gray-100 rounded text-sm">
                <summary className="cursor-pointer font-semibold">개발자 정보</summary>
                <pre className="mt-2 overflow-auto">
                  {this.state.error && this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="flex-1"
              >
                다시 시도
              </Button>
              <Button 
                onClick={() => window.location.reload()}
                className="flex-1"
              >
                새로고침
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 다국어 지원 기본 구조
const useTranslation = () => {
  const [locale, setLocale] = useState(() => {
    return localStorage.getItem('locale') || 'ko';
  });

  const translations = {
    ko: {
      'common.loading': '로딩 중...',
      'common.error': '오류가 발생했습니다',
      'common.retry': '다시 시도',
      'common.cancel': '취소',
      'common.confirm': '확인',
      'common.next': '다음',
      'common.previous': '이전',
      'common.save': '저장',
      'common.delete': '삭제',
      
      'home.title': '어디로 모실까요?',
      'home.departure': '출발지',
      'home.arrival': '도착지',
      'home.departure_placeholder': '어디서 출발하시나요?',
      'home.arrival_placeholder': '어디로 가시나요?',
      'home.popular_routes': '인기 노선',
      'home.book_now': '예약하기',
      
      'booking.title': '예약하기',
      'booking.step': '단계',
      'booking.date_time': '언제 이용하시나요?',
      'booking.passengers': '인원과 짐을 알려주세요',
      'booking.contact': '연락처 정보를 입력해주세요',
      'booking.confirm': '예약 내용을 확인해주세요',
      'booking.complete': '예약 완료',
      
      'error.network': '네트워크 연결을 확인해주세요',
      'error.server': '서버 오류가 발생했습니다',
      'error.validation': '입력 정보를 확인해주세요'
    },
    en: {
      'common.loading': 'Loading...',
      'common.error': 'An error occurred',
      'common.retry': 'Retry',
      'common.cancel': 'Cancel',
      'common.confirm': 'Confirm',
      'common.next': 'Next',
      'common.previous': 'Previous',
      'common.save': 'Save',
      'common.delete': 'Delete',
      
      'home.title': 'Where would you like to go?',
      'home.departure': 'From',
      'home.arrival': 'To',
      'home.departure_placeholder': 'Where are you departing from?',
      'home.arrival_placeholder': 'Where are you going?',
      'home.popular_routes': 'Popular Routes',
      'home.book_now': 'Book Now',
      
      'booking.title': 'Book a Ride',
      'booking.step': 'Step',
      'booking.date_time': 'When do you need a ride?',
      'booking.passengers': 'Tell us about passengers and luggage',
      'booking.contact': 'Enter your contact information',
      'booking.confirm': 'Confirm your booking details',
      'booking.complete': 'Booking Complete',
      
      'error.network': 'Please check your network connection',
      'error.server': 'Server error occurred',
      'error.validation': 'Please check your input'
    }
  };

  const t = (key, fallback = key) => {
    return translations[locale]?.[key] || fallback;
  };

  const changeLocale = (newLocale) => {
    setLocale(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  return { t, locale, changeLocale };
};

// 성능 최적화 훅
const useVirtualization = (items, itemHeight = 60, containerHeight = 400) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(visibleStart + Math.ceil(containerHeight / itemHeight) + 1, items.length);
  
  const visibleItems = items.slice(visibleStart, visibleEnd).map((item, index) => ({
    ...item,
    index: visibleStart + index
  }));
  
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e) => setScrollTop(e.target.scrollTop)
  };
};

// 성능 모니터링 훅
const usePerformance = () => {
  useEffect(() => {
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

// PWA 설치 프롬프트
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

// 피드백 모달
const FeedbackModal = ({ isOpen, onClose }) => {
  const { api, showToast } = useContext(AppContext);
  const [feedback, setFeedback] = useState({
    type: 'general',
    rating: 5,
    message: '',
    contact: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.message.trim()) {
      showToast('피드백 내용을 입력해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.sendFeedback({
        ...feedback,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.pathname
      });
      
      showToast('소중한 의견 감사합니다! 검토 후 반영하겠습니다.', 'success');
      onClose();
      setFeedback({ type: 'general', rating: 5, message: '', contact: '' });
    } catch (error) {
      showToast('피드백 전송 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">피드백 보내기</h3>
            <Button variant="secondary" size="sm" className="p-2" onClick={onClose}>
              ✕
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                피드백 유형
              </label>
              <select
                value={feedback.type}
                onChange={(e) => setFeedback(prev => ({ ...prev, type: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                <option value="general">일반 의견</option>
                <option value="bug">버그 신고</option>
                <option value="feature">기능 요청</option>
                <option value="ui">UI/UX 개선</option>
                <option value="performance">성능 문제</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                만족도 (1-5점)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setFeedback(prev => ({ ...prev, rating }))}
                    className={`w-10 h-10 rounded-full border transition-colors ${
                      feedback.rating >= rating 
                        ? 'bg-yellow-400 border-yellow-400 text-white' 
                        : 'border-gray-300 hover:border-yellow-400'
                    }`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상세 내용 *
              </label>
              <textarea
                value={feedback.message}
                onChange={(e) => setFeedback(prev => ({ ...prev, message: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                rows="4"
                placeholder="개선사항, 문제점, 또는 의견을 자세히 알려주세요..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                연락처 (선택사항)
              </label>
              <Input
                type="email"
                value={feedback.contact}
                onChange={(e) => setFeedback(prev => ({ ...prev, contact: e.target.value }))}
                placeholder="답변이 필요한 경우 이메일을 입력해주세요"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" className="flex-1" loading={loading}>
                전송
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// 홈페이지 컴포넌트
const HomePage = () => {
  const { setCurrentPage, selectedRegion, setSelectedRegion, regionData, bookingData, setBookingData, api, showToast } = useContext(AppContext);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSelectType, setLocationSelectType] = useState('departure');
  const [searchResults, setSearchResults] = useState([]);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentRegionData = regionData[selectedRegion];

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
      
      if (response.success) {
        setPopularRoutes(response.data);
      }
    } catch (error) {
      console.error('인기 노선 로드 오류:', error);
    }
  };

  const selectLocation = (type) => {
    setLocationSelectType(type);
    setShowLocationModal(true);
  };

  const setLocation = (location) => {
    setBookingData(prev => ({
      ...prev,
      [locationSelectType]: location
    }));
    setShowLocationModal(false);

    if (locationSelectType === 'arrival' && bookingData.departure) {
      searchRoutes(bookingData.departure, location);
    } else if (locationSelectType === 'departure' && bookingData.arrival) {
      searchRoutes(location, bookingData.arrival);
    }
  };

  const searchRoutes = async (departure, arrival) => {
    if (!departure || !arrival) return;

    setLoading(true);
    try {
      const response = await api.searchRoute(
        departure.split(' - ')[0], 
        arrival.split(' - ')[0], 
        'kor'
      );
      
      if (response.success && response.data.length > 0) {
        setSearchResults(response.data);
        showToast(`${response.data.length}개의 경로를 찾았습니다.`, 'success');
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
    <div className="min-h-screen bg-gray-50">
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
                <h3 className="font-semibold text-gray-900">{currentRegionData.name}</h3>
                <p className="text-sm text-gray-600">{currentRegionData.desc}</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
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
            <div className="flex flex-wrap gap-2">
              {['JFK → 맨해튼', '맨해튼 → JFK', 'LGA → 플러싱', '플러싱 → JFK'].map((route) => (
                <button
                  key={route}
                  className="bg-gray-100 hover:bg-blue-100 hover:border-blue-300 border border-gray-200 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  onClick={() => {
                    const [dep, arr] = route.split(' → ');
                    setBookingData(prev => ({ ...prev, departure: dep, arrival: arr }));
                  }}
                >
                  {route}
                </button>
              ))}
            </div>
          )}
        </Card>

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
                        {route.departure_kor.split(' - ')[0]} → {route.arrival_kor.split(' - ')[0]}
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

        <Card className="p-6 bg-gradient-to-r from-blue-500 to-green-500 text-white">
          <h3 className="text-lg font-bold mb-2">첫 예약 $10 할인!</h3>
          <p className="text-sm opacity-90 mb-4">신규 고객님께 특별한 혜택을 드립니다</p>
          <Button variant="secondary" size="sm">
            자세히 보기
          </Button>
        </Card>
      </div>

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
              {Object.entries(regionData).map(([code, data]) => (
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
              ))}
            </div>
          </div>
        </div>
      )}

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
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <span>✈️</span>
                  공항
                </h4>
                <div className="space-y-2">
                  {currentRegionData.airports.map((location, index) => (
                    <button
                      key={index}
                      className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={() => setLocation(location.name_kor)}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                    >
                      <div className="font-medium">{location.name_kor}</div>
                      <div className="text-sm text-gray-600">{location.name_eng}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <span>🏙️</span>
                  일반 지역
                </h4>
                <div className="space-y-2">
                  {currentRegionData.places.map((location, index) => (
                    <button
                      key={index}
                      className="w-full p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={() => setLocation(location.name_kor)}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                    >
                      <div className="font-medium">{location.name_kor}</div>
                      <div className="text-sm text-gray-600">{location.name_eng}</div>
                    </button>
                  ))}
                </div>
              </div>
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
  const isCurrentStepValid = useMemo(
    () => validateStep(currentStep, false),
    [currentStep, bookingData]
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setBookingData(prev => ({
      ...prev,
      datetime: { ...prev.datetime, date: today }
    }));

    loadRouteData();
  }, []);

  const loadRouteData = async () => {
    if (bookingData.departure && bookingData.arrival) {
      try {
        setLoading(true);
        const response = await api.searchRoute(
          bookingData.departure.split(' - ')[0], 
          bookingData.arrival.split(' - ')[0],
          'kor'
        );
        
        if (response.success && response.data.length > 0) {
          setRouteData(response.data[0]);
          setPriceData({
            reservation_fee: response.data[0].reservation_fee || 20,
            local_payment_fee: response.data[0].local_payment_fee || 75,
            vehicle_upgrades: { xl_fee: 10, premium_fee: 25 }
          });
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

  function validateStep(step, updateErrors = true) {
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
        break;
        
      default:
        return false;
    }
    
    if (updateErrors) {
      setErrors(newErrors);
    }
    return Object.keys(newErrors).length === 0;
  }

  const updateBookingData = (field, value) => {
    setBookingData(prev => ({
      ...prev,
      [field]: value
    }));
    
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
      console.error('예약 오류:', error);
      showToast(error.message || '예약 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
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
            <h1 className="text-lg font-semibold">예약하기</h1>
          </div>
        </div>
      </header>

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
                <div className="font-medium">{bookingData.departure?.split(' - ')[0] || bookingData.departure}</div>
              </div>
            </div>
            <div className="ml-1.5 w-0.5 h-4 bg-gray-300"></div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <div className="text-xs text-gray-600">도착지</div>
                <div className="font-medium">{bookingData.arrival?.split(' - ')[0] || bookingData.arrival}</div>
              </div>
            </div>
          </div>
        </Card>

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
            disabled={loading || !isCurrentStepValid}
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

// 검색 페이지 컴포넌트 (간단히)
const SearchPage = () => {
  const { setCurrentPage, api } = useContext(AppContext);
  const [searchType, setSearchType] = useState('number');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

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
      
      <div className="max-w-md mx-auto p-4">
        <Card className="p-6 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-semibold mb-2">예약 내역을 조회하세요</h2>
          <p className="text-gray-600">예약번호를 입력해주세요</p>
        </Card>
      </div>
    </div>
  );
};

// 대절 페이지 컴포넌트 (간단히)
const CharterPage = () => {
  const { setCurrentPage } = useContext(AppContext);
  
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
      
      <div className="max-w-md mx-auto p-4">
        <Card className="p-6 text-center">
          <div className="text-4xl mb-4">🚙</div>
          <h2 className="text-lg font-semibold mb-2">시간제 택시 대절</h2>
          <p className="text-gray-600">원하는 시간만큼 편리하게 이용하세요</p>
        </Card>
      </div>
    </div>
  );
};

// 예약 확인 페이지 컴포넌트 (간단히)
const ConfirmationPage = () => {
  const { setCurrentPage, bookingData } = useContext(AppContext);
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-center">예약 완료</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto">
        <div className="bg-white p-8 text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">예약이 완료되었습니다!</h2>
          <p className="text-gray-600 mb-8">곧 기사님이 배정될 예정입니다</p>
          
          <Card className="p-6 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black">
            <div className="text-center">
              <div className="text-sm opacity-80 mb-2">예약번호</div>
              <div className="text-2xl font-bold tracking-wide">
                {bookingData.bookingNumber || 'YR241201DEMO'}
              </div>
            </div>
          </Card>
        </div>
        
        <div className="p-4">
          <Button className="w-full" onClick={() => setCurrentPage('home')}>
            홈으로
          </Button>
        </div>
      </div>
    </div>
  );
};

// 관리자 페이지 컴포넌트 (간단히)
const AdminPage = () => {
  const { setCurrentPage } = useContext(AppContext);
  
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
      
      <div className="max-w-6xl mx-auto p-6">
        <Card className="p-6 text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <h2 className="text-lg font-semibold mb-2">관리자 페이지</h2>
          <p className="text-gray-600">택시 데이터를 관리할 수 있습니다</p>
        </Card>
      </div>
    </div>
  );
};

// 메인 앱 컴포넌트
const YellorideApp = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedRegion, setSelectedRegion] = useState(() => {
    return localStorage.getItem('selectedRegion') || 'NY';
  });
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
    totalAmount: 0
  });

  const api = useMemo(() => new YellorideAPI(), []);
  usePerformance();

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

  const regionData = REGION_DATA;

  const contextValue = useMemo(() => ({
    currentPage,
    setCurrentPage,
    selectedRegion,
    setSelectedRegion,
    bookingData,
    setBookingData,
    regionData,
    api,
    showToast
  }), [currentPage, selectedRegion, bookingData, regionData, api, showToast]);
  return (
    <AppContext.Provider value={contextValue}>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'booking' && <BookingPage />}
          {currentPage === 'charter' && <CharterPage />}
          {currentPage === 'search' && <SearchPage />}
          {currentPage === 'confirmation' && <ConfirmationPage />}
          {currentPage === 'admin' && <AdminPage />}
          
          <ToastContainer />
          <ConnectionStatus />
          <PWAInstallPrompt />
          
          {process.env.NODE_ENV === 'development' && (
            <div className="fixed bottom-2 left-2 text-xs text-gray-400 bg-black bg-opacity-50 text-white px-2 py-1 rounded z-50">
              ESC: 홈으로 | Ctrl+K: 관리자
            </div>
          )}
        </div>
      </ErrorBoundary>
    </AppContext.Provider>
  );
};

export default YellorideApp;