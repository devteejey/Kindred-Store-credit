import React, { useContext, useEffect, useState } from 'react';
import { apiRequest } from './api.js';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight,
  Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, CreditCard, Download, Ellipsis, Eye, EyeOff, LayoutDashboard,
  LifeBuoy, LockKeyhole, LogIn, Menu, Plus, Search, Settings, SlidersHorizontal,
  Sparkles, Store, UserRound, UserPlus, Users, X,
} from 'lucide-react';

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Customers', icon: Users },
  { label: 'Transactions', icon: ArrowDownLeft },
  { label: 'Reports', icon: CalendarDays },
];

const defaultStoreSettings = {
  storeName: 'The Corner Store',
  email: 'hello@thecornerstore.com',
  currency: 'USD',
  reminderDays: 3,
  overdueReminders: true,
  weeklySummary: true,
  theme: 'light',
  accent: 'violet',
};
const defaultUserProfile = { name: 'Store Owner', email: '' };
const CurrencyContext = React.createContext('USD');

function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}

function useMoney() {
  const currency = useContext(CurrencyContext);
  return (value) => formatMoney(value, currency);
}

function useCurrencySymbol() {
  const currency = useContext(CurrencyContext);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0)
    .find((part) => part.type === 'currency')?.value || currency;
}

function Avatar({ person, small = false }) {
  return <span className={`avatar avatar-${person.color}${small ? ' avatar-small' : ''}`}>{person.initials}</span>;
}

function Status({ status }) {
  const className = status.toLowerCase().replace(' ', '-');
  return <span className={`status status-${className}`}><span className="status-dot" />{status}</span>;
}

function StatusFilter({ selectedStatus, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="filter-wrap">
      <button className={`button button-secondary${selectedStatus !== 'All' ? ' button-filter-active' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={15} />Filter{selectedStatus !== 'All' && <span className="filter-active-label">{selectedStatus}</span>}
      </button>
      {open && <div className="filter-menu">{['All', 'Overdue', 'Due soon', 'Paid'].map((item) => <button key={item} onClick={() => { onChange(item); setOpen(false); }}>{item}{selectedStatus === item && <Check size={14} />}</button>)}</div>}
    </div>
  );
}

function ActionMenu({ label, ariaLabel, icon: Icon, items, className = '', buttonClassName = 'icon-button' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`action-menu-wrap ${className}`}>
      <button className={buttonClassName} aria-label={ariaLabel || label} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {Icon && <Icon size={16} />}{label}
      </button>
      {open && <div className="action-menu" role="menu">
        {items.map((item) => <button key={item.label} role="menuitem" onClick={() => { setOpen(false); item.onSelect(); }}>{item.label}</button>)}
      </div>}
    </div>
  );
}

function NotificationMenu({ customers, onViewCustomers }) {
  const [open, setOpen] = useState(false);
  const overdueCount = customers.filter((customer) => customer.status === 'Overdue').length;
  const dueSoonCount = customers.filter((customer) => customer.status === 'Due soon').length;
  const totalAlerts = overdueCount + dueSoonCount;
  return (
    <div className="action-menu-wrap notification-menu-wrap">
      <button className="icon-button notification-button" aria-label={totalAlerts ? `Notifications, ${totalAlerts} account reminders` : 'Notifications'} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Bell size={18} />{totalAlerts > 0 && <i />}
      </button>
      {open && (
        <div className="action-menu notification-menu" role="menu" aria-label="Account reminders">
          <strong className="notification-heading">Account reminders</strong>
          {overdueCount > 0 && <button role="menuitem" onClick={() => { setOpen(false); onViewCustomers('Overdue'); }}><span className="notification-count">{overdueCount}</span><span><b>Overdue accounts</b><small>Customers with a past-due balance</small></span><ChevronRight size={15} /></button>}
          {dueSoonCount > 0 && <button role="menuitem" onClick={() => { setOpen(false); onViewCustomers('Due soon'); }}><span className="notification-count notification-count-soon">{dueSoonCount}</span><span><b>Due soon</b><small>Accounts coming up for payment</small></span><ChevronRight size={15} /></button>}
          {totalAlerts === 0 && <p className="notification-empty">You’re all caught up. No account reminders right now.</p>}
        </div>
      )}
    </div>
  );
}

function DateRangeMenu({ value, onChange, className = '' }) {
  const ranges = ['Last 7 days', 'Last 30 days', 'Last 90 days'];
  return (
    <ActionMenu
      className={className}
      buttonClassName="button button-secondary"
      label={<>{value}<ChevronDown size={14} /></>}
      ariaLabel={`Date range: ${value}`}
      items={ranges.map((range) => ({ label: range, onSelect: () => onChange(range) }))}
    />
  );
}

function Sidebar({ active, customerCount, storeName, userProfile, onChange, onOpenHelp, onOpenSettings, onEditProfile, onLogout, mobileOpen, onClose }) {
  return (
    <>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); onChange('Overview'); onClose(); }}>
          <span className="brand-mark"><Store size={20} strokeWidth={2.3} /></span>
          <span className="brand-name">kindred<span>.</span></span>
        </a>
        <ActionMenu
          className="workspace-menu"
          buttonClassName="workspace-switcher"
          ariaLabel="Workspace options"
          label={<><span className="shop-avatar"><Store size={17} /></span><span className="workspace-copy"><strong>{storeName}</strong><small>Retail workspace</small></span><ChevronDown size={15} className="muted-icon" /></>}
          items={[
            { label: 'Manage store settings', onSelect: () => { onOpenSettings(); onClose(); } },
            { label: 'View customers', onSelect: () => { onChange('Customers'); onClose(); } },
            { label: 'Help & support', onSelect: () => { onOpenHelp(); onClose(); } },
          ]}
        />
        <span className="nav-caption">WORKSPACE</span>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link${active === label ? ' active' : ''}`} onClick={() => { onChange(label); onClose(); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Customers' && <span className="nav-count">{customerCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <span className="plan-icon"><Sparkles size={15} /></span>
            <strong>Make more room.</strong>
            <p>Unlock unlimited customers and smart reminders.</p>
            <button onClick={() => onChange('Settings')}>Explore plans <ArrowRight size={14} /></button>
            <span className="plan-decoration plan-decoration-one" /><span className="plan-decoration plan-decoration-two" />
          </div>
            <button className="nav-link" onClick={onOpenHelp}><CircleHelp size={18} />
              <span>Help & support</span>
            </button>
            <button className={`nav-link${active === 'Settings' ? ' active' : ''}`} onClick={onOpenSettings}><Settings size={18} />
              <span>Settings</span>
            </button>
          <div className="user-profile">
            <span className="profile-avatar">{getInitials(userProfile.name)}</span>
            <span className="profile-copy">
              <strong>{userProfile.name}</strong>
              <small title={userProfile.email}>{userProfile.email}</small>
            </span>
            <ActionMenu
              className="profile-menu-wrap"
              buttonClassName="icon-button profile-more"
              ariaLabel="Account menu"
              icon={Ellipsis}
              items={[
                { label: 'Edit profile', onSelect: onEditProfile },
                { label: 'Store settings', onSelect: onOpenSettings },
                { label: 'Help & support', onSelect: onOpenHelp },
                { label: 'Sign out', onSelect: onLogout },
              ]}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

function MetricCard({ title, value, change, direction, caption, accent, onViewCustomers, onViewTransactions }) {
  const relatedPage = title.toLowerCase().includes('credit') || title.toLowerCase().includes('collect') ? onViewTransactions : onViewCustomers;
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{title}</span>
        <ActionMenu
          className="metric-menu-wrap"
          buttonClassName="metric-more"
          ariaLabel={`More ${title} options`}
          icon={Ellipsis}
          items={[{ label: title.toLowerCase().includes('credit') || title.toLowerCase().includes('collect') ? 'View transactions' : 'View customers', onSelect: relatedPage }]}
        />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottom">
        {change && <span className={`change-pill ${direction}`}><ArrowUpRight size={13} />{change}</span>}
        <span>{caption}</span>
      </div>
      <span className={`metric-accent ${accent}`} />
    </article>
  );
}

function transactionsForRange(transactions, dateRange) {
  const days = Number(dateRange.match(/\d+/)?.[0]) || 30;
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);
  return transactions.filter((transaction) => {
    const date = new Date(transaction.dateISO || transaction.date);
    return Number.isFinite(date.getTime()) && date >= start && date <= today;
  });
}

function CreditChart({ transactions, dateRange }) {
  const money = useMoney();
  const days = Number(dateRange.match(/\d+/)?.[0]) || 30;
  const bucketCount = Math.min(days, 30);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);
  const buckets = Array.from({ length: bucketCount }, () => ({ issued: 0, collected: 0 }));
  transactionsForRange(transactions, dateRange).forEach((transaction) => {
    const date = new Date(transaction.dateISO || transaction.date);
    const elapsedDays = Math.floor((date - start) / 86400000);
    const index = Math.min(bucketCount - 1, Math.floor((elapsedDays / days) * bucketCount));
    if (index < 0) return;
    buckets[index][transaction.type === 'Payment received' ? 'collected' : 'issued'] += transaction.amount;
  });
  const max = Math.max(1, ...buckets.map((bucket) => bucket.issued + bucket.collected));
  const yStep = Math.ceil(max / 4 / 100) * 100 || 100;
  const yMaximum = yStep * 4;
  const yLabels = [4, 3, 2, 1, 0].map((step) => money(yStep * step));
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + Math.round((days - 1) * index / 6));
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  });
  return (
    <div className="chart-plot" aria-label={`Credit activity over ${dateRange.toLowerCase()}`}>
      <div className="chart-y-labels">{yLabels.map((label, index) => <span key={index}>{label}</span>)}</div>
      <div className="chart-area">
        <div className="chart-grid"><i /><i /><i /><i /><i /></div>
        <div className="bar-chart">{buckets.map((bucket, index) => (
          <span className="chart-bar-group" key={index}>
            <span className="chart-bar" title={`Issued ${money(bucket.issued)}`} style={{ height: `${bucket.issued / yMaximum * 100}%` }} />
            <span className="chart-bar-collected" title={`Collected ${money(bucket.collected)}`} style={{ height: `${bucket.collected / yMaximum * 100}%` }} />
          </span>
        ))}</div>
        {!transactionsForRange(transactions, dateRange).length && <div className="chart-empty">No credit activity in this period yet.</div>}
        <div className="chart-x-labels">{dates.map((date, index) => <span key={index}>{date}</span>)}</div>
      </div>
    </div>
  );
}

