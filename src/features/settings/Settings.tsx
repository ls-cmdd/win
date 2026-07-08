import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore';
import { Globe, Database, Shield, Webhook, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { invoke } from '../../lib/tauri';

export default function Settings() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const toggleLanguage = useAppStore((state) => state.toggleLanguage);
  const [activeTab, setActiveTab] = useState('general');
  const [webhookSecret, setWebhookSecret] = useState('Loading...');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSecret = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const secret = await invoke<string>('get_webhook_secret');
      setWebhookSecret(secret);
    } catch (e: any) {
      setError(t('error_loading_secret', 'حدث خطأ أثناء تحميل سر Webhook.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'webhook') {
      fetchSecret();
    }
  }, [activeTab]);

  const tabs = [
    { id: 'general', label: t('general_settings', 'إعدادات عامة'), icon: Globe },
    { id: 'backup', label: t('database_backup', 'النسخ الاحتياطي'), icon: Database },
    { id: 'users', label: t('users_permissions', 'المستخدمين والصلاحيات'), icon: Shield },
    { id: 'webhook', label: t('webhook_config', 'إعدادات Webhook'), icon: Webhook },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRenew = async () => {
    if(!confirm(t('confirm_renew_secret', 'تجديد السر سيبطل السر القديم فوراً. هل أنت متأكد؟'))) return;
    try {
      setIsLoading(true);
      const newSecret = await invoke<string>('rotate_webhook_secret');
      setWebhookSecret(newSecret);
    } catch (e: any) {
      alert(t('error_renewing', 'حدث خطأ أثناء تجديد السر.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{t('settings', 'الإعدادات')}</h1>
        <p className="text-sm text-surface-500 mt-1">{t('system_preferences', 'إدارة تفضيلات وإعدادات النظام.')}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 space-y-1 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 space-y-6">
          {activeTab === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('language_appearance', 'اللغة والمظهر')}</CardTitle>
                <CardDescription>{t('customize_look', 'تخصيص لغة ومظهر التطبيق.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-surface-900 mb-3">{t('system_language', 'لغة النظام')}</h4>
                  <div className="flex gap-4">
                    <button
                      onClick={() => language !== 'ar' && toggleLanguage()}
                      className={`flex-1 border rounded-lg p-4 text-center transition-all ${
                        language === 'ar' 
                          ? 'border-primary-600 bg-primary-50 text-primary-900 ring-1 ring-primary-600' 
                          : 'border-surface-200 hover:border-surface-300 bg-white text-surface-700'
                      }`}
                    >
                      <span className="text-2xl mb-2 block">🇸🇦</span>
                      <span className="font-medium">العربية (RTL)</span>
                    </button>
                    <button
                      onClick={() => language !== 'en' && toggleLanguage()}
                      className={`flex-1 border rounded-lg p-4 text-center transition-all ${
                        language === 'en' 
                          ? 'border-primary-600 bg-primary-50 text-primary-900 ring-1 ring-primary-600' 
                          : 'border-surface-200 hover:border-surface-300 bg-white text-surface-700'
                      }`}
                    >
                      <span className="text-2xl mb-2 block">🇬🇧</span>
                      <span className="font-medium">English (LTR)</span>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'backup' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('database_backup', 'النسخ الاحتياطي')}</CardTitle>
                <CardDescription>{t('backup_desc', 'إعداد النسخ الاحتياطي لقاعدة البيانات.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-6 border-2 border-dashed border-surface-200 rounded-xl text-center">
                  <p className="text-surface-500 mb-4">{t('backup_ready', 'يمكنك أخذ نسخة احتياطية من قاعدة البيانات في أي وقت.')}</p>
                  <Button onClick={async () => {
                    try {
                      await invoke('create_backup');
                      alert(t('backup_success', 'تم إنشاء النسخة الاحتياطية بنجاح.'));
                    } catch (e: any) {
                      alert(t('backup_failed', 'فشل إنشاء النسخة الاحتياطية: ') + e.message);
                    }
                  }}>{t('create_manual_backup', 'إنشاء نسخة احتياطية الآن')}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'webhook' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('webhook_config', 'إعدادات Webhook')}</CardTitle>
                <CardDescription>{t('webhook_desc', 'إدارة استقبال طلبات الدفع الخارجية.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error ? (
                  <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">{t('webhook_url', 'رابط Webhook')}</label>
                      <Input defaultValue="http://localhost:3000/api/webhook" readOnly className="bg-surface-50 text-surface-500" dir="ltr" />
                      <p className="text-xs text-surface-500 mt-1">{t('webhook_url_desc', 'هذا هو الرابط الذي يجب أن تستقبل عليه طلبات POST من الخدمة الخارجية.')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">{t('signing_secret', 'سر التوقيع (HMAC)')}</label>
                      <div className="flex gap-2">
                        <Input 
                          type="text" 
                          value={isLoading ? t('loading', 'جاري التحميل...') : webhookSecret} 
                          readOnly 
                          className="flex-1 font-mono text-sm tracking-widest" 
                          dir="ltr"
                        />
                        <Button variant="outline" onClick={handleCopy} title={t('copy', 'نسخ')} disabled={isLoading}>
                          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button variant="outline" onClick={handleRenew} title={t('renew', 'تجديد')} disabled={isLoading}>
                          <RefreshCw className={`w-4 h-4 text-amber-600 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">{t('secret_warning', 'احتفظ بهذا السر بأمان. التجديد سيُبطل السر القديم فوراً ولن تقبل أي طلبات بالتوقيع القديم.')}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'users' && (
            <Card>
              <CardHeader>
                <CardTitle>{t('users_permissions', 'المستخدمين والصلاحيات')}</CardTitle>
                <CardDescription>{t('manage_staff', 'إدارة الموظفين وصلاحياتهم.')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-surface-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-surface-200">
                    <thead className="bg-surface-50">
                      <tr>
                        <th className="px-4 py-3 text-start text-xs font-medium text-surface-500 uppercase">{t('username', 'اسم المستخدم')}</th>
                        <th className="px-4 py-3 text-start text-xs font-medium text-surface-500 uppercase">{t('role', 'الصلاحية')}</th>
                        <th className="px-4 py-3 text-start text-xs font-medium text-surface-500 uppercase">{t('status', 'الحالة')}</th>
                        <th className="px-4 py-3 text-end text-xs font-medium text-surface-500 uppercase">{t('actions', 'الإجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-surface-200">
                      <tr>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-surface-900" dir="ltr">admin</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-surface-500">{t('admin', 'مدير النظام')}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">{t('active', 'نشط')}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-end text-sm">
                          <Button variant="ghost" size="sm" disabled>{t('edit', 'تعديل')}</Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" disabled>{t('add_user', 'إضافة مستخدم')}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
