import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  ar: {
    translation: {
      login: "تسجيل الدخول",
      username: "اسم المستخدم",
      password: "كلمة المرور",
      dashboard: "لوحة التحكم",
      subscribers: "المشتركين",
      plans: "الباقات",
      subscriptions: "الاشتراكات",
      payments: "الدفعات",
      reports: "التقارير",
      settings: "الإعدادات",
      logout: "تسجيل الخروج",
      welcome: "مرحباً",
      active_subscribers: "المشتركون النشطون",
      monthly_revenue: "إيرادات الشهر",
      expiring_soon: "تنتهي قريباً",
      search: "بحث...",
      add_new: "إضافة جديد",
      save: "حفظ",
      cancel: "إلغاء",
      actions: "إجراءات"
    }
  },
  en: {
    translation: {
      login: "Login",
      username: "Username",
      password: "Password",
      dashboard: "Dashboard",
      subscribers: "Subscribers",
      plans: "Plans",
      subscriptions: "Subscriptions",
      payments: "Payments",
      reports: "Reports",
      settings: "Settings",
      logout: "Logout",
      welcome: "Welcome",
      active_subscribers: "Active Subscribers",
      monthly_revenue: "Monthly Revenue",
      expiring_soon: "Expiring Soon",
      search: "Search...",
      add_new: "Add New",
      save: "Save",
      cancel: "Cancel",
      actions: "Actions"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ar", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
