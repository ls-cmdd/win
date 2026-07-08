import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { invoke } from '../../lib/tauri';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';

export default function Login() {
  const { t } = useTranslation();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    invoke('check_system_setup').then((isSetup: unknown) => {
      if (!isSetup) {
        setNeedsSetup(true);
      }
    }).catch(console.error);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const user: any = await invoke('login', { username, password });
      login(user, 'local-session-token');
      navigate('/');
    } catch (err: any) {
      setError(t('invalid_credentials', 'بيانات الدخول غير صحيحة. يرجى المحاولة مرة أخرى.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const msg: string = await invoke('setup_system', { password: setupPassword });
      setNeedsSetup(false);
    } catch (err: any) {
      alert(t('setup_failed', 'فشل في إعداد النظام.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-surface-100">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-center text-3xl font-extrabold text-surface-900">{t('initial_setup', 'الإعداد الأولي للنظام')}</h2>
            <p className="mt-2 text-center text-sm text-surface-500">{t('create_admin_password', 'قم بإنشاء كلمة مرور للمدير للبدء.')}</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSetup}>
            <div>
              <label htmlFor="setupPassword" className="block text-sm font-medium text-surface-700 mb-1">{t('password', 'كلمة المرور')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 pl-3 flex items-center pointer-events-none rtl:pl-0 rtl:pr-3">
                  <Lock className="h-5 w-5 text-surface-400" />
                </div>
                <input
                  id="setupPassword"
                  type="password"
                  required
                  className="appearance-none rounded-lg block w-full pl-10 rtl:pl-3 rtl:pr-10 py-2.5 border border-surface-300 placeholder-surface-400 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                  placeholder={t('new_admin_password', 'كلمة المرور الجديدة')}
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-70"
              >
                {isLoading ? t('loading', 'جاري المعالجة...') : t('complete_setup', 'إكمال الإعداد')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-surface-100">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-primary-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary-200 rotate-3">
            <Shield className="w-8 h-8 -rotate-3" />
          </div>
          <h2 className="text-center text-3xl font-bold text-surface-900 tracking-tight">
            اشتراكي
          </h2>
          <p className="mt-2 text-center text-sm text-surface-500">
            {t('welcome_back', 'مرحباً بك مجدداً. الرجاء تسجيل الدخول.')}
          </p>
        </div>
        
        <form className="mt-8 space-y-5" onSubmit={handleLogin}>
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-surface-700 mb-1">{t('username', 'اسم المستخدم')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 pl-3 flex items-center pointer-events-none rtl:pl-0 rtl:pr-3">
                  <User className="h-5 w-5 text-surface-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="appearance-none rounded-lg block w-full pl-10 rtl:pl-3 rtl:pr-10 py-2.5 border border-surface-300 placeholder-surface-400 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                  placeholder={t('username', 'اسم المستخدم')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-700 mb-1">{t('password', 'كلمة المرور')}</label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 pl-3 flex items-center pointer-events-none rtl:pl-0 rtl:pr-3">
                  <Lock className="h-5 w-5 text-surface-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-lg block w-full pl-10 rtl:pl-3 rtl:pr-10 py-2.5 border border-surface-300 placeholder-surface-400 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors"
                  placeholder={t('password', 'كلمة المرور')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all shadow-md shadow-primary-200 disabled:opacity-70"
            >
              {isLoading ? t('loading', 'جاري تسجيل الدخول...') : t('login', 'تسجيل الدخول')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
