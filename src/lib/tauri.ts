// Detect if we're running inside Tauri
export const isTauri = typeof window !== 'undefined' && 
  (Boolean((window as any).__TAURI__) || Boolean((window as any).__TAURI_INTERNALS__));

// Helper to get/set data in mock localStorage DB (Web Browser preview fallback only)
function getMockDB(key: string, defaultVal: any) {
  const data = localStorage.getItem(`mock_db_${key}`);
  if (!data) {
    localStorage.setItem(`mock_db_${key}`, JSON.stringify(defaultVal));
    return defaultVal;
  }
  return JSON.parse(data);
}

function setMockDB(key: string, value: any) {
  localStorage.setItem(`mock_db_${key}`, JSON.stringify(value));
}

// Initialize default mock data for the Web Browser fallback
const defaultUsers = [{ id: 1, username: 'admin', password_hash: 'admin', role: 'admin' }];
const defaultPlans = [
  { id: 1, name: 'الخطة الذهبية', description: 'اشتراك ذهبي شامل', duration_days: 30, price: 150.0 },
  { id: 2, name: 'الخطة الفضية', description: 'اشتراك فضي متوسط', duration_days: 15, price: 80.0 },
  { id: 3, name: 'الخطة البرونزية', description: 'اشتراك برونزي اقتصادي', duration_days: 7, price: 40.0 }
];
const defaultSubscribers = [
  { id: 1, full_name: 'أحمد محمد علي', phone: '0599123456', email: 'ahmed@example.com', national_id: '123456789', notes: 'عميل مميز', created_at: new Date().toISOString() },
  { id: 2, full_name: 'سارة خالد أحمد', phone: '0599765432', email: 'sara@example.com', national_id: '987654321', notes: '', created_at: new Date().toISOString() }
];
const defaultSubscriptions = [
  { id: 1, subscriber_id: 1, plan_id: 1, start_date: '2026-07-01', end_date: '2026-07-31', status: 'active', auto_renew: true },
  { id: 2, subscriber_id: 2, plan_id: 2, start_date: '2026-07-01', end_date: '2026-07-16', status: 'active', auto_renew: false }
];
const defaultPayments = [
  { id: 1, subscription_id: 1, amount: 150.0, payment_method: 'cash', payment_date: '2026-07-01 10:00:00', receipt_number: 'REC-1001' },
  { id: 2, subscription_id: 2, amount: 80.0, payment_method: 'card', payment_date: '2026-07-02 11:30:00', receipt_number: 'REC-1002' }
];

/**
 * Real Tauri invoke function calling the native Rust backend directly when in Tauri.
 * Falls back to an interactive localStorage database when running in browser mode to prevent crashes.
 */
