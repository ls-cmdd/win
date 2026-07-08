import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, FileText, Filter, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { invoke } from '../../lib/tauri';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ChartDataPoint {
  name: string;
  revenue: number;
}

interface Plan {
  id: number;
  name: string;
}

interface Payment {
  id: number;
  subscriber_name: string;
  plan_name: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  receipt_number: string;
}

export default function Reports() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('6m');
  const [plan, setPlan] = useState('all');
  
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [cData, pData, payData] = await Promise.all([
          invoke<ChartDataPoint[]>('get_chart_data'),
          invoke<Plan[]>('get_plans'),
          invoke<Payment[]>('get_payments')
        ]);
        setChartData(cData);
        setPlans(pData);
        setPayments(payData);
      } catch (e: any) {
        setError(t('error_loading_reports', 'حدث خطأ أثناء تحميل التقارير. يرجى المحاولة لاحقاً.'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredPayments = payments.filter(p => plan === 'all' || p.plan_name === plan);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredPayments.map(p => ({
      [t('subscriber_name', 'اسم المشترك')]: p.subscriber_name,
      [t('plan', 'الباقة')]: p.plan_name,
      [t('amount', 'المبلغ')]: p.amount,
      [t('payment_method', 'طريقة الدفع')]: p.payment_method,
      [t('date', 'التاريخ')]: p.payment_date,
      [t('receipt_number', 'رقم الإيصال')]: p.receipt_number
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('payments', 'المدفوعات'));
    XLSX.writeFile(wb, "reports.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [[
        t('receipt_number', 'رقم الإيصال'),
        t('date', 'التاريخ'),
        t('payment_method', 'طريقة الدفع'),
        t('amount', 'المبلغ'),
        t('plan', 'الباقة'),
        t('subscriber_name', 'اسم المشترك')
      ]],
      body: filteredPayments.map(p => [
        p.receipt_number,
        p.payment_date,
        p.payment_method,
        p.amount.toString(),
        p.plan_name,
        p.subscriber_name
      ]),
      styles: { halign: 'right' },
      headStyles: { halign: 'center' }
    });
    doc.save("reports.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">{t('reports', 'التقارير')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('reports_desc', 'تحليل الأداء المالي ونشاط المشتركين.')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={exportExcel} disabled={isLoading || !!error}>
            <FileSpreadsheet className="w-4 h-4 rtl:ml-2 ltr:mr-2" />
            {t('export_excel', 'تصدير إكسل')}
          </Button>
          <Button variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={exportPDF} disabled={isLoading || !!error}>
            <FileText className="w-4 h-4 rtl:ml-2 ltr:mr-2" />
            {t('export_pdf', 'تصدير PDF')}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="p-6 bg-red-50 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : (
        <Card>
          <div className="p-4 border-b border-surface-200 bg-surface-50/50 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-surface-600 font-medium text-sm">
              <Filter className="w-4 h-4" />
              {t('filters', 'التصنيفات')}:
            </div>
            <select 
              value={period} 
              onChange={e => setPeriod(e.target.value)}
              className="h-9 px-3 py-1 rounded-md border border-surface-300 text-sm focus:ring-primary-500"
              disabled={isLoading}
            >
              <option value="1m">{t('last_30_days', 'آخر 30 يوم')}</option>
              <option value="3m">{t('last_3_months', 'آخر 3 أشهر')}</option>
              <option value="6m">{t('last_6_months', 'آخر 6 أشهر')}</option>
              <option value="1y">{t('last_year', 'العام الماضي')}</option>
            </select>
            <select 
              value={plan} 
              onChange={e => setPlan(e.target.value)}
              className="h-9 px-3 py-1 rounded-md border border-surface-300 text-sm focus:ring-primary-500"
              disabled={isLoading}
            >
              <option value="all">{t('all_plans', 'جميع الباقات')}</option>
              {plans.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <CardContent className="pt-6">
            <div className="h-72 w-full mb-8" dir="ltr">
              {isLoading ? (
                <div className="w-full h-full bg-surface-100 animate-pulse rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="var(--color-surface-400)" fontSize={12} tickLine={false} axisLine={false} reversed={true} />
                    <YAxis stroke="var(--color-surface-400)" fontSize={12} tickLine={false} axisLine={false} orientation="right" tickFormatter={(value) => `${value}`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-surface-100)" />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-surface-200)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', textAlign: 'right', direction: 'rtl' }}
                      itemStyle={{ color: 'var(--color-surface-900)', fontWeight: 500 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="var(--color-primary-600)" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#reportRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <h3 className="text-lg font-semibold text-surface-900 mb-4">{t('detailed_results', 'النتائج المفصلة')}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date', 'التاريخ')}</TableHead>
                  <TableHead>{t('subscriber_name', 'اسم المشترك')}</TableHead>
                  <TableHead>{t('plan', 'الباقة')}</TableHead>
                  <TableHead>{t('payment_method', 'طريقة الدفع')}</TableHead>
                  <TableHead className="text-end">{t('amount', 'المبلغ')}</TableHead>
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
                ) : filteredPayments.length > 0 ? (
                  filteredPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-surface-900" dir="ltr" style={{ textAlign: 'right' }}>{p.payment_date}</TableCell>
                      <TableCell className="text-surface-600">{p.subscriber_name}</TableCell>
                      <TableCell className="text-surface-600">{p.plan_name}</TableCell>
                      <TableCell className="text-surface-600">
                        {p.payment_method === 'cash' ? t('cash', 'نقدي') : 
                         p.payment_method === 'card' ? t('card', 'بطاقة') : 
                         p.payment_method === 'transfer' ? t('transfer', 'تحويل') : 
                         p.payment_method}
                      </TableCell>
                      <TableCell className="text-end font-semibold text-surface-900" dir="ltr" style={{ textAlign: 'right' }}>${p.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-32 text-surface-500">
                      {t('no_data', 'لا توجد بيانات توافق التصفية.')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
