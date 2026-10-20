import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileText,
  Film,
  ForkKnife,
  House,
  LayoutDashboard,
  LogOut,
  Pencil,
  PieChart,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api');
const TOKEN_KEY = 'morrow-access-token';
const CATEGORIES = ['Food & drink', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Home', 'Other'];
const PLOT_COLORS = ['#507764', '#d77e62', '#d6ae4f', '#8292a5', '#9f809f', '#77a8a0', '#bd8b48', '#ac695b'];
const categoryIcons = {
  'Food & drink': ForkKnife,
  Transport: CarFront,
  Shopping: ShoppingBag,
  Bills: FileText,
  Health: Sparkles,
  Entertainment: Film,
  Home: House,
  Other: Tag,
};

const money = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(amount || 0);

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value, options = { month: 'short', day: 'numeric' }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', options);
}

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || 'Something went wrong. Please try again.');
  return body;
}

function Logo({ light = false }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark"><span /></span>
      <span>Expense Tracker</span>
    </div>
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'register';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (signingUp && password !== confirmation) {
      setError('Those passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await api(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      onAuthenticated(result);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <div className="auth-aside-top"><Logo light /><span className="aside-stamp">MONEY, MADE CLEAR</span></div>
        <div className="auth-message">
          <p className="eyebrow">A LITTLE MORE CLARITY</p>
          <h1>Your money,<br />in a better place.</h1>
          <p>Keep the everyday spending in view, without making a whole thing of it.</p>
        </div>
        <div className="aside-note"><span className="note-icon"><BarChart3 size={17} /></span><span>Small steps add up.<br /><strong>See where yours go.</strong></span><ArrowUpRight size={18} /></div>
      </section>
      <section className="auth-content">
        <div className="auth-mobile-brand"><Logo /></div>
        <div className="auth-form-wrap">
          <p className="eyebrow">{signingUp ? 'GET STARTED' : 'WELCOME BACK'}</p>
          <h2>{signingUp ? 'Make room for clarity.' : 'Good to see you.'}</h2>
          <p className="auth-subtitle">{signingUp ? 'Create your account to start tracking.' : 'Sign in to pick up where you left off.'}</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              minLength={3}
              maxLength={40}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. alex.m"
            />
            <div className="label-row"><label htmlFor="password">Password</label>{signingUp && <span>At least 8 characters</span>}</div>
            <input
              id="password"
              type="password"
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
            {signingUp && <>
              <label htmlFor="confirmation">Confirm password</label>
              <input
                id="confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Enter it once more"
              />
            </>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-dark auth-submit" disabled={busy} type="submit">
              {busy ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
              {!busy && <ArrowUpRight size={17} />}
            </button>
          </form>
          <p className="auth-switch">
            {signingUp ? 'Already have an account?' : 'New here?'}{' '}
            <button type="button" onClick={() => { setMode(signingUp ? 'login' : 'register'); setError(''); }}>
              {signingUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="auth-safety"><Check size={14} /> Your password is encrypted and never stored as plain text.</p>
        </div>
        <span className="auth-footer">A calmer look at the everyday.</span>
      </section>
    </main>
  );
}

function ExpenseDialog({ expense, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: expense?.title || '',
    amount: expense?.amount ?? '',
    category: expense?.category || CATEGORIES[0],
    spent_at: expense?.spent_at || localDate(),
    notes: expense?.notes || '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave({ ...form, amount: Number(form.amount) });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="expense-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">YOUR MONEY, ACCOUNTED FOR</p><h2 id="dialog-title">{expense ? 'Edit expense' : 'Add an expense'}</h2></div>
          <button className="icon-button close-button" onClick={onClose} title="Close dialog" aria-label="Close dialog"><X size={19} /></button>
        </div>
        <form className="expense-form" onSubmit={submit}>
          <label htmlFor="expense-title">What was it for?</label>
          <input id="expense-title" autoFocus required maxLength={100} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Weekly groceries" />
          <div className="form-pair">
            <div><label htmlFor="expense-amount">Amount</label><div className="amount-input"><span>₹</span><input id="expense-amount" type="number" required min="0.01" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} placeholder="0.00" /></div></div>
            <div><label htmlFor="expense-date">Date</label><input id="expense-date" type="date" required value={form.spent_at} onChange={(event) => update('spent_at', event.target.value)} /></div>
          </div>
          <label htmlFor="expense-category">Category</label>
          <select id="expense-category" value={form.category} onChange={(event) => update('category', event.target.value)}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
          <label htmlFor="expense-notes">Note <span className="optional-label">OPTIONAL</span></label>
          <textarea id="expense-notes" rows="2" maxLength={500} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Add a little context…" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-dark" disabled={busy} type="submit">{busy ? 'Saving…' : expense ? 'Save changes' : 'Save expense'}<Check size={16} /></button></div>
        </form>
      </section>
    </div>
  );
}

function ExpenseRow({ expense, onEdit, onDelete }) {
  const Icon = categoryIcons[expense.category] || Tag;
  return (
    <div className="expense-row">
      <div className={`category-icon icon-${CATEGORIES.indexOf(expense.category)}`}><Icon size={17} strokeWidth={1.8} /></div>
      <div className="expense-details"><strong>{expense.title}</strong><span>{expense.category}{expense.notes ? ` · ${expense.notes}` : ''}</span></div>
      <span className="expense-date">{displayDate(expense.spent_at)}</span>
      <strong className="expense-amount">−{money(expense.amount)}</strong>
      <div className="row-actions">
        <button className="icon-button" title={`Edit ${expense.title}`} aria-label={`Edit ${expense.title}`} onClick={() => onEdit(expense)}><Pencil size={15} /></button>
        <button className="icon-button danger-button" title={`Delete ${expense.title}`} aria-label={`Delete ${expense.title}`} onClick={() => onDelete(expense)}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function Dashboard({ user, expenses, onAdd, onEdit, onDelete, onSignOut }) {
  const [view, setView] = useState('overview');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = expenses.filter((expense) => expense.spent_at.startsWith(monthKey));
  const total = currentMonth.reduce((sum, expense) => sum + expense.amount, 0);
  const byCategory = currentMonth.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    return totals;
  }, {});
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  let plotProgress = 0;
  const plotSlices = categoryEntries.map(([name, amount], index) => {
    const start = plotProgress;
    plotProgress += (amount / total) * 100;
    return { name, amount, color: PLOT_COLORS[index % PLOT_COLORS.length], start, end: plotProgress };
  });
  const donutStops = plotSlices.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`).join(', ');
  const filtered = useMemo(() => expenses.filter((expense) => {
    const matchesSearch = `${expense.title} ${expense.category} ${expense.notes}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (category === 'All categories' || expense.category === category);
  }), [expenses, search, category]);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const key = localDate(day);
    const amount = expenses.filter((expense) => expense.spent_at === key).reduce((sum, expense) => sum + expense.amount, 0);
    return { key, label: day.toLocaleDateString('en-US', { weekday: 'short' }), amount };
  });
  const chartMax = Math.max(...days.map((day) => day.amount), 1);
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo light />
        <div className="sidebar-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={view === 'overview' ? 'active' : ''} aria-label="Overview" onClick={() => setView('overview')}><LayoutDashboard size={17} /><span className="nav-label">Overview</span></button>
          <button className={view === 'plots' ? 'active' : ''} aria-label="Plot" onClick={() => setView('plots')}><PieChart size={17} /><span className="nav-label">Plot</span></button>
          <button className={view === 'transactions' ? 'active' : ''} aria-label="Transactions" onClick={() => setView('transactions')}><CreditCard size={17} /><span className="nav-label">Transactions</span><span className="nav-count">{expenses.length}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><span className="tip-spark"><Sparkles size={15} /></span><p>A clearer picture starts with one small entry.</p></div>
          <div className="profile-row"><div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{user.username}</strong><span>Personal account</span></div><button className="icon-button sidebar-logout" title="Sign out" aria-label="Sign out" onClick={onSignOut}><LogOut size={16} /></button></div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>My space</span><span className="breadcrumb-slash">/</span><strong>{view === 'overview' ? 'Overview' : view === 'plots' ? 'Plot' : 'Transactions'}</strong></div>
          <div className="topbar-actions"><span className="today-label">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span><button className="button button-dark add-button" onClick={onAdd}><Plus size={17} />Add expense</button><button className="icon-button mobile-logout" title="Sign out" aria-label="Sign out" onClick={onSignOut}><LogOut size={17} /></button></div>
        </header>
        <main className="dashboard-main">
          {view === 'overview' ? <>
            <section className="welcome-row"><div><p className="eyebrow">{monthName.toUpperCase()} · YOUR MONEY, IN FOCUS</p><h1>A good day to get <span>clear.</span></h1><p className="welcome-sub">Here’s the shape of your spending this month.</p></div><div className="month-chip"><span className="month-dot" />{monthName}<ChevronDown size={14} /></div></section>
            <section className="stats-grid" aria-label="Monthly spending summary">
              <article className="stat-card stat-primary"><div className="stat-top"><span>Spent this month</span><span className="stat-icon"><Wallet size={17} /></span></div><strong className="stat-value">{money(total)}</strong><div className="stat-foot"><span className="stat-foot-mark"><ArrowDownRight size={14} /></span>{currentMonth.length} {currentMonth.length === 1 ? 'expense' : 'expenses'} recorded</div></article>
              <article className="stat-card"><div className="stat-top"><span>Daily average</span><span className="stat-icon stat-icon-coral"><BarChart3 size={17} /></span></div><strong className="stat-value">{money(total / Math.max(now.getDate(), 1))}</strong><div className="stat-foot">Based on {now.getDate()} days this month</div></article>
              <article className="stat-card"><div className="stat-top"><span>Top category</span><span className="stat-icon stat-icon-lilac"><Tag size={17} /></span></div><strong className="stat-value stat-category">{topCategory?.[0] || 'Nothing yet'}</strong><div className="stat-foot">{topCategory ? `${money(topCategory[1])} this month` : 'Add an expense to get started'}</div></article>
            </section>
            <section className="panel transactions-panel">
              <div className="panel-heading transaction-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest expenses</h2></div><button className="text-button" onClick={() => setView('transactions')}>All transactions <ArrowUpRight size={15} /></button></div>
              {expenses.length ? <div className="expense-list">{expenses.slice(0, 5).map((expense) => <ExpenseRow key={expense.id} expense={expense} onEdit={onEdit} onDelete={onDelete} />)}</div> : <EmptyState onAdd={onAdd} />}
            </section>
          </> : view === 'plots' ? <>
            <section className="plots-view-head"><div><p className="eyebrow">A CLEARER VIEW OF YOUR SPENDING</p><h1>Spending plots<span className="heading-period">.</span></h1><p className="welcome-sub">{monthName} · {money(total)} recorded this month</p></div></section>
            <section className="plots-grid">
              <article className="panel weekly-panel plot-weekly-panel">
                <div className="panel-heading"><div><p className="eyebrow">THE LAST 7 DAYS</p><h2>Daily spending</h2></div><span className="panel-badge"><span />Daily total</span></div>
                <div className="chart-area" role="img" aria-label="Daily expenses over the last seven days">
                  {days.map((day) => <div className="chart-column" key={day.key}><div className="bar-track"><div className={`chart-bar ${day.key === localDate() ? 'bar-today' : ''}`} style={{ height: `${day.amount ? Math.max((day.amount / chartMax) * 100, 7) : 3}%` }} title={`${day.label}: ${money(day.amount)}`} /></div><span className={day.key === localDate() ? 'day-today' : ''}>{day.label}</span></div>)}
                </div>
                <div className="chart-caption"><span><span className="caption-dot" />Activity by day</span><strong>{money(days.reduce((sum, day) => sum + day.amount, 0))}<small> in 7 days</small></strong></div>
              </article>
              <article className="panel circular-panel">
                <div className="panel-heading"><div><p className="eyebrow">THIS MONTH</p><h2>Spending by category</h2></div><PieChart size={18} color="#78917e" /></div>
                {topCategory ? <div className="donut-layout">
                  <div className="donut-chart" role="img" aria-label={`Monthly expenses by category, total ${money(total)}`} style={{ background: `conic-gradient(from -90deg, ${donutStops})` }}>
                    <div className="donut-center"><span>TOTAL SPENT</span><strong>{money(total)}</strong></div>
                  </div>
                  <div className="donut-legend">{plotSlices.map((slice) => <div className="donut-legend-row" key={slice.name}><span className="donut-swatch" style={{ '--slice-color': slice.color }} /><strong title={slice.name}>{slice.name}</strong><span>{Math.round((slice.amount / total) * 100)}%</span><b>{money(slice.amount)}</b></div>)}</div>
                </div> : <div className="category-empty plot-empty"><span><PieChart size={20} /></span><p>Add expenses to see the category breakdown.</p></div>}
              </article>
            </section>
          </> : <>
            <section className="transactions-view-head"><div><p className="eyebrow">EVERY LITTLE THING, IN ONE PLACE</p><h1>Your transactions<span className="heading-period">.</span></h1><p className="welcome-sub">{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} · {money(total)} spent this month</p></div><button className="button button-dark add-button mobile-add" onClick={onAdd}><Plus size={17} />Add expense</button></section>
            <section className="panel all-transactions-panel">
              <div className="filter-row"><label className="search-box"><Search size={17} /><input aria-label="Search transactions" placeholder="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button className="icon-button" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search"><X size={15} /></button>}</label><label className="category-select"><span className="filter-icon"><Tag size={15} /></span><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label></div>
              {filtered.length ? <div className="expense-list">{filtered.map((expense) => <ExpenseRow key={expense.id} expense={expense} onEdit={onEdit} onDelete={onDelete} />)}</div> : <div className="filter-empty"><span><Search size={18} /></span><strong>No expenses found</strong><p>Try a different search or category.</p></div>}
            </section>
          </>}
          <footer className="dashboard-footer"><span>One step at a time.</span><span><CircleHelp size={14} /> Your data stays private.</span></footer>
        </main>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return <div className="empty-state"><div className="empty-illustration"><span className="empty-sheet"><span /><span /><span /></span><span className="empty-sun" /></div><p className="eyebrow">A FRESH START</p><h3>Your first expense goes here.</h3><p>Once you add one, your spending starts to tell its story.</p><button className="button button-outline" onClick={onAdd}><Plus size={16} />Add your first expense</button></div>;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));
  const [dialogExpense, setDialogExpense] = useState(undefined);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([api('/auth/me', { token }), api('/expenses', { token })])
      .then(([account, records]) => {
        if (active) { setUser(account); setExpenses(records); }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (active) { setToken(null); setUser(null); setExpenses([]); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  function authenticate(result) {
    localStorage.setItem(TOKEN_KEY, result.access_token);
    setToken(result.access_token);
    setUser(result.user);
    setLoading(true);
  }

  async function saveExpense(values) {
    const editing = dialogExpense && dialogExpense !== 'new';
    const saved = await api(editing ? `/expenses/${dialogExpense.id}` : '/expenses', {
      token,
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(values),
    });
    setExpenses((previous) => editing
      ? previous.map((expense) => expense.id === saved.id ? saved : expense)
      : [saved, ...previous].sort((a, b) => b.spent_at.localeCompare(a.spent_at) || b.id - a.id));
    setDialogExpense(undefined);
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`Delete “${expense.title}”? This cannot be undone.`)) return;
    try {
      await api(`/expenses/${expense.id}`, { token, method: 'DELETE' });
      setExpenses((previous) => previous.filter((item) => item.id !== expense.id));
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function signOut() {
    try { if (token) await api('/auth/logout', { token, method: 'POST' }); } catch { /* Clear local session even when offline. */ }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setExpenses([]);
  }

  if (loading) return <main className="loading-screen"><Logo /><span className="loading-mark" /></main>;
  if (!token || !user) return <AuthScreen onAuthenticated={authenticate} />;

  return <>
    <Dashboard
      user={user}
      expenses={expenses}
      onAdd={() => setDialogExpense('new')}
      onEdit={(expense) => setDialogExpense(expense)}
      onDelete={deleteExpense}
      onSignOut={signOut}
    />
    {dialogExpense !== undefined && <ExpenseDialog expense={dialogExpense === 'new' ? null : dialogExpense} onClose={() => setDialogExpense(undefined)} onSave={saveExpense} />}
  </>;
}