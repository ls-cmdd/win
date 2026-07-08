import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, RotateCw, XCircle, Filter, AlertCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { invoke } from '../../lib/tauri';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Subscription {
  id: number;
  subscriber_id: number;
  subscriber_name: string;
  plan_id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
  status: string;
  auto_renew: boolean;
}

interface Subscriber {
  id: number;
  full_name: string;
}

interface Plan {
  id: number;
  name: string;
  duration_days: number;
}

const subSchema = z.object({
  subscriberId: z.coerce.number().min(1, 'يرجى اختيار المشترك'),
  planId: z.coerce.number().min(1, 'يرجى اختيار الباقة'),
});

type SubFormValues = z.infer<typeof subSchema>;

export default function SubscriptionsList() {
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(subSchema) as any,
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [subs, subers, ps] = await Promise.all([
        invoke<Subscription[]>('get_subscriptions'),
        invoke<Subscriber[]>('get_subscribers', { search: '' }),
        invoke<Plan[]>('get_plans')
      ]);
      setSubscriptions(subs);
      setSubscribers(subers);
      setPlans(ps);
    } catch (e: any) {
      setError(t('error_loading_subscriptions', 'حدث خطأ أثناء تحميل بيانات الاشتراكات. يرجى المحاولة لاحقاً.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRenew = async (id: number) => {
    if (!confirm(t('are_you_sure_renew', 'هل أنت متأكد من تجديد هذا الاشتراك؟'))) return;
    try {
      await invoke('renew_subscription', { id });
      fetchData();
    } catch (e: any) {
      alert(t('error_renewing', 'حدث خطأ أثناء محاولة التجديد. يرجى المحاولة لاحقاً.'));
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm(t('are_you_sure_cancel', 'هل أنت متأكد من إلغاء هذا الاشتراك؟'))) return;
    try {
      await invoke('cancel_subscription', { id });
      fetchData();
    } catch (e: any) {
      alert(t('error_canceling', 'حدث خطأ أثناء محاولة الإلغاء.'));
    }
  };

  const onSubmit = async (data: SubFormValues) => {
    const plan = plans.find(p => p.id === data.planId);
    if (!plan) return;
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.duration_days);
    
    try {
      await invoke('add_subscription', {
        subscriberId: data.subscriberId,
        planId: data.planId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        status: 'active',
        autoRenew: false
      });
      setIsAdding(false);
      reset();
      fetchData();
    } catch (e: any) {
      alert(t('error_saving', 'حدث خطأ أثناء حفظ الاشتراك.'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active': return <Badge variant="success">{t('active', 'نشط')}</Badge>;
      case 'expired': return <Badge variant="danger">{t('expired', 'منتهي')}</Badge>;
      case 'cancelled': return <Badge variant="default">{t('cancelled', 'ملغى')}</Badge>;
      default: return <Badge variant="warning">{status}</Badge>;
    }
  };

  const filteredSubs = subscriptions.filter(sub => 
    filterStatus === 'all' ? true : sub.status === filterStatus
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{t('subscriptions', 'الاشتراكات')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('monitor_subscriptions', 'مراقبة العضويات النشطة والمنتهية')}</p>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 rtl:ml-2 ltr:mr-2" />
          {t('add_new', 'إضافة جديد')}
        </Button>
      </div>

      <Dialog isOpen={isAdding} onClose={() => setIsAdding(false)} title={t('new_subscription', 'اشتراك جديد')} description={t('assign_plan', 'تخصيص باقة لمشترك.')}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('subscriber', 'المشترك')} *</label>
              <select 
                {...register('subscriberId')} 
                className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${errors.subscriberId ? 'border-red-500 focus:ring-red-500' : 'border-surface-300'}`}
              >
                <option value="">{t('select_subscriber', 'اختر المشترك')}</option>
                {subscribers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              {errors.subscriberId && <p className="mt-1 text-xs text-red-500">{errors.subscriberId.message as string}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('plan', 'الباقة')} *</label>
              <select 
                {...register('planId')} 
                className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${errors.planId ? 'border-red-500 focus:ring-red-500' : 'border-surface-300'}`}
              >
                <option value="">{t('select_plan', 'اختر الباقة')}</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.duration_days} {t('days', 'يوم')})</option>)}
              </select>
              {errors.planId && <p className="mt-1 text-xs text-red-500">{errors.planId.message as string}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>{t('cancel', 'إلغاء')}</Button>
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
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-surface-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm bg-transparent border-none text-surface-700 focus:ring-0 cursor-pointer"
              >
                <option value="all">{t('all_statuses', 'جميع الحالات')}</option>
                <option value="active">{t('active', 'نشط')}</option>
                <option value="expired">{t('expired', 'منتهي')}</option>
                <option value="cancelled">{t('cancelled', 'ملغى')}</option>
              </select>
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('subscriber', 'المشترك')}</TableHead>
                <TableHead>{t('plan', 'الباقة')}</TableHead>
                <TableHead>{t('start_date', 'تاريخ البدء')}</TableHead>
                <TableHead>{t('end_date', 'تاريخ الانتهاء')}</TableHead>
                <TableHead>{t('status', 'الحالة')}</TableHead>
                <TableHead className="text-end">{t('actions', 'الإجراءات')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-12 bg-surface-100 animate-pulse rounded-md w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredSubs.length > 0 ? (
                filteredSubs.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.subscriber_name}</TableCell>
                    <TableCell className="text-surface-600">{sub.plan_name}</TableCell>
                    <TableCell className="text-surface-600" dir="ltr" style={{ textAlign: 'right' }}>
                      {format(parseISO(sub.start_date), 'dd MMM yyyy', { locale: ar })}
                    </TableCell>
                    <TableCell className="text-surface-600" dir="ltr" style={{ textAlign: 'right' }}>
                      {format(parseISO(sub.end_date), 'dd MMM yyyy', { locale: ar })}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sub.status)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-2">
                        {sub.status !== 'cancelled' && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-surface-500 hover:text-primary-600 hover:bg-primary-50" onClick={() => handleRenew(sub.id)} title={t('renew', 'تجديد')}>
                            <RotateCw className="h-4 w-4" />
                          </Button>
                        )}
                        {sub.status === 'active' && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleCancel(sub.id)} title={t('cancel_sub', 'إلغاء')}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-surface-500">
                    {t('no_subscriptions_found', 'لا توجد اشتراكات توافق بحثك.')}
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
