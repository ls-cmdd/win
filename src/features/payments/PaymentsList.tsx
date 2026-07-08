import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, Pencil, Trash, AlertCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { invoke } from '../../lib/tauri';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { jsPDF } from 'jspdf';

const paymentSchema = z.object({
  amount: z.coerce.number().min(0, 'لا يمكن أن يكون المبلغ سالباً'),
  paymentMethod: z.string().min(1, 'طريقة الدفع مطلوبة'),
  receiptNumber: z.string().min(1, 'رقم الإيصال مطلوب')
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface Payment {
  id: number;
  subscription_id: number;
  subscriber_name: string;
  plan_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_id: string | null;
}

export default function PaymentsList() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, paymentMethod: 'cash', receiptNumber: '' }
  });

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const p: Payment[] = await invoke('get_payments');
      setPayments(p);
    } catch (e: any) {
      setError(t('error_loading_payments', 'حدث خطأ أثناء تحميل بيانات الدفعات. يرجى المحاولة لاحقاً.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    reset({
      amount: payment.amount,
      paymentMethod: payment.payment_method,
      receiptNumber: payment.id.toString().padStart(6, '0')
    });
  };

  const handleDelete = async (id: number) => {
    if(!confirm(t('are_you_sure_delete_payment', 'هل أنت متأكد من حذف هذه الدفعة؟ لا يمكن التراجع عن هذا الإجراء.'))) return;
    try {
      await invoke('delete_payment', { id });
      fetchPayments();
    } catch (e: any) {
      alert(t('error_deleting', 'حدث خطأ أثناء محاولة الحذف.'));
    }
  };

  const onSubmit = async (data: PaymentFormValues) => {
    if (!editingPayment) return;
    try {
      await invoke('update_payment', {
        id: editingPayment.id,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        receiptNumber: data.receiptNumber
      });
      setEditingPayment(null);
      reset();
      fetchPayments();
    } catch (e: any) {
      alert(t('error_saving', 'حدث خطأ أثناء حفظ البيانات.'));
    }
  };

  const handlePrintReceipt = (payment: Payment) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });
    // For RTL support in PDF, we might need custom fonts. 
    // Here we'll stick to a simple English layout or standard layout.
    doc.setFontSize(20);
    doc.text('Receipt', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Receipt #: ${payment.id.toString().padStart(6, '0')}`, 20, 40);
    doc.text(`Date: ${format(parseISO(payment.payment_date), 'MMM dd, yyyy')}`, 20, 50);
    
    doc.line(20, 55, 130, 55);
    
    doc.text('Billed To:', 20, 65);
    doc.setFont('', 'bold');
    doc.text(payment.subscriber_name, 20, 72);
    doc.setFont('', 'normal');
    
    doc.text(`Plan: ${payment.plan_name}`, 20, 85);
    doc.text(`Method: ${payment.payment_method.toUpperCase()}`, 20, 95);
    if(payment.reference_id) {
      doc.text(`Ref: ${payment.reference_id}`, 20, 105);
    }
    
    doc.line(20, 115, 130, 115);
    
    doc.setFontSize(16);
    doc.setFont('', 'bold');
    doc.text(`Total Paid: $${payment.amount.toFixed(2)}`, 20, 130);
    
    doc.setFontSize(10);
    doc.setFont('', 'normal');
    doc.text('Thank you!', 105, 180, { align: 'center' });
    doc.save(`Receipt-${payment.id}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{t('payments', 'الدفعات')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('view_transactions', 'عرض سجل المعاملات المالية')}</p>
        </div>
      </div>

      <Dialog isOpen={!!editingPayment} onClose={() => setEditingPayment(null)} title={t('edit_payment', 'تعديل بيانات الدفعة')} description={t('modify_payment', 'تعديل قيمة أو طريقة الدفع.')}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('amount', 'المبلغ')}</label>
              <Input 
                type="number"
                step="0.01"
                {...register('amount')} 
                error={errors.amount?.message as string} 
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('payment_method', 'طريقة الدفع')}</label>
              <select 
                {...register('paymentMethod')} 
                className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${errors.paymentMethod ? 'border-red-500 focus:ring-red-500' : 'border-surface-300'}`}
              >
                <option value="cash">{t('cash', 'نقدي (Cash)')}</option>
                <option value="card">{t('card', 'بطاقة (Card)')}</option>
                <option value="transfer">{t('transfer', 'تحويل (Transfer)')}</option>
                <option value="webhook">{t('webhook', 'تحويل آلي (Webhook)')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t('receipt_number', 'رقم الإيصال')}</label>
              <Input 
                {...register('receiptNumber')} 
                error={errors.receiptNumber?.message as string} 
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 mt-6">
            <Button type="button" variant="ghost" onClick={() => setEditingPayment(null)}>{t('cancel', 'إلغاء')}</Button>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-center">{t('receipt_no', 'رقم الإيصال')}</TableHead>
                <TableHead>{t('subscriber', 'المشترك')}</TableHead>
                <TableHead>{t('plan', 'الباقة')}</TableHead>
                <TableHead>{t('amount', 'المبلغ')}</TableHead>
                <TableHead>{t('date', 'التاريخ')}</TableHead>
                <TableHead>{t('method', 'الطريقة')}</TableHead>
                <TableHead className="text-end">{t('actions', 'الإجراءات')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-12 bg-surface-100 animate-pulse rounded-md w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : payments.length > 0 ? (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-surface-500 text-center" dir="ltr">
                      {payment.id.toString().padStart(6, '0')}
                    </TableCell>
                    <TableCell className="font-medium">{payment.subscriber_name}</TableCell>
                    <TableCell className="text-surface-600">{payment.plan_name}</TableCell>
                    <TableCell className="font-semibold text-surface-900" dir="ltr" style={{ textAlign: 'right' }}>${payment.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-surface-600" dir="ltr" style={{ textAlign: 'right' }}>
                      {format(parseISO(payment.payment_date), 'dd MMM yyyy', { locale: ar })}
                    </TableCell>
                    <TableCell>
                      <span className="uppercase text-xs font-semibold tracking-wider text-surface-500 bg-surface-100 px-2 py-1 rounded">
                        {payment.payment_method === 'cash' ? t('cash', 'نقدي') : 
                         payment.payment_method === 'card' ? t('card', 'بطاقة') : 
                         payment.payment_method === 'transfer' ? t('transfer', 'تحويل') : 
                         payment.payment_method}
                      </span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-surface-500 hover:text-primary-600 hover:bg-primary-50" onClick={() => handleEdit(payment)} title={t('edit', 'تعديل')}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePrintReceipt(payment)} title={t('print', 'طباعة')}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(payment.id)} title={t('delete', 'حذف')}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-surface-500">
                    {t('no_payments_found', 'لا توجد دفعات مسجلة.')}
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
