import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash, User, Phone, Mail, FileText, Activity, AlertCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { invoke } from '../../lib/tauri';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface Subscriber {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  national_id: string | null;
  notes: string | null;
  created_at: string;
}

const subscriberSchema = z.object({
  fullName: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(8, 'رقم الهاتف مطلوب'),
  email: z.string().email('بريد إلكتروني غير صالح').optional().or(z.literal('')),
  nationalId: z.string().optional(),
  notes: z.string().optional(),
});

type SubscriberFormValues = z.infer<typeof subscriberSchema>;

export default function SubscribersList() {
  const { t } = useTranslation();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscriber | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SubscriberFormValues>({
    resolver: zodResolver(subscriberSchema),
    defaultValues: { fullName: '', phone: '', email: '', nationalId: '', notes: '' }
  });

  const fetchSubscribers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const subs: Subscriber[] = await invoke('get_subscribers', { search });
      setSubscribers(subs);
    } catch (e: any) {
      setError(t('error_loading_subscribers', 'حدث خطأ أثناء تحميل بيانات المشتركين. يرجى المحاولة لاحقاً.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSubscribers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleEdit = (sub: Subscriber) => {
    setEditingSub(sub);
    reset({
      fullName: sub.full_name,
      phone: sub.phone,
      email: sub.email || '',
      nationalId: sub.national_id || '',
      notes: sub.notes || ''
    });
    setIsAdding(true);
  };

  const closeDialog = () => {
    setIsAdding(false);
    setEditingSub(null);
    reset({ fullName: '', phone: '', email: '', nationalId: '', notes: '' });
  };

  const onSubmit = async (data: SubscriberFormValues) => {
    try {
      if (editingSub) {
        await invoke('update_subscriber', { 
          id: editingSub.id,
          fullName: data.fullName, 
          phone: data.phone,
          email: data.email || null,
          nationalId: data.nationalId || null,
          notes: data.notes || null
        });
      } else {
        await invoke('add_subscriber', { 
          fullName: data.fullName, 
          phone: data.phone,
          email: data.email || null,
          nationalId: data.nationalId || null,
          notes: data.notes || null
        });
      }
      closeDialog();
      fetchSubscribers();
    } catch (e: any) {
      alert(t('error_saving', 'حدث خطأ أثناء حفظ البيانات. يرجى المحاولة لاحقاً.'));
    }
  };

  const handleDelete = async (id: number) => {
    if(!confirm(t('are_you_sure', 'هل أنت متأكد من الحذف؟'))) return;
    try {
      await invoke('delete_subscriber', { id });
      fetchSubscribers();
    } catch (e: any) {
      alert(t('error_deleting', 'حدث خطأ أثناء محاولة الحذف. تأكد من أن المشترك ليس لديه سجلات مرتبطة.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{t('subscribers', 'المشتركين')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('manage_members', 'إدارة سجلات أعضاء المنشأة')}</p>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 rtl:ml-2 ltr:mr-2" />
          {t('add_new', 'إضافة جديد')}
        </Button>
      </div>

      <Dialog 
        isOpen={isAdding} 
        onClose={closeDialog} 
        title={editingSub ? t('edit_subscriber', 'تعديل بيانات المشترك') : t('add_new_subscriber', 'إضافة مشترك جديد')} 
        description={t('enter_details', 'أدخل بيانات المشترك أدناه.')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('full_name', 'الاسم الكامل')} *</label>
              <Input 
                {...register('fullName')} 
                error={errors.fullName?.message} 
                icon={<User className="w-4 h-4" />}
                placeholder={t('full_name_placeholder', 'أحمد علي')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('phone', 'رقم الهاتف')} *</label>
              <Input 
                {...register('phone')} 
                error={errors.phone?.message} 
                icon={<Phone className="w-4 h-4" />}
                placeholder="01xxxxxxxxx"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('email', 'البريد الإلكتروني')}</label>
              <Input 
                {...register('email')} 
                error={errors.email?.message} 
                icon={<Mail className="w-4 h-4" />}
                placeholder="email@example.com"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('national_id', 'الرقم القومي')}</label>
              <Input 
                {...register('nationalId')} 
                error={errors.nationalId?.message} 
                icon={<FileText className="w-4 h-4" />}
                placeholder="29001011234567"
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('notes', 'ملاحظات')}</label>
              <Input 
                {...register('notes')} 
                error={errors.notes?.message} 
                placeholder={t('notes_placeholder', 'أي متطلبات خاصة...')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 mt-6">
            <Button type="button" variant="ghost" onClick={closeDialog}>{t('cancel', 'إلغاء')}</Button>
            <Button type="submit" isLoading={isSubmitting}>{t('save', 'حفظ')}</Button>
          </div>
        </form>
      </Dialog>

      {error ? (
        <div className="p-6 bg-red-50 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : (
        <Card>
          <div className="p-4 border-b border-surface-200 flex items-center justify-between bg-surface-50/50 rounded-t-xl">
            <div className="w-full max-w-sm">
              <Input
                type="text"
                placeholder={t('search', 'بحث...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="h-4 w-4" />}
                className="bg-white"
              />
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">{t('id', 'الرقم')}</TableHead>
                <TableHead>{t('member', 'العضو')}</TableHead>
                <TableHead>{t('contact', 'التواصل')}</TableHead>
                <TableHead>{t('joined_date', 'تاريخ الانضمام')}</TableHead>
                <TableHead className="text-end">{t('actions', 'الإجراءات')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <div className="h-12 bg-surface-100 animate-pulse rounded-md w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : subscribers.length > 0 ? (
                subscribers.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-mono text-surface-500 text-center" dir="ltr">#{sub.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium shrink-0">
                          {sub.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-surface-900">{sub.full_name}</div>
                          {sub.national_id && <div className="text-xs text-surface-500" dir="ltr">{sub.national_id}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-surface-900" dir="ltr" style={{ textAlign: 'right' }}>{sub.phone}</div>
                      {sub.email && <div className="text-xs text-surface-500" dir="ltr" style={{ textAlign: 'right' }}>{sub.email}</div>}
                    </TableCell>
                    <TableCell className="text-surface-500" dir="ltr" style={{ textAlign: 'right' }}>
                      {new Date(sub.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-surface-500 hover:text-primary-600 hover:bg-primary-50" onClick={() => handleEdit(sub)} title={t('edit', 'تعديل')}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title={t('view_timeline', 'عرض السجل')}>
                          <Activity className="h-4 w-4 text-surface-500" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(sub.id)} title={t('delete', 'حذف')}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-surface-500">
                    {t('no_subscribers_found', 'لا توجد بيانات مشترکین.')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