function CustomerTable({ customers, onSelect, onViewAll, onPayment, onDeleteCustomer, compact = false, selectedStatus, setSelectedStatus }) {
  const money = useMoney();
  const [page, setPage] = useState(0);
  const pageSize = 5;
  const visibleCustomers = customers.filter((customer) => selectedStatus === 'All' || customer.status === selectedStatus);
  const pageCount = Math.max(1, Math.ceil(visibleCustomers.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageCustomers = visibleCustomers.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return (
    <section className={`panel customer-panel${compact ? ' compact-table' : ''}`}>
      <div className="panel-heading">
        <div><h2>{compact ? 'Recent customers' : 'All customers'}</h2><p>{compact ? 'A little snapshot of your regulars.' : 'Keep track of every customer and their balance.'}</p></div>
        <div className="panel-actions">
          <StatusFilter selectedStatus={selectedStatus} onChange={setSelectedStatus} />
          {compact && <button className="button button-secondary button-view-all" onClick={onViewAll}>View all <ArrowRight size={15} /></button>}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Customer</th><th>Outstanding</th><th>Status</th><th>Due date</th><th className="table-end">Orders</th><th /></tr></thead>
          <tbody>
            {pageCustomers.length ? pageCustomers.map((customer) => (
              <tr key={customer.email} onClick={() => onSelect(customer)}>
                <td><div className="customer-cell"><Avatar person={customer} /><span className="customer-copy"><strong>{customer.name}</strong><small>{customer.email}</small></span></div></td>
                <td className="amount-cell">{money(customer.balance)}</td>
                <td><Status status={customer.status} /></td><td className="date-cell">{customer.due}</td>
                <td className="table-end order-cell">{customer.orders}</td><td onClick={(event) => event.stopPropagation()}><ActionMenu className="row-menu-wrap" buttonClassName="row-more" ariaLabel={`More options for ${customer.name}`} icon={Ellipsis} items={[{ label: 'View customer details', onSelect: () => onSelect(customer) }, ...(customer.balance > 0 && onPayment ? [{ label: 'Record a payment', onSelect: () => onPayment(customer) }] : []), ...(onDeleteCustomer ? [{ label: 'Delete customer', onSelect: () => onDeleteCustomer(customer) }] : [])]} /></td>
              </tr>
            )) : <tr><td colSpan="6" className="empty-state"><span className="empty-icon"><Search size={19} /></span><strong>No customers found</strong><span>Try changing your search or filters.</span></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span>Showing <strong>{visibleCustomers.length === 0 ? 0 : currentPage * pageSize + 1}</strong>–<strong>{Math.min((currentPage + 1) * pageSize, visibleCustomers.length)}</strong> of <strong>{visibleCustomers.length}</strong> customers</span><div className="pagination"><button aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><button aria-label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div>
    </section>
  );
}

function TransactionList({ transactions, onViewAll, onExport }) {
  const money = useMoney();
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div><h2>Recent activity</h2><p>The latest ins and outs.</p></div>
        <ActionMenu className="activity-menu-wrap" buttonClassName="icon-button activity-menu" ariaLabel="More activity options" icon={Ellipsis} items={[{ label: 'View all transactions', onSelect: onViewAll }, { label: 'Print activity', onSelect: onExport }]} />
      </div>
      <div className="activity-list">
        {transactions.slice(0, 4).map((transaction, index) => (
          <div className="activity-row" key={`${transaction.customer}-${transaction.date}-${index}`}>
            <span className={`activity-icon ${transaction.type === 'Payment received' ? 'activity-paid' : 'activity-credit'}`}>{transaction.type === 'Payment received' ? <ArrowDownLeft size={17} /> : <CreditCard size={16} />}</span>
            <Avatar person={transaction} small />
            <span className="activity-copy"><strong>{transaction.customer}</strong><small>{transaction.type} · {transaction.date}</small></span>
            <span className={`activity-amount ${transaction.type === 'Payment received' ? 'positive' : ''}`}>{transaction.type === 'Payment received' ? '+' : '−'}{money(transaction.amount)}</span>
          </div>
        ))}
        {!transactions.length && <div className="activity-empty">Your store activity will appear here when you record a credit or payment.</div>}
      </div>
      <button className="activity-footer" onClick={onViewAll}>See all activity <ArrowRight size={15} /></button>
    </section>
  );
}

function Overview({ customers, transactions, userProfile, onSelectCustomer, onPayment, onDeleteCustomer, onViewCustomers, onViewTransactions, selectedStatus, setSelectedStatus }) {
  const money = useMoney();
  const overdue = customers.filter((customer) => customer.status === 'Overdue').length;
  const outstanding = customers.reduce((total, customer) => total + customer.balance, 0);
  const issued = transactions.filter((transaction) => transaction.type === 'Credit issued').reduce((total, transaction) => total + transaction.amount, 0);
  const collected = transactions.filter((transaction) => transaction.type === 'Payment received').reduce((total, transaction) => total + transaction.amount, 0);
  const [dateRange, setDateRange] = useState('Last 30 days');
  const periodTransactions = transactionsForRange(transactions, dateRange);
  const periodIssued = periodTransactions.filter((transaction) => transaction.type === 'Credit issued').reduce((total, transaction) => total + transaction.amount, 0);
  return (
    <>
      <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" />{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()}</div><h1>Good morning, {userProfile.name.split(/\s+/)[0]} <span className="wave">✳</span></h1><p>Here's what's happening with your store today.</p></div><DateRangeMenu className="date-button" value={dateRange} onChange={setDateRange} /></div>
      <div className="metric-grid">
        <MetricCard title="Outstanding balance" value={money(outstanding)} caption={`Across ${customers.length} customer accounts`} accent="accent-lilac" onViewCustomers={onViewCustomers} onViewTransactions={onViewTransactions} />
        <MetricCard title="Credit issued" value={money(issued)} caption="Total recorded credit" accent="accent-green" onViewCustomers={onViewCustomers} onViewTransactions={onViewTransactions} />
        <MetricCard title="Collected" value={money(collected)} caption="Total recorded payments" accent="accent-peach" onViewCustomers={onViewCustomers} onViewTransactions={onViewTransactions} />
        <MetricCard title="Overdue accounts" value={String(overdue).padStart(2, '0')} caption="Need a little nudge" accent="accent-yellow" onViewCustomers={onViewCustomers} onViewTransactions={onViewTransactions} />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading chart-heading">
            <div><h2>Credit overview</h2><p>Issued and collected over {dateRange.toLowerCase()}.</p></div>
            <DateRangeMenu value={dateRange} onChange={setDateRange} />
          </div>
          <div className="chart-summary">
            <div><span className="summary-label">Credit issued in period</span><div className="summary-value">{money(periodIssued)}</div></div>
            <div className="chart-legend"><span><i className="legend-issued" />Issued</span><span><i className="legend-collected" />Collected</span></div>
          </div>
          <CreditChart transactions={transactions} dateRange={dateRange} />
        </section>
        <TransactionList transactions={transactions} onViewAll={onViewTransactions} onExport={() => window.print()} />
      </div>
      <CustomerTable customers={customers} onSelect={onSelectCustomer} onPayment={onPayment} onDeleteCustomer={onDeleteCustomer} onViewAll={onViewCustomers} compact selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus} />
    </>
  );
}

function CustomersPage({ customers, onSelectCustomer, onPayment, onDeleteCustomer, onAddCustomer, search, setSearch, selectedStatus, setSelectedStatus }) {
  const filtered = customers.filter((customer) => {
    const matchesSearch = `${customer.name} ${customer.email}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (selectedStatus === 'All' || customer.status === selectedStatus);
  });
  return (
    <>
      <div className="welcome-row page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" />YOUR COMMUNITY</div><h1>Customers</h1><p>All your regulars, in one happy place.</p></div><button className="button button-primary" onClick={onAddCustomer}><Plus size={16} />Add customer</button></div>
      <div className="mini-stat-grid">
        <div className="mini-stat"><span>Total customers</span><strong>{customers.length}</strong><small>In your customer list</small></div>
        <div className="mini-stat"><span>With outstanding balance</span><strong>{customers.filter((person) => person.balance > 0).length}</strong><small>of {customers.length} in your list</small></div>
        <div className="mini-stat"><span>Overdue accounts</span><strong>{customers.filter((person) => person.status === 'Overdue').length}</strong><small>Worth a friendly reminder</small></div>
      </div>
      <section className="panel customer-panel full-customer-panel">
        <div className="panel-heading">
          <div><h2>All customers <span className="heading-count">{filtered.length}</span></h2><p>A little more about the people who shop with you.</p></div>
          <div className="panel-actions">
            <label className="search-field"><Search size={16} /><input aria-label="Search customers" placeholder="Search customers..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>
            <StatusFilter selectedStatus={selectedStatus} onChange={setSelectedStatus} />
            <button className="button button-secondary export-button" onClick={() => window.print()}><Download size={15} />Export</button>
          </div>
        </div>
        <CustomerTable customers={filtered} onSelect={onSelectCustomer} onPayment={onPayment} onDeleteCustomer={onDeleteCustomer} onViewAll={() => {}} selectedStatus="All" setSelectedStatus={setSelectedStatus} />
      </section>
    </>
  );
}

function TransactionsPage({ transactions, search, setSearch }) {
  const money = useMoney();
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const newestDate = Math.max(...transactions.map((transaction) => new Date(transaction.date).getTime()).filter(Number.isFinite));
  const rangeDays = Number(dateRange.match(/\d+/)?.[0]) || Infinity;
  const filtered = transactions.filter((transaction) => {
    const date = new Date(transaction.date).getTime();
    const inRange = Number.isFinite(date) && newestDate - date <= rangeDays * 24 * 60 * 60 * 1000;
    return inRange && transaction.customer.toLowerCase().includes(search.toLowerCase());
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageTransactions = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return (
    <>
      <div className="welcome-row page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" />THE PAPER TRAIL</div><h1>Transactions</h1><p>Every credit and payment, right where you need it.</p></div><button className="button button-secondary" onClick={() => window.print()}><Download size={16} />Export activity</button></div>
      <div className="mini-stat-grid">
        <div className="mini-stat"><span>Transactions recorded</span><strong>{transactions.length}</strong><small>In your store ledger</small></div>
        <div className="mini-stat"><span>Credit issued</span><strong>{money(transactions.filter((item) => item.type === 'Credit issued').reduce((total, item) => total + item.amount, 0))}</strong><small>Across recorded credit entries</small></div>
        <div className="mini-stat"><span>Payments received</span><strong>{money(transactions.filter((item) => item.type === 'Payment received').reduce((total, item) => total + item.amount, 0))}</strong><small>Across recorded payments</small></div>
      </div>
      <section className="panel customer-panel transaction-table-panel">
        <div className="panel-heading">
          <div><h2>All activity <span className="heading-count">{filtered.length}</span></h2><p>A complete record of your store credit activity.</p></div>
          <div className="panel-actions"><label className="search-field"><Search size={16} /><input aria-label="Search transactions" placeholder="Search activity..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label><DateRangeMenu value={dateRange} onChange={(range) => { setDateRange(range); setPage(0); }} /></div>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Activity</th><th>Date</th><th>Method</th><th className="table-end">Amount</th></tr></thead><tbody>{pageTransactions.map((transaction, index) => <tr key={`${transaction.customer}-${transaction.date}-${index}`}><td><div className="customer-cell"><Avatar person={transaction} /><span className="customer-copy"><strong>{transaction.customer}</strong><small>Store account</small></span></div></td><td><span className={`transaction-type ${transaction.type === 'Payment received' ? 'type-payment' : 'type-credit'}`}>{transaction.type === 'Payment received' ? <ArrowDownLeft size={14} /> : <CreditCard size={14} />}{transaction.type}</span></td><td className="date-cell">{transaction.date}</td><td className="date-cell">{transaction.method}</td><td className={`table-end amount-cell ${transaction.type === 'Payment received' ? 'positive' : ''}`}>{transaction.type === 'Payment received' ? '+' : '−'}{money(transaction.amount)}</td></tr>)}</tbody></table>{!filtered.length && <div className="simple-empty">No transactions match your search.</div>}</div>
        <div className="table-footer"><span>Showing <strong>{filtered.length === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> transactions</span><div className="pagination"><button aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><button aria-label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div>
      </section>
    </>
  );
}

function ReportsPage({ customers, transactions, selectedStatus, setSelectedStatus, onSelectCustomer, onPayment, onDeleteCustomer, onViewCustomers, onViewTransactions }) {
  const money = useMoney();
  const totalOwed = customers.reduce((total, customer) => total + customer.balance, 0);
  const [dateRange, setDateRange] = useState('Last 30 days');
  const periodTransactions = transactionsForRange(transactions, dateRange);
  const periodIssued = periodTransactions.filter((transaction) => transaction.type === 'Credit issued').reduce((total, transaction) => total + transaction.amount, 0);
  const periodCollected = periodTransactions.filter((transaction) => transaction.type === 'Payment received').reduce((total, transaction) => total + transaction.amount, 0);
  const totalCollected = transactions.filter((transaction) => transaction.type === 'Payment received').reduce((total, transaction) => total + transaction.amount, 0);
  const collectionRate = totalCollected + totalOwed > 0 ? Math.round(totalCollected / (totalCollected + totalOwed) * 100) : 0;
  return (
    <>
      <div className="welcome-row page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" />THE BIG PICTURE</div><h1>Your reports</h1><p>A clearer picture of the good things happening in your store.</p></div><DateRangeMenu value={dateRange} onChange={setDateRange} /></div>
      <div className="metric-grid">
        <MetricCard title="Total outstanding" value={money(totalOwed)} caption="Across all customer accounts" accent="accent-lilac" onViewCustomers={onViewCustomers} onViewTransactions={onViewTransactions} />
        <MetricCard title="Collected in period" value={money(periodCollected)} caption={`Over ${dateRange.toLowerCase()}`} accent="accent-green" onViewCustomers={onViewCustomers} onViewTransactions={onViewTransactions} />
        <MetricCard title="Average account balance" value={money(customers.length ? totalOwed / customers.length : 0)} caption={`Across ${customers.length} customers`} accent="accent-peach" onViewCustomers={onViewCustomers} onViewTransactions={onViewTransactions} />
        <MetricCard title="Collection rate" value={`${collectionRate}%`} caption="Payments received vs. collected and owed" accent="accent-yellow" onViewCustomers={onViewCustomers} onViewTransactions={onViewTransactions} />
      </div>
      <section className="panel chart-panel reports-chart"><div className="panel-heading"><div><h2>Credit over time</h2><p>Store credit activity over {dateRange.toLowerCase()}.</p></div></div><div className="chart-summary"><div><span className="summary-label">Credit issued in period</span><div className="summary-value">{money(periodIssued)}</div></div><div className="chart-legend"><span><i className="legend-issued" />Issued</span><span><i className="legend-collected" />Collected</span></div></div><CreditChart transactions={transactions} dateRange={dateRange} /></section>
      <CustomerTable customers={[...customers].sort((a, b) => b.balance - a.balance)} onSelect={onSelectCustomer} onPayment={onPayment} onDeleteCustomer={onDeleteCustomer} onViewAll={onViewCustomers} compact selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus} />
    </>
  );
}

function SettingsPage({ settings, onSave, onAppearanceChange }) {
  const [form, setForm] = useState(settings);
  const [error, setError] = useState('');
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  }
  function updateAppearance(field, value) {
    update(field, value);
    onAppearanceChange(field, value, setError);
  }
  async function submit(event) {
    event.preventDefault();
    if (!form.storeName.trim() || !form.email.trim()) {
      setError('Store name and email address are required.');
      return;
    }
    onSave({ ...form, storeName: form.storeName.trim(), email: form.email.trim() }, setError);
  }
  return (
    <>
      <div className="welcome-row page-title-row"><div><div className="eyebrow"><span className="eyebrow-dot" />MAKE IT YOURS</div><h1>Settings</h1><p>A few little details about your store.</p></div></div>
      <form className="panel settings-panel" onSubmit={submit}>
        <div className="settings-section">
          <span className="settings-icon settings-icon-appearance"><Sparkles size={19} /></span>
          <div className="settings-content">
            <h2>Appearance</h2><p>Make Kindred feel comfortable on this device.</p>
            <label>Theme<select value={form.theme} onChange={(event) => updateAppearance('theme', event.target.value)}><option value="system">Use device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
            <label>Accent color<select value={form.accent} onChange={(event) => updateAppearance('accent', event.target.value)}><option value="violet">Kindred violet</option><option value="ocean">Ocean blue</option><option value="forest">Forest green</option></select></label>
          </div>
        </div>
        <div className="settings-section">
          <span className="settings-icon"><Store size={19} /></span>
          <div className="settings-content">
            <h2>Store details</h2><p>Update your shop's name, contact information, and currency.</p>
            <label>Store name<input required value={form.storeName} onChange={(event) => update('storeName', event.target.value)} /></label>
            <label>Email address<input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
            <label>Store currency<select value={form.currency} onChange={(event) => update('currency', event.target.value)}><option value="USD">USD — US Dollar ($)</option><option value="GBP">GBP — British Pound (£)</option><option value="EUR">EUR — Euro (€)</option></select></label>
          </div>
        </div>
        <div className="settings-section">
          <span className="settings-icon settings-icon-green"><Bell size={19} /></span>
          <div className="settings-content">
            <h2>Friendly reminders</h2><p>Choose when and how often you’d like to be reminded.</p>
            <label>Reminder preference<select value={form.reminderDays} onChange={(event) => update('reminderDays', Number(event.target.value))}><option value="1">1 day overdue</option><option value="3">3 days overdue</option><option value="7">7 days overdue</option></select></label>
            <div className="toggle-setting"><span><strong>Overdue reminders</strong><small>Show a reminder preference for overdue accounts.</small></span><input type="checkbox" checked={form.overdueReminders} onChange={(event) => update('overdueReminders', event.target.checked)} aria-label="Enable overdue reminders" /></div>
            <div className="toggle-setting"><span><strong>Weekly store summary</strong><small>Receive a Monday morning snapshot of your store.</small></span><input type="checkbox" checked={form.weeklySummary} onChange={(event) => update('weeklySummary', event.target.checked)} aria-label="Enable weekly store summary" /></div>
          </div>
        </div>
        {error && <p className="settings-error" role="alert">{error}</p>}
        <div className="settings-save-row"><span>Your preferences are saved to your store database.</span><button className="button button-primary" type="submit">Save changes</button></div>
      </form>
    </>
  );
}

function CustomerModal({ customer, onClose, onPayment, onDeleteCustomer }) {
  const money = useMoney();
  if (!customer) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
        <button className="modal-close" aria-label="Close customer details" onClick={onClose}><X size={19} /></button>
        <div className="modal-profile"><Avatar person={customer} /><span className="customer-copy"><strong>{customer.name}</strong><small>{customer.email}</small></span></div>
        <span className="modal-kicker">CUSTOMER ACCOUNT</span><h2 id="customer-modal-title">{money(customer.balance)} <span>outstanding</span></h2><Status status={customer.status} />
        <div className="modal-details"><div><span>Due date</span><strong>{customer.due}</strong></div><div><span>Total spent</span><strong>{money(customer.spent)}</strong></div><div><span>Orders</span><strong>{customer.orders}</strong></div><div><span>Phone</span><strong>{customer.phone}</strong></div>{customer.wantedItems && <div className="customer-interest"><span>Interested in</span><strong>{customer.wantedItems}</strong></div>}</div>
        <div className="modal-actions"><button className="button button-secondary button-danger-outline" onClick={() => onDeleteCustomer(customer)}>Delete customer</button><button className="button button-secondary" onClick={onClose}>Close</button><button className="button button-primary" disabled={customer.balance <= 0} onClick={() => onPayment(customer)}><Plus size={16} />Record payment</button></div>
      </section>
    </div>
  );
}

function DeleteCustomerModal({ customer, onClose, onConfirm }) {
  const money = useMoney();
  if (!customer) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="customer-modal delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-customer-title">
        <button className="modal-close" aria-label="Cancel customer deletion" onClick={onClose}><X size={19} /></button>
        <span className="delete-icon"><X size={19} /></span>
        <span className="modal-kicker">PLEASE CONFIRM</span>
        <h2 id="delete-customer-title">Delete {customer.name}?</h2>
        <p className="form-intro">This permanently removes their customer account and transaction history from this app. This can’t be undone.</p>
        {customer.balance > 0 && <p className="delete-warning">They still have an outstanding balance of {money(customer.balance)}. Make sure you’ve recorded anything you need before deleting.</p>}
        <div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Keep customer</button><button className="button button-danger" onClick={() => onConfirm(customer)}>Delete permanently</button></div>
      </section>
    </div>
  );
}

function HelpModal({ onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="customer-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
        <button className="modal-close" aria-label="Close help and support" onClick={onClose}><X size={19} /></button>
        <span className="help-modal-icon"><LifeBuoy size={20} /></span>
        <span className="modal-kicker">WE’RE HERE FOR YOU</span>
        <h2 id="help-modal-title">Help & support</h2>
        <p className="form-intro">A few quick answers to help you get back to your store.</p>
        <div className="help-topics">
          <details>
            <summary>How do I add a customer?</summary>
            <p>Open <strong>Customers</strong>, choose <strong>Add customer</strong>, and enter their name and email. You can add an opening balance too.</p>
          </details>
          <details>
            <summary>How do I record a payment?</summary>
            <p>Open a customer’s account, choose <strong>Record payment</strong>, enter the amount and payment method, then save it. Their balance and activity update together.</p>
          </details>
          <details>
            <summary>Where can I find overdue accounts?</summary>
            <p>Use the customer status filter and select <strong>Overdue</strong>. The dashboard also shows your overdue account count.</p>
          </details>
        </div>
        <div className="help-contact">
          <span><strong>Still need a hand?</strong><small>Send our team an email and we’ll help you out.</small></span>
          <a className="button button-primary" href="mailto:hello@kindred.app?subject=Kindred%20support">Email support</a>
        </div>
        <div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function AddCustomerModal({ onClose, onAdd, existingEmails }) {
  const currencySymbol = useCurrencySymbol();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState('');
  const [wantedItems, setWantedItems] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [orders, setOrders] = useState('0');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) { setError('Add a name and email address to continue.'); return; }
    if (existingEmails.some((existingEmail) => existingEmail.toLowerCase() === email.trim().toLowerCase())) { setError('A customer with this email address is already on your list.'); return; }
    const orderCount = Number(orders);
    if (!Number.isSafeInteger(orderCount) || orderCount < 0) { setError('Orders must be a whole number of zero or more.'); return; }
    const openingBalance = balance.trim() === '' ? 0 : Number(balance);
    if (!Number.isFinite(openingBalance) || openingBalance < 0 || Math.abs(Math.round(openingBalance * 100) - openingBalance * 100) > 1e-8) { setError('Enter a valid opening balance of zero or more, with up to two decimal places.'); return; }
    try {
      await onAdd({ name: name.trim(), email: email.trim(), phone: phone.trim() || '—', balance: openingBalance, wantedItems: wantedItems.trim(), dueOn: dueDate, orders: orderCount });
    } catch (submitError) {
      setError(submitError.message || 'We couldn’t add this customer. Please try again.');
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="customer-modal form-modal" role="dialog" aria-modal="true" aria-labelledby="add-customer-title">
        <button className="modal-close" aria-label="Close form" onClick={onClose}><X size={19} /></button>
        <span className="modal-kicker">A NEW FRIEND</span>
        <h2 id="add-customer-title">Add a customer</h2>
        <p className="form-intro">Add someone to your community and start keeping track.</p>
        <form onSubmit={submit}>
          <label>Full name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" /></label>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@example.com" /></label>
          <label>Phone number <span className="optional-label">Optional</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 (555) 000-0000" /></label>
          <label>What are they looking for? <span className="optional-label">Optional</span><textarea value={wantedItems} onChange={(event) => setWantedItems(event.target.value)} placeholder="e.g. blue school bag, size medium" rows="3" /></label>
          <label>Due date <span className="optional-label">Optional</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <label>Orders<input type="number" min="0" step="1" value={orders} onChange={(event) => setOrders(event.target.value)} /></label>
          <label>Opening balance <span className="optional-label">Optional</span><div className="currency-input"><span>{currencySymbol}</span><input aria-label="Opening balance" type="number" min="0" step="0.01" value={balance} onChange={(event) => { setBalance(event.target.value); setError(''); }} placeholder="0.00" /></div><small className="field-hint">Existing amount they owe. This is added to their balance and transaction history.</small></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Plus size={16} />Add customer</button></div>
        </form>
      </section>
    </div>
  );
}

function PaymentModal({ customer, onClose, onSubmit }) {
  const money = useMoney();
  const currencySymbol = useCurrencySymbol();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [error, setError] = useState('');
  if (!customer) return null;
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="customer-modal form-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"><button className="modal-close" aria-label="Close form" onClick={onClose}><X size={19} /></button><span className="modal-kicker">LOOK AT YOU, PAYING IT FORWARD</span><h2 id="payment-modal-title">Record a payment</h2><p className="form-intro">For <strong>{customer.name}</strong> · Balance {money(customer.balance)}</p><form onSubmit={async (event) => { event.preventDefault(); const parsedAmount = Number(amount); if (parsedAmount <= 0) { setError('Enter a payment amount greater than zero.'); return; } if (parsedAmount > customer.balance) { setError(`The payment cannot be more than the outstanding balance of ${money(customer.balance)}.`); return; } try { await onSubmit(parsedAmount, method); } catch (submitError) { setError(submitError.message || 'We couldn’t record the payment. Please try again.'); } }}><label>Payment amount<div className="currency-input"><span>{currencySymbol}</span><input type="number" min="0.01" max={customer.balance} step="0.01" required value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} placeholder="0.00" /></div></label><button type="button" className="fill-balance" onClick={() => { setAmount(String(customer.balance)); setError(''); }}>Pay full balance ({money(customer.balance)})</button><label>Payment method<select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Check size={16} />Save payment</button></div></form></section></div>;
}

function ProfileModal({ profile, onClose, onSave }) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Enter your name and email address.');
      return;
    }
    onSave({ name: name.trim(), email: email.trim() }, setError);
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="customer-modal form-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <button className="modal-close" aria-label="Close profile editor" onClick={onClose}><X size={19} /></button>
        <span className="modal-kicker">YOUR ACCOUNT</span>
        <h2 id="profile-modal-title">Edit profile</h2>
        <p className="form-intro">Update the name and email shown in your store workspace.</p>
        <form onSubmit={submit}>
          <label>Full name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Check size={16} />Save profile</button></div>
        </form>
      </section>
    </div>
  );
}

function DemoLoginScreen({ profile, onSignIn, onSignUp }) {
  const [mode, setMode] = useState('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'signUp';

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password || (signingUp && !name.trim())) {
      setError(signingUp ? 'Complete your name, email, and password to continue.' : 'Enter your email and password to continue.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (signingUp && password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (password.length > 128) {
      setError('Passwords must be 128 characters or fewer.');
      return;
    }
    if (signingUp && password !== confirmPassword) {
      setError('Those passwords don’t match. Check them and try again.');
      return;
    }
    setBusy(true);
    try {
      if (signingUp) await onSignUp({ name: name.trim(), email: email.trim(), password });
      else await onSignIn({ email: email.trim(), password });
    } catch (submitError) {
      setError(submitError.message || 'We couldn’t complete that request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  }

  function passwordInput(label, value, setValue, visible, setVisible, autoComplete) {
    return (
      <label className="auth-password-label">{label}
        <span className="auth-password-field">
          <LockKeyhole size={16} aria-hidden="true" />
          <input type={visible ? 'text' : 'password'} autoComplete={autoComplete} required value={value} onChange={(event) => setValue(event.target.value)} />
          <button className="password-visibility" type="button" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </span>
      </label>
    );
  }

  return (
    <main className="login-screen">
      <div className="login-layout">
        <section className="login-story">
          <span className="login-brand"><span className="brand-mark"><Store size={20} /></span><span className="brand-name">kindred<span>.</span></span></span>
          <div><span className="login-story-kicker">MADE FOR YOUR NEIGHBORHOOD</span><h1>A little closer to your community.</h1><p>Keep customer credit, payments, and the people behind them in one calm place.</p></div>
          <span className="login-story-foot">Your store, your community.</span>
        </section>
        <section className="login-card" aria-labelledby="auth-title">
          <span className="login-mobile-brand"><span className="brand-mark"><Store size={20} /></span><span className="brand-name">kindred<span>.</span></span></span>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={!signingUp} className={!signingUp ? 'active' : ''} onClick={() => changeMode('signIn')}>Sign in</button>
            <button type="button" role="tab" aria-selected={signingUp} className={signingUp ? 'active' : ''} onClick={() => changeMode('signUp')}>Create account</button>
          </div>
          <span className="modal-kicker">{signingUp ? 'GET STARTED' : 'WELCOME BACK'}</span>
          <h2 id="auth-title">{signingUp ? 'Create your account' : 'Sign in to Kindred'}</h2>
          <p className="form-intro">{signingUp ? 'Set up your owner profile to get started with your store.' : `Welcome back${profile.name ? `, ${profile.name}` : ''}. Sign in to continue.`}</p>
          <form onSubmit={submit} noValidate>
            {signingUp && <label>Full name<input autoComplete="name" autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Jamie Davis" /></label>}
            <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourstore.com" /></label>
            {passwordInput('Password', password, setPassword, showPassword, setShowPassword, signingUp ? 'new-password' : 'current-password')}
            {signingUp && passwordInput('Confirm password', confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword, 'new-password')}
            {signingUp && <p className="auth-hint">Use at least 8 characters. Your password is stored only as a salted hash on this device.</p>}
            {error && <p className="form-error auth-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary login-submit" disabled={busy}>{busy ? <span className="auth-spinner" aria-hidden="true" /> : signingUp ? <UserPlus size={16} /> : <LogIn size={16} />}{busy ? (signingUp ? 'Creating account…' : 'Signing in…') : (signingUp ? 'Create account' : 'Sign in')}</button>
          </form>
          <p className="auth-switch">{signingUp ? 'Already have an account?' : 'New to Kindred?'} <button type="button" onClick={() => changeMode(signingUp ? 'signIn' : 'signUp')}>{signingUp ? 'Sign in' : 'Create an account'}</button></p>
          <p className="demo-auth-note">Your account and store data are saved by the local Kindred server. This development setup is not hosted online; password recovery is not configured.</p>
        </section>
      </div>
    </main>
  );
}

function BackendStatusScreen({ error, onRetry }) {
  return (
    <main className="login-screen">
      <section className="login-card backend-status" role="alert">
        <span className="login-brand"><span className="brand-mark"><Store size={20} /></span><span className="brand-name">kindred<span>.</span></span></span>
        <span className="modal-kicker">LOCAL SERVER</span>
        <h2>Can’t reach your store data</h2>
        <p className="form-intro">{error || 'Connecting to the Kindred server…'}</p>
        <button className="button button-primary login-submit" onClick={onRetry}>Try again</button>
        <p className="demo-auth-note">Start the app with <code>npm run dev</code> so the database server is running alongside the website.</p>
      </section>
    </main>
  );
}

function App() {
  const [storeSettings, setStoreSettings] = useState(defaultStoreSettings);
  const [userProfile, setUserProfile] = useState(defaultUserProfile);
  const [signedIn, setSignedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [backendError, setBackendError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [active, setActive] = useState('Overview');
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolvedTheme = storeSettings?.theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : (storeSettings?.theme || 'light');

  function applyBootstrap(data) {
    if (!data || !data.user || !data.settings || !Array.isArray(data.customers) || !Array.isArray(data.transactions)) {
      throw new Error('The server returned incomplete store data. Check the backend and try again.');
    }
    const settings = { ...defaultStoreSettings, ...data.settings };
    if (
      typeof settings.storeName !== 'string'
      || typeof settings.email !== 'string'
      || !['USD', 'GBP', 'EUR'].includes(settings.currency)
      || ![1, 3, 7].includes(settings.reminderDays)
      || typeof settings.overdueReminders !== 'boolean'
      || typeof settings.weeklySummary !== 'boolean'
      || !['light', 'dark', 'system'].includes(settings.theme)
      || !['violet', 'ocean', 'forest'].includes(settings.accent)
    ) {
      throw new Error('The server returned invalid store settings. Check the backend data and try again.');
    }
    setStoreSettings(settings);
    setUserProfile(data.user);
    setCustomers(data.customers);
    setTransactions(data.transactions);
    setBackendError('');
  }

  async function restoreSession() {
    setAuthLoading(true);
    try {
      const data = await apiRequest('/api/bootstrap');
      applyBootstrap(data);
      setSignedIn(true);
    } catch (error) {
      if (error.status === 401) {
        setSignedIn(false);
        setBackendError('');
      } else {
        setBackendError(error.message || 'The local database server could not be reached.');
      }
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const updatePreference = (event) => setSystemPrefersDark(event.matches);
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/bootstrap').then((data) => {
      if (cancelled) return;
      applyBootstrap(data);
      setSignedIn(true);
    }).catch((error) => {
      if (cancelled) return;
      if (error.status === 401) {
        setSignedIn(false);
        setBackendError('');
      } else {
        setBackendError(error.message || 'The local database server could not be reached.');
      }
    }).finally(() => {
      if (!cancelled) setAuthLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  }
  async function saveStoreSettings(settings, setError) {
    try {
      const data = await apiRequest('/api/settings', { method: 'PUT', body: settings });
      applyBootstrap(data);
      notify('Your store settings have been saved.');
    } catch (error) {
      setError(error.message || 'We couldn’t save your settings.');
    }
  }
  async function saveAppearancePreference(field, value, setError) {
    const nextSettings = { ...storeSettings, [field]: value };
    try {
      const data = await apiRequest('/api/settings', { method: 'PUT', body: nextSettings });
      applyBootstrap(data);
    } catch (error) {
      setError(error.message || 'We couldn’t save your appearance preference.');
    }
  }
  async function saveUserProfile(profile, setError) {
    try {
      const data = await apiRequest('/api/profile', { method: 'PUT', body: profile });
      applyBootstrap(data);
      setProfileOpen(false);
      notify('Your profile has been updated.');
    } catch (error) {
      setError(error.message || 'We couldn’t save your profile.');
    }
  }
  async function signOut() {
    try {
      await apiRequest('/api/auth/sign-out', { method: 'POST' });
    } catch (error) {
      notify(error.message || 'We couldn’t sign you out. Please try again.');
      return;
    }
    setProfileOpen(false);
    setHelpOpen(false);
    setAddOpen(false);
    setSelectedCustomer(null);
    setPaymentCustomer(null);
    setCustomerToDelete(null);
    setSignedIn(false);
  }
  async function signIn(credentials) {
    const data = await apiRequest('/api/auth/sign-in', { method: 'POST', body: credentials });
    applyBootstrap(data);
    setSignedIn(true);
  }
  async function signUp(details) {
    const data = await apiRequest('/api/auth/sign-up', { method: 'POST', body: details });
    applyBootstrap(data);
    setSignedIn(true);
  }
  async function addCustomer(form) {
    const data = await apiRequest('/api/customers', { method: 'POST', body: form });
    applyBootstrap(data);
    setAddOpen(false);
    setSearch('');
    setActive('Customers');
    notify(`${form.name} is now part of your community.`);
  }
  async function deleteCustomer(customer) {
    try {
      const data = await apiRequest(`/api/customers/${encodeURIComponent(customer.id)}`, { method: 'DELETE' });
      applyBootstrap(data);
      setCustomerToDelete(null);
      setSelectedCustomer((current) => current?.id === customer.id ? null : current);
      notify(`${customer.name} and their transaction history were deleted.`);
    } catch (error) {
      notify(error.message || 'We couldn’t delete this customer.');
    }
  }
  async function recordPayment(amount, method) {
    const customer = paymentCustomer;
    const data = await apiRequest(`/api/customers/${encodeURIComponent(customer.id)}/payments`, { method: 'POST', body: { amount, method } });
    applyBootstrap(data);
    setPaymentCustomer(null);
    setSelectedCustomer(null);
    notify(`Payment of ${formatMoney(amount, storeSettings.currency)} recorded for ${customer.name}.`);
  }
  function switchPage(page) { setActive(page); setSearch(''); setGlobalSearch(''); setSelectedStatus('All'); }

  if (authLoading) return <BackendStatusScreen error="" onRetry={restoreSession} />;
  if (backendError) return <BackendStatusScreen error={backendError} onRetry={restoreSession} />;
  if (!signedIn) return <DemoLoginScreen profile={userProfile} onSignIn={signIn} onSignUp={signUp} />;

  return (
    <CurrencyContext.Provider value={storeSettings.currency}>
    <div className="app-shell" data-theme={resolvedTheme} data-accent={storeSettings.accent}>
      <Sidebar active={active} customerCount={customers.length} storeName={storeSettings.storeName} userProfile={userProfile} onChange={switchPage} onOpenHelp={() => setHelpOpen(true)} onOpenSettings={() => switchPage('Settings')} onEditProfile={() => setProfileOpen(true)} onLogout={signOut} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>{storeSettings.storeName}</span><ChevronRight size={14} /><strong>{active}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input aria-label="Search customers" placeholder="Search anything..." value={globalSearch} onChange={(event) => { setGlobalSearch(event.target.value); setSearch(event.target.value); if (event.target.value) setActive('Customers'); }} /><kbd>⌘ K</kbd></label>
            <span className="topbar-divider" />
            <NotificationMenu customers={customers} onViewCustomers={(status) => { setActive('Customers'); setSearch(''); setGlobalSearch(''); setSelectedStatus(status); }} />
            <ActionMenu
              className="header-account-menu"
              buttonClassName="account-button"
              ariaLabel="User account"
              icon={UserRound}
              items={[
                { label: 'Edit profile', onSelect: () => setProfileOpen(true) },
                { label: 'Store settings', onSelect: () => switchPage('Settings') },
                { label: 'Customer directory', onSelect: () => switchPage('Customers') },
                { label: 'Help & support', onSelect: () => setHelpOpen(true) },
                { label: 'Sign out', onSelect: signOut },
              ]}
            />
          </div>
        </header>
        <div className="page-content">
          {active === 'Overview' && <Overview customers={customers} transactions={transactions} userProfile={userProfile} onSelectCustomer={setSelectedCustomer} onPayment={setPaymentCustomer} onDeleteCustomer={setCustomerToDelete} onViewCustomers={() => switchPage('Customers')} onViewTransactions={() => switchPage('Transactions')} selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus} />}
          {active === 'Customers' && <CustomersPage customers={customers} onSelectCustomer={setSelectedCustomer} onPayment={setPaymentCustomer} onDeleteCustomer={setCustomerToDelete} onAddCustomer={() => setAddOpen(true)} search={search} setSearch={(value) => { setSearch(value); setGlobalSearch(value); }} selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus} />}
          {active === 'Transactions' && <TransactionsPage transactions={transactions} search={search} setSearch={(value) => { setSearch(value); setGlobalSearch(value); }} />}
          {active === 'Reports' && <ReportsPage customers={customers} transactions={transactions} selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus} onSelectCustomer={setSelectedCustomer} onPayment={setPaymentCustomer} onDeleteCustomer={setCustomerToDelete} onViewCustomers={() => switchPage('Customers')} onViewTransactions={() => switchPage('Transactions')} />}
          {active === 'Settings' && <SettingsPage settings={storeSettings} onSave={saveStoreSettings} onAppearanceChange={saveAppearancePreference} />}
          <footer className="app-footer"><span>Made for the neighborhood <span className="footer-heart">♥</span></span><span>Kindred © {new Date().getFullYear()} <i /> Your store, your community.</span></footer>
        </div>
      </main>
      <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} onPayment={(customer) => { setSelectedCustomer(null); setPaymentCustomer(customer); }} onDeleteCustomer={(customer) => { setSelectedCustomer(null); setCustomerToDelete(customer); }} />
      <DeleteCustomerModal customer={customerToDelete} onClose={() => setCustomerToDelete(null)} onConfirm={deleteCustomer} />
      {profileOpen && <ProfileModal profile={userProfile} onClose={() => setProfileOpen(false)} onSave={saveUserProfile} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {addOpen && <AddCustomerModal onClose={() => setAddOpen(false)} onAdd={addCustomer} existingEmails={customers.map((customer) => customer.email)} />}
      <PaymentModal customer={paymentCustomer} onClose={() => setPaymentCustomer(null)} onSubmit={recordPayment} />
      {toast && <div className="toast"><span><Check size={15} /></span>{toast}</div>}
    </div>
    </CurrencyContext.Provider>
  );
}

export default App;
