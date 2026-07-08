import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check, Trash, AlertCircle } from 'lucide-react';
import { invoke } from '../../lib/tauri';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';

interface Plan {
  id: number;
  name: string;
  description: string | null;
  duration_days: number;
  price: number;
}

const planSchema = z.object({
  name: z.string().min(2, 'الاسم قصير جداً').max(50),
  description: z.string().or(z.literal('')),
  durationDays: z.coerce.number().min(1, 'يجب أن يكون يومًا واحدًا على الأقل'),
  price: z.coerce.number().min(0, 'لا يمكن أن يكون السعر سالباً')
});

type PlanFormValues = z.infer<typeof planSchema>;

export default function PlansList() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(planSchema) as any,
    defaultValues: { name: '', description: '', durationDays: 30, price: 0 }
  });

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const p: Plan[] = await invoke('get_plans');
      setPlans(p);
    } catch (e: any) {
      setError(t('error_loading_plans', 'حدث خطأ أثناء تحميل بيانات الباقات. يرجى المحاولة لاحقاً.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    reset({
      name: plan.name,
      description: plan.description || '',
      durationDays: plan.duration_days,
      price: plan.price
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if(!confirm(t('are_you_sure', 'هل أنت متأكد من الحذف؟'))) return;
    try {
      await invoke('delete_plan', { id });
      fetchPlans();
    } catch (e: any) {
      alert(t('error_deleting', 'حدث خطأ أثناء محاولة الحذف. تأكد من عدم ارتباط الباقة باشتراكات حالية.'));
    }
  };

  const closeDialog = () => {
    setIsAdding(false);
    setEditingPlan(null);
    reset({ name: '', description: '', durationDays: 30, price: 0 });
  };

  const onSubmit = async (data: PlanFormValues) => {
    try {
      if (editingPlan) {
        await invoke('update_plan', {
          id: editingPlan.id,
          name: data.name,
          description: data.description || null,
          durationDays: data.durationDays,
          price: data.price
        });
      } else {
        await invoke('add_plan', {
          name: data.name,
          description: data.description || null,
          durationDays: data.durationDays,
          price: data.price
        });
      }
      closeDialog();
      fetchPlans();
    } catch (e: any) {
      alert(t('error_saving', 'حدث خطأ أثناء حفظ البيانات. يرجى المحاولة لاحقاً.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{t('plans', 'الباقات')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('manage_packages', 'إدارة باقات وأسعار الاشتراك')}</p>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 rtl:ml-2 ltr:mr-2" />
          {t('add_new', 'إضافة جديد')}
        </Button>
      </div>

      <Dialog isOpen={isAdding} onClose={closeDialog} title={editingPlan ? t('edit_plan', 'تعديل الباقة') : t('create_new_plan', 'إضافة باقة جديدة')} description={t('define_pricing', 'حدد المدة والسعر.')}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('plan_name', 'اسم الباقة')} *</label>
              <Input 
                {...register('name')} 
                error={errors.name?.message as string} 
                placeholder={t('gold_membership', 'مثال: العضوية الذهبية')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('description', 'الوصف')}</label>
              <Input 
                {...register('description')} 
                error={errors.description?.message as string} 
                placeholder={t('brief_details', 'تفاصيل مختصرة عن الباقة')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">{t('duration_days', 'المدة (بالأيام)')} *</label>
                <Input 
                  type="number"
                  {...register('durationDays')} 
                  error={errors.durationDays?.message as string} 
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">{t('price', 'السعر')} *</label>
                <Input 
                  type="number"
                  step="0.01"
                  {...register('price')} 
                  error={errors.price?.message as string} 
                  dir="ltr"
                />
              </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="flex flex-col relative overflow-hidden">
                <CardHeader className="pb-4"><div className="h-6 w-32 bg-surface-100 animate-pulse rounded" /></CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="h-10 w-24 bg-surface-100 animate-pulse rounded" />
                  <div className="space-y-2 mt-6">
                    <div className="h-4 w-full bg-surface-100 animate-pulse rounded" />
                    <div className="h-4 w-3/4 bg-surface-100 animate-pulse rounded" />
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-surface-100"><div className="h-8 w-full bg-surface-100 animate-pulse rounded" /></CardFooter>
              </Card>
            ))
          ) : plans.length > 0 ? (
            plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col relative overflow-hidden group hover:border-primary-300 transition-colors">
                <div className="absolute top-0 end-0 p-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-surface-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.description && <CardDescription>{plan.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-baseline gap-1" dir="ltr" style={{ justifyContent: 'flex-end' }}>
                    <span className="text-sm font-medium text-surface-500">/ {plan.duration_days} {t('days', 'يوم')}</span>
                    <span className="text-4xl font-extrabold text-surface-900">${plan.price}</span>
                  </div>
                  
                  <ul className="mt-6 space-y-3">
                    <li className="flex items-start gap-2 text-sm text-surface-600">
                      <Check className="h-4 w-4 text-primary-600 mt-0.5 shrink-0" />
                      <span>{t('access_basic', 'دخول لجميع المرافق الأساسية')}</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-surface-600">
                      <Check className="h-4 w-4 text-primary-600 mt-0.5 shrink-0" />
                      <span>{t('valid_for', 'صالحة لمدة')} {plan.duration_days} {t('days', 'يوم')}</span>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter className="pt-4 border-t border-surface-100 bg-surface-50/50 flex gap-2">
                  <Button variant="ghost" className="flex-1 text-surface-500 hover:text-primary-700" onClick={() => handleEdit(plan)}>
                    {t('edit_details', 'تعديل التفاصيل')}
                  </Button>
                  <Button variant="ghost" className="w-10 text-surface-500 hover:text-red-700 hover:bg-red-50 p-0" onClick={() => handleDelete(plan.id)} title={t('delete', 'حذف')}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-surface-200 rounded-xl">
              <p className="text-surface-500">{t('no_plans_found', 'لا توجد باقات حالياً.')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