export async function invoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (isTauri) {
    const tauriGlobal = (window as any).__TAURI__;
    
    // Attempt global injection lookup (facilitated by withGlobalTauri: true in tauri.conf.json)
    if (tauriGlobal && tauriGlobal.core && typeof tauriGlobal.core.invoke === 'function') {
      return tauriGlobal.core.invoke(cmd, args);
    }
    if (tauriGlobal && typeof tauriGlobal.invoke === 'function') {
      return tauriGlobal.invoke(cmd, args);
    }

    // Dynamic import fallback if the global context is loading or requires module resolution
    try {
      const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
      return tauriInvoke<T>(cmd, args);
    } catch (err) {
      console.error('Failed to resolve Tauri core invoke module:', err);
      throw new Error(`Tauri is active, but command '${cmd}' failed to execute: ${err}`);
    }
  }

  // Web Browser Mock Fallback Mode
  console.log(`[Tauri Web Fallback] Invoking command: ${cmd}`, args);

  switch (cmd) {
    case 'check_license': {
      return true as unknown as T; // Always licensed in browser/preview for smooth experience
    }
    case 'activate_license': {
      return true as unknown as T;
    }
    case 'check_system_setup': {
      const users = getMockDB('users', defaultUsers);
      return (users.length > 0) as unknown as T;
    }
    case 'setup_system': {
      const { password } = args || {};
      const users = getMockDB('users', defaultUsers);
      users.push({ id: Date.now(), username: 'admin', password_hash: password || 'admin', role: 'admin' });
      setMockDB('users', users);
      return "Admin user created successfully." as unknown as T;
    }
    case 'login': {
      const { username, password } = args || {};
      const users = getMockDB('users', defaultUsers);
      const user = users.find((u: any) => u.username === username);
      if (user) {
        return {
          id: user.id,
          username: user.username,
          role: user.role
        } as unknown as T;
      }
      throw new Error("Invalid credentials");
    }
    case 'sync_auth_session': {
      return null as unknown as T;
    }
    
    // PLANS
    case 'get_plans': {
      const plans = getMockDB('plans', defaultPlans);
      return plans as unknown as T;
    }
    case 'add_plan': {
      const { name, description, duration_days, price } = args || {};
      const plans = getMockDB('plans', defaultPlans);
      const newId = plans.length > 0 ? Math.max(...plans.map((p: any) => p.id)) + 1 : 1;
      const newPlan = { id: newId, name, description, duration_days: Number(duration_days), price: Number(price) };
      plans.push(newPlan);
      setMockDB('plans', plans);
      return newId as unknown as T;
    }
    case 'update_plan': {
      const { id, name, description, duration_days, price } = args || {};
      const plans = getMockDB('plans', defaultPlans);
      const idx = plans.findIndex((p: any) => p.id === Number(id));
      if (idx !== -1) {
        plans[idx] = { ...plans[idx], name, description, duration_days: Number(duration_days), price: Number(price) };
        setMockDB('plans', plans);
      }
      return null as unknown as T;
    }
    case 'delete_plan': {
      const { id } = args || {};
      const plans = getMockDB('plans', defaultPlans);
      const updated = plans.filter((p: any) => p.id !== Number(id));
      setMockDB('plans', updated);
      return null as unknown as T;
    }

    // SUBSCRIBERS
    case 'get_subscribers': {
      const { search } = args || {};
      const subscribers = getMockDB('subscribers', defaultSubscribers);
      if (search) {
        const query = (search as string).toLowerCase();
        return subscribers.filter((s: any) => 
          s.full_name.toLowerCase().includes(query) || 
          s.phone.includes(query)
        ) as unknown as T;
      }
      return subscribers as unknown as T;
    }
    case 'add_subscriber': {
      const { full_name, phone, email, national_id, notes } = args || {};
      const subscribers = getMockDB('subscribers', defaultSubscribers);
      const newId = subscribers.length > 0 ? Math.max(...subscribers.map((s: any) => s.id)) + 1 : 1;
      const newSub = { id: newId, full_name, phone, email, national_id, notes, created_at: new Date().toISOString() };
      subscribers.push(newSub);
      setMockDB('subscribers', subscribers);
      return newId as unknown as T;
    }
    case 'update_subscriber': {
      const { id, full_name, phone, email, national_id, notes } = args || {};
      const subscribers = getMockDB('subscribers', defaultSubscribers);
      const idx = subscribers.findIndex((s: any) => s.id === Number(id));
      if (idx !== -1) {
        subscribers[idx] = { ...subscribers[idx], full_name, phone, email, national_id, notes };
        setMockDB('subscribers', subscribers);
      }
      return null as unknown as T;
    }
    case 'delete_subscriber': {
      const { id } = args || {};
      const subscribers = getMockDB('subscribers', defaultSubscribers);
      const updated = subscribers.filter((s: any) => s.id !== Number(id));
      setMockDB('subscribers', updated);
      return null as unknown as T;
    }

    // SUBSCRIPTIONS
    case 'get_subscriptions': {
      const subscriptions = getMockDB('subscriptions', defaultSubscriptions);
      const subscribers = getMockDB('subscribers', defaultSubscribers);
      const plans = getMockDB('plans', defaultPlans);

      // Map to include subscriber_name and plan_name
      const enriched = subscriptions.map((sub: any) => {
        const subscriber = subscribers.find((s: any) => s.id === sub.subscriber_id);
        const plan = plans.find((p: any) => p.id === sub.plan_id);
        return {
          ...sub,
          subscriber_name: subscriber ? subscriber.full_name : 'غير معروف',
          plan_name: plan ? plan.name : 'غير معروف'
        };
      });
      return enriched as unknown as T;
    }
    case 'add_subscription': {
      const { subscriber_id, plan_id, start_date, end_date, status, auto_renew } = args || {};
      const subscriptions = getMockDB('subscriptions', defaultSubscriptions);
      const newId = subscriptions.length > 0 ? Math.max(...subscriptions.map((s: any) => s.id)) + 1 : 1;
      const newSub = {
        id: newId,
        subscriber_id: Number(subscriber_id),
        plan_id: Number(plan_id),
        start_date,
        end_date,
        status: status || 'active',
        auto_renew: Boolean(auto_renew)
      };
      subscriptions.push(newSub);
      setMockDB('subscriptions', subscriptions);
      return newId as unknown as T;
    }
    case 'renew_subscription': {
      const { id } = args || {};
      const subscriptions = getMockDB('subscriptions', defaultSubscriptions);
      const plans = getMockDB('plans', defaultPlans);
      const idx = subscriptions.findIndex((s: any) => s.id === Number(id));
      if (idx !== -1) {
        const sub = subscriptions[idx];
        const plan = plans.find((p: any) => p.id === sub.plan_id);
        const duration = plan ? plan.duration_days : 30;
        
        let start = new Date(sub.end_date);
        if (start < new Date()) {
          start = new Date();
        }
        const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
        
        subscriptions[idx] = {
          ...sub,
          end_date: end.toISOString().split('T')[0],
          status: 'active'
        };
        setMockDB('subscriptions', subscriptions);
      }
      return null as unknown as T;
    }
    case 'cancel_subscription': {
      const { id } = args || {};
      const subscriptions = getMockDB('subscriptions', defaultSubscriptions);
      const idx = subscriptions.findIndex((s: any) => s.id === Number(id));
      if (idx !== -1) {
        subscriptions[idx] = { ...subscriptions[idx], status: 'cancelled' };
        setMockDB('subscriptions', subscriptions);
      }
      return null as unknown as T;
    }

    // PAYMENTS
    case 'get_payments': {
      const payments = getMockDB('payments', defaultPayments);
      const subscriptions = getMockDB('subscriptions', defaultSubscriptions);
      const subscribers = getMockDB('subscribers', defaultSubscribers);
      const plans = getMockDB('plans', defaultPlans);

      const enriched = payments.map((pay: any) => {
        const sub = subscriptions.find((s: any) => s.id === pay.subscription_id);
        const subscriber = sub ? subscribers.find((s: any) => s.id === sub.subscriber_id) : null;
        const plan = sub ? plans.find((p: any) => p.id === sub.plan_id) : null;
        return {
          ...pay,
          subscriber_name: subscriber ? subscriber.full_name : 'غير معروف',
          plan_name: plan ? plan.name : 'غير معروف'
        };
      });
      return enriched as unknown as T;
    }
    case 'add_payment': {
      const { subscription_id, amount, payment_method, receipt_number, notes } = args || {};
      const payments = getMockDB('payments', defaultPayments);
      const newId = payments.length > 0 ? Math.max(...payments.map((p: any) => p.id)) + 1 : 1;
      const newPay = {
        id: newId,
        subscription_id: Number(subscription_id),
        amount: Number(amount),
        payment_method,
        receipt_number,
        notes,
        payment_date: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };
      payments.push(newPay);
      setMockDB('payments', payments);
      return newId as unknown as T;
    }
    case 'update_payment': {
      const { id, amount, payment_method, receipt_number } = args || {};
      const payments = getMockDB('payments', defaultPayments);
      const idx = payments.findIndex((p: any) => p.id === Number(id));
      if (idx !== -1) {
        payments[idx] = { ...payments[idx], amount: Number(amount), payment_method, receipt_number };
        setMockDB('payments', payments);
      }
      return null as unknown as T;
    }
    case 'delete_payment': {
      const { id } = args || {};
      const payments = getMockDB('payments', defaultPayments);
      const updated = payments.filter((p: any) => p.id !== Number(id));
      setMockDB('payments', updated);
      return null as unknown as T;
    }

    // DASHBOARD
    case 'get_dashboard_stats': {
      const subscriptions = getMockDB('subscriptions', defaultSubscriptions);
      const payments = getMockDB('payments', defaultPayments);

      const active_subscribers = subscriptions.filter((s: any) => s.status === 'active').length;
      
      const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
      const current_month_revenue = payments
        .filter((p: any) => p.payment_date.startsWith(currentMonthStr))
        .reduce((sum: number, p: any) => sum + p.amount, 0);

      // Expiring soon (next 7 days)
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expiring_soon = subscriptions.filter((s: any) => {
        if (s.status !== 'active') return false;
        const end = new Date(s.end_date);
        return end >= now && end <= nextWeek;
      }).length;

      const churn_rate = subscriptions.length > 0 ? (subscriptions.filter((s: any) => s.status === 'expired' || s.status === 'cancelled').length / subscriptions.length) * 100 : 0.0;

      return {
        active_subscribers,
        current_month_revenue,
        expiring_soon,
        churn_rate
      } as unknown as T;
    }
    case 'get_chart_data': {
      const payments = getMockDB('payments', defaultPayments);
      // Group by month
      const monthly: Record<string, number> = {};
      payments.forEach((p: any) => {
        const month = p.payment_date.substring(0, 7); // "YYYY-MM"
        monthly[month] = (monthly[month] || 0) + p.amount;
      });

      const sortedMonths = Object.keys(monthly).sort();
      const chartData = sortedMonths.map((m) => ({
        name: m,
        revenue: monthly[m]
      }));

      // If empty, return a default point
      if (chartData.length === 0) {
        chartData.push({ name: new Date().toISOString().substring(0, 7), revenue: 0 });
      }

      return chartData as unknown as T;
    }

    case 'get_webhook_secret': {
      let secret = localStorage.getItem('mock_webhook_secret');
      if (!secret) {
        secret = 'whsec_mock_' + Math.random().toString(16).substring(2, 10);
        localStorage.setItem('mock_webhook_secret', secret);
      }
      return secret as unknown as T;
    }
    case 'rotate_webhook_secret': {
      const secret = 'whsec_mock_' + Math.random().toString(16).substring(2, 10);
      localStorage.setItem('mock_webhook_secret', secret);
      return secret as unknown as T;
    }

    case 'create_backup': {
      return "Successfully created mock database backup." as unknown as T;
    }

    default:
      console.warn(`[Tauri Web Fallback] Unknown command called: ${cmd}`);
      return null as unknown as T;
  }
}
