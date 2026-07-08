import { create } from 'zustand';
import i18n from '../i18n';

interface AppState {
  language: 'ar' | 'en';
  toggleLanguage: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  language: (localStorage.getItem('language') as 'ar' | 'en') || 'ar',
  toggleLanguage: () => set((state) => {
    const newLang = state.language === 'ar' ? 'en' : 'ar';
    localStorage.setItem('language', newLang);
    i18n.changeLanguage(newLang);
    document.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
    return { language: newLang };
  })
}));
