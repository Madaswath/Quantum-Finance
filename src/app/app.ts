import {ChangeDetectionStrategy, Component, signal, computed, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {DonutChartComponent} from './donut-chart';

export type AccountCategory = 'Savings' | 'Cash' | 'Card' | 'Investments' | 'Liabilities';

export interface Account {
  id: string;
  name: string;
  category: AccountCategory;
  type: string;
  startingBalance: number;
}

export interface Transaction {
  id: string;
  userId: string;
  period: string;
  accountSource: string;
  category: string;
  subcategory: string;
  note: string;
  amount: number;
  flowDirection: 'Income' | 'Exp.' | 'Transfer';
  transferTo?: 'Cash' | 'HDFC Card' | 'ICICI';
  receiptImage?: string;
  createdAt: string;
}

export interface Milestone {
  target: string;
  amount: number;
  timeline: string;
}

export interface Recommendation {
  title: string;
  impact: 'High' | 'Medium' | 'Low';
  financialBenefits: string;
  actionPlan: string;
}

export interface MilestoneViability {
  target: string;
  isViable: boolean;
  inflationAdjustedCost: number;
  shortfall: number;
  advice: string;
}

export interface ProjectionYear {
  year: number;
  estimatedAssets: number;
  estimatedLiabilities: number;
  netWorth: number;
}

export interface DiagnosticResponse {
  projectionYears: ProjectionYear[];
  milestoneViability: MilestoneViability[];
  recommendations: Recommendation[];
  inflationImpactNote: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  token: string;
  error?: string;
}

export interface ParsedSMSTransaction {
  account_source: 'Cash' | 'HDFC Card' | 'ICICI';
  category: string;
  subcategory: string;
  note: string;
  amount: number;
  flow_direction: 'Income' | 'Exp.' | 'Transfer';
  transfer_to?: 'Cash' | 'HDFC Card' | 'ICICI';
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, FormsModule, MatIconModule, DonutChartComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  // Session State
  user = signal<{ id: string; email: string } | null>(null);
  token = signal<string | null>(null);
  authMode = signal<'login' | 'register'>('login');
  emailInput = signal<string>('');
  passwordInput = signal<string>('');
  authError = signal<string>('');
  isLoadingAuth = signal<boolean>(false);

  // Financial Ledger State
  transactions = signal<Transaction[]>([]);
  isLoadingTransactions = signal<boolean>(false);
  filterAccount = signal<string>('All');
  filterCategory = signal<string>('All');

  // Manual Transaction Input Fields
  txDate = signal<string>(new Date().toISOString().substring(0, 10));
  txAccount = signal<string>('HDFC Card');
  txCategory = signal<string>('🍜 Food');
  txSubcategory = signal<string>('');
  txNote = signal<string>('');
  txAmount = signal<number | null>(null);
  txFlow = signal<'Income' | 'Exp.' | 'Transfer'>('Exp.');
  txTransferTo = signal<string>('Cash');
  txReceiptImage = signal<string>('');
  receiptPreviewModal = signal<string | null>(null);
  ledgerError = signal<string>('');

  // Easy Content Access - Sub-tabs: Daily, Weekly, Monthly, Summary
  ledgerSubTab = signal<'daily' | 'weekly' | 'monthly' | 'summary'>('daily');

  // Customizable Category Budgets
  categoryBudgets = signal<Record<string, number>>({
    '🍜 Food': 15000,
    '🪑 Household': 30000,
    '🧘🏼 Health': 10000,
    '🚗 Transport': 8000,
    '🎉 Entertainment': 12000,
    '📈 Investment': 50000,
    '🎓 Education': 20000,
    '🎁 Gift': 5000,
  });

  // Customizable Starting Account Balances (Legacy)
  startingBalances = signal<Record<string, number>>({
    'Cash': 15000,
    'HDFC Card': -8500,
    'ICICI': 125000
  });

  // Dynamic Accounts
  accounts = signal<Account[]>([
    { id: '1', name: 'Cash', category: 'Cash', type: 'Cash', startingBalance: 15000 },
    { id: '2', name: 'ICICI', category: 'Savings', type: 'Savings', startingBalance: 125000 },
    { id: '3', name: 'HDFC Card', category: 'Card', type: 'Credit', startingBalance: -8500 }
  ]);

  // Bulk SMS Parser State
  smsText = signal<string>('');
  isParsingSMS = signal<boolean>(false);
  smsError = signal<string>('');

  // Pre-configured SMS Presets for easy user testing
  smsPresets = [
    {
      label: '🍜 Chai Kings Debited (HDFC)',
      text: 'Dear HDFC Customer, transaction of Rs. 180 spent successfully at Chai Kings tea shop.'
    },
    {
      label: '🧘🏼 Pharmacy Apollo (HDFC)',
      text: 'Debited from HDFC Card for Rs. 2200.00 at Apollo Pharmacy info: Appa BP machine.'
    },
    {
      label: '🚗 Uber Office Ride (ICICI)',
      text: 'Thank you for using ICICI Bank Card for Rs. 620.00 at UBER INDIA.'
    },
    {
      label: '💼 Monthly Salary Credit',
      text: 'Dear ICICI Customer, your account has been credited with Salary of Rs. 180000.00'
    }
  ];

  // Milestone Goals
  milestones = signal<Milestone[]>([
    { target: '🏠 House Down Payment', amount: 2500000, timeline: 'Dec 2028' },
    { target: '📈 Wealth Compound Goal', amount: 5000000, timeline: 'June 2030' }
  ]);
  newMilestoneTarget = signal<string>('');
  newMilestoneAmount = signal<number | null>(null);
  newMilestoneTimeline = signal<string>('');

  // Active View Tab
  activeTab = signal<'ledger' | 'goals' | 'diagnostics' | 'preferences'>('ledger');

  // User Profile fields
  profileName = signal<string>('');
  profileAge = signal<number | null>(null);
  profileIncome = signal<number | null>(null);
  isSavingProfile = signal<boolean>(false);
  saveProfileStatus = signal<string>('');

  // Custom Categorization Rules
  rules = signal<{ id: string; keyword: string; category: string }[]>([]);
  newRuleKeyword = signal<string>('');
  newRuleCategory = signal<string>('🍜 Food');
  isSavingRule = signal<boolean>(false);

  // Fiduciary AI Advisor State
  isAnalyzing = signal<boolean>(false);
  analysisError = signal<string>('');
  analysisResult = signal<DiagnosticResponse | null>(null);

  // Prepopulated starting assets/liabilities to create a beautiful advisor output
  startingSavingsPool = signal<number>(6500000);
  startingLiabilityPool = signal<number>(350000);

  // Computed Financial Metrics
  accountBalances = computed(() => {
    const accs = this.accounts();
    const txs = this.transactions();
    
    return accs.map(acc => {
      const incomes = txs
        .filter(t => t.flowDirection === 'Income' && t.accountSource === acc.name)
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = txs
        .filter(t => t.flowDirection === 'Exp.' && t.accountSource === acc.name)
        .reduce((sum, t) => sum + t.amount, 0);
      const transfersTo = txs
        .filter(t => t.flowDirection === 'Transfer' && t.transferTo === acc.name)
        .reduce((sum, t) => sum + t.amount, 0);
      const transfersFrom = txs
        .filter(t => t.flowDirection === 'Transfer' && t.accountSource === acc.name)
        .reduce((sum, t) => sum + t.amount, 0);
        
      return {
        ...acc,
        currentBalance: acc.startingBalance + incomes - expenses + transfersTo - transfersFrom
      };
    });
  });

  totalIncomes = computed(() => {
    return this.transactions()
      .filter(t => t.flowDirection === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);
  });

  totalExpenses = computed(() => {
    return this.transactions()
      .filter(t => t.flowDirection === 'Exp.')
      .reduce((sum, t) => sum + t.amount, 0);
  });

  calculatedSavingsPool = computed(() => {
    // Add all balances from non-liability and non-credit accounts to active assets
    const activeAssets = this.accountBalances()
      .filter(a => a.category !== 'Liabilities' && !(a.category === 'Card' && a.type === 'Credit'))
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
    return this.startingSavingsPool() + activeAssets;
  });

  calculatedLiabilityPool = computed(() => {
    // Collect all negative balances in all accounts, plus balances of Liabilities accounts
    const cardDebts = this.accountBalances()
      .filter(a => a.category === 'Card' && a.type === 'Credit')
      .reduce((sum, a) => sum + (a.currentBalance < 0 ? -a.currentBalance : 0), 0);
      
    const liabilities = this.accountBalances()
      .filter(a => a.category === 'Liabilities')
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0); // Assuming liabilities are entered as positive amounts

    return this.startingLiabilityPool() + cardDebts + liabilities;
  });

  calculatedNetWorth = computed(() => {
    return this.calculatedSavingsPool() - this.calculatedLiabilityPool();
  });

  // Filtered ledger view
  filteredTransactions = computed(() => {
    let list = this.transactions();
    if (this.filterAccount() !== 'All') {
      list = list.filter(t => t.accountSource === this.filterAccount() || (t.flowDirection === 'Transfer' && t.transferTo === this.filterAccount()));
    }
    if (this.filterCategory() !== 'All') {
      list = list.filter(t => t.category === this.filterCategory());
    }
    return list;
  });

  // Grouped Daily view
  groupedDailyTransactions = computed(() => {
    const groups: Record<string, { date: string; income: number; expense: number; txs: Transaction[] }> = {};
    for (const t of this.filteredTransactions()) {
      const dateStr = t.period.substring(0, 10);
      if (!groups[dateStr]) {
        groups[dateStr] = { date: dateStr, income: 0, expense: 0, txs: [] };
      }
      if (t.flowDirection === 'Income') {
        groups[dateStr].income += t.amount;
      } else if (t.flowDirection === 'Exp.') {
        groups[dateStr].expense += t.amount;
      }
      groups[dateStr].txs.push(t);
    }
    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  // Grouped Weekly view
  groupedWeeklyTransactions = computed(() => {
    const groups: Record<string, { weekLabel: string; income: number; expense: number; txs: Transaction[] }> = {};
    for (const t of this.filteredTransactions()) {
      const d = new Date(t.period);
      const year = d.getFullYear();
      const oneJan = new Date(year, 0, 1);
      const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
      const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
      const weekKey = `${year}-W${weekNum}`;
      
      if (!groups[weekKey]) {
        const monthName = d.toLocaleString('default', { month: 'long' });
        groups[weekKey] = { weekLabel: `Week ${weekNum} (${monthName} ${year})`, income: 0, expense: 0, txs: [] };
      }
      if (t.flowDirection === 'Income') {
        groups[weekKey].income += t.amount;
      } else if (t.flowDirection === 'Exp.') {
        groups[weekKey].expense += t.amount;
      }
      groups[weekKey].txs.push(t);
    }
    return Object.values(groups).sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
  });

  // Grouped Monthly view
  groupedMonthlyTransactions = computed(() => {
    const groups: Record<string, { monthLabel: string; income: number; expense: number; txs: Transaction[] }> = {};
    for (const t of this.filteredTransactions()) {
      const d = new Date(t.period);
      const monthLabel = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthLabel]) {
        groups[monthLabel] = { monthLabel, income: 0, expense: 0, txs: [] };
      }
      if (t.flowDirection === 'Income') {
        groups[monthLabel].income += t.amount;
      } else if (t.flowDirection === 'Exp.') {
        groups[monthLabel].expense += t.amount;
      }
      groups[monthLabel].txs.push(t);
    }
    return Object.values(groups).sort((a, b) => {
      const partsA = a.monthLabel.split(' ');
      const partsB = b.monthLabel.split(' ');
      if (partsA[1] !== partsB[1]) return parseInt(partsB[1]) - parseInt(partsA[1]);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return months.indexOf(partsB[0]) - months.indexOf(partsA[0]);
    });
  });

  // Summary Metrics (Aesthetically Improved Charts)
  summaryMetrics = computed(() => {
    const totalExp = this.totalExpenses();
    const budgets = this.categoryBudgets();
    const categorySums: Record<string, number> = {};
    
    for (const t of this.transactions().filter(tx => tx.flowDirection === 'Exp.')) {
      categorySums[t.category] = (categorySums[t.category] || 0) + t.amount;
    }
    
    return Object.entries(categorySums).map(([cat, sum]) => {
      const budget = budgets[cat] || 0;
      const pctOfTotal = totalExp > 0 ? (sum / totalExp) * 100 : 0;
      const budgetUtil = budget > 0 ? (sum / budget) * 100 : 0;
      return {
        category: cat,
        amount: sum,
        budget,
        pctOfTotal,
        budgetUtil
      };
    }).sort((a, b) => b.amount - a.amount);
  });

  // Grouped monthly expenses for analytical diagnostics
  categoryBurnRates = computed(() => {
    const groups: Record<string, number> = {};
    for (const t of this.transactions()) {
      if (t.flowDirection === 'Exp.') {
        groups[t.category] = (groups[t.category] || 0) + t.amount;
      }
    }
    return Object.entries(groups).map(([category, amount]) => ({
      category,
      amount
    }));
  });

  ngOnInit() {
    this.autoSignInDemo();
  }

  // Handle Automatic Login for demo purposes
  async autoSignInDemo() {
    this.isLoadingAuth.set(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'madaswath@gmail.com',
          password: 'seeded_password_hash_for_demo'
        })
      });
      const data = await res.json() as AuthResponse;
      if (res.ok) {
        this.user.set({ id: data.id, email: data.email });
        this.token.set(data.token);
        this.loadTransactions();
      } else {
        this.authError.set(data.error || 'Autologin failed');
      }
    } catch (e: unknown) {
      const err = e as Error;
      this.authError.set(err.message || 'Network error on autologin');
    } finally {
      this.isLoadingAuth.set(false);
    }
  }

  // Handle Manual Traditional Login
  async handleLogin() {
    if (!this.emailInput() || !this.passwordInput()) {
      this.authError.set('Please fill out all credentials.');
      return;
    }
    this.isLoadingAuth.set(true);
    this.authError.set('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.emailInput(),
          password: this.passwordInput()
        })
      });
      const data = await res.json() as AuthResponse;
      if (res.ok) {
        this.user.set({ id: data.id, email: data.email });
        this.token.set(data.token);
        this.loadTransactions();
      } else {
        this.authError.set(data.error || 'Authentication failed');
      }
    } catch (e: unknown) {
      const err = e as Error;
      this.authError.set(err.message || 'Server connection error');
    } finally {
      this.isLoadingAuth.set(false);
    }
  }

  // Handle Manual Traditional Registration
  async handleRegister() {
    if (!this.emailInput() || !this.passwordInput()) {
      this.authError.set('Please fill out all credentials.');
      return;
    }
    this.isLoadingAuth.set(true);
    this.authError.set('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.emailInput(),
          password: this.passwordInput()
        })
      });
      const data = await res.json() as AuthResponse;
      if (res.ok) {
        this.handleLogin();
      } else {
        this.authError.set(data.error || 'Registration failed');
        this.isLoadingAuth.set(false);
      }
    } catch (e: unknown) {
      const err = e as Error;
      this.authError.set(err.message || 'Server connection error');
      this.isLoadingAuth.set(false);
    }
  }

  // Handle Logout
  handleLogout() {
    this.user.set(null);
    this.token.set(null);
    this.transactions.set([]);
    this.analysisResult.set(null);
    this.emailInput.set('');
    this.passwordInput.set('');
  }

  // Toggle Auth Modes
  toggleAuthMode() {
    this.authMode.set(this.authMode() === 'login' ? 'register' : 'login');
    this.authError.set('');
  }

  // Load Transactions
  async loadTransactions() {
    const userToken = this.token();
    if (!userToken) return;
    this.isLoadingTransactions.set(true);
    try {
      const res = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (res.ok) {
        const list = await res.json() as Transaction[];
        this.transactions.set(list);
      }
      // Also load profile and categorization rules
      this.loadUserProfile();
      this.loadCategorizationRules();
    } catch (e) {
      console.error('Failed to load transactions', e);
    } finally {
      this.isLoadingTransactions.set(false);
    }
  }

  // Load User Profile
  async loadUserProfile() {
    const userToken = this.token();
    if (!userToken) return;
    try {
      const res = await fetch('/api/user-profile', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.profileName.set(data.name || '');
        this.profileAge.set(data.age || null);
        this.profileIncome.set(data.income || null);
        
        // If profile has goals, load them to milestones signal
        if (data.goals && Array.isArray(data.goals) && data.goals.length > 0) {
          this.milestones.set(data.goals);
        }
        if (data.categoryBudgets) {
          this.categoryBudgets.set(data.categoryBudgets);
        }
        if (data.startingBalances) {
          this.startingBalances.set(data.startingBalances);
        }
        if (data.accounts) {
          this.accounts.set(data.accounts);
        } else if (data.startingBalances) {
          // Migrate legacy startingBalances to accounts
          const mappedAccounts = Object.entries(data.startingBalances).map(([name, bal], i) => ({
            id: `legacy-${i}`,
            name,
            category: 'Cash' as AccountCategory, // default fallback
            type: 'Legacy',
            startingBalance: Number(bal)
          }));
          this.accounts.set(mappedAccounts);
        }
      }
    } catch (e) {
      console.error('Failed to load user profile', e);
    }
  }

  // Save User Profile
  async saveUserProfile() {
    const userToken = this.token();
    if (!userToken) return;
    this.isSavingProfile.set(true);
    this.saveProfileStatus.set('');
    try {
      const res = await fetch('/api/user-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          name: this.profileName(),
          age: this.profileAge(),
          income: this.profileIncome(),
          goals: this.milestones(), // keep milestones in sync
          categoryBudgets: this.categoryBudgets(),
          startingBalances: this.startingBalances(),
          accounts: this.accounts()
        })
      });
      if (res.ok) {
        this.saveProfileStatus.set('Profile and goals updated successfully.');
        setTimeout(() => this.saveProfileStatus.set(''), 4000);
      } else {
        this.saveProfileStatus.set('Failed to save profile.');
      }
    } catch (e) {
      console.error('Failed to save user profile', e);
      this.saveProfileStatus.set('Network error while saving profile.');
    } finally {
      this.isSavingProfile.set(false);
    }
  }

  // Load Categorization Rules
  async loadCategorizationRules() {
    const userToken = this.token();
    if (!userToken) return;
    try {
      const res = await fetch('/api/categorization-rules', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (res.ok) {
        const list = await res.json();
        this.rules.set(list);
      }
    } catch (e) {
      console.error('Failed to load rules', e);
    }
  }

  // Add Categorization Rule
  async addCategorizationRule() {
    const userToken = this.token();
    if (!userToken) return;
    const kw = this.newRuleKeyword().trim();
    const cat = this.newRuleCategory().trim();
    if (!kw || !cat) return;
    this.isSavingRule.set(true);
    try {
      const res = await fetch('/api/categorization-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ keyword: kw, category: cat })
      });
      if (res.ok) {
        this.newRuleKeyword.set('');
        this.loadCategorizationRules();
      }
    } catch (e) {
      console.error('Failed to add rule', e);
    } finally {
      this.isSavingRule.set(false);
    }
  }

  // Delete Categorization Rule
  async deleteCategorizationRule(id: string) {
    const userToken = this.token();
    if (!userToken) return;
    try {
      const res = await fetch(`/api/categorization-rules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (res.ok) {
        this.loadCategorizationRules();
      }
    } catch (e) {
      console.error('Failed to delete rule', e);
    }
  }

  // Create Manual Transaction
  async addManualTransaction() {
    const userToken = this.token();
    if (!userToken) return;
    const amount = this.txAmount();
    if (!amount || amount <= 0) {
      this.ledgerError.set('Please provide a valid numeric amount.');
      return;
    }
    this.ledgerError.set('');
    try {
      const isTransfer = this.txFlow() === 'Transfer';
      const categoryVal = isTransfer ? '🔄 Transfer' : this.txCategory();
      const subcategoryVal = isTransfer ? `Transfer to ${this.txTransferTo()}` : (this.txSubcategory() || 'General');
      const noteVal = this.txNote() || (isTransfer ? `Transferred ₹${amount} from ${this.txAccount()} to ${this.txTransferTo()}` : `${categoryVal} transaction`);

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          period: new Date(this.txDate()).toISOString(),
          accountSource: this.txAccount(),
          category: categoryVal,
          subcategory: subcategoryVal,
          note: noteVal,
          amount: amount,
          flowDirection: this.txFlow(),
          transferTo: isTransfer ? this.txTransferTo() : undefined,
          receiptImage: this.txReceiptImage() || undefined
        })
      });
      if (res.ok) {
        this.txSubcategory.set('');
        this.txNote.set('');
        this.txAmount.set(null);
        this.txReceiptImage.set('');
        this.loadTransactions();
      } else {
        const data = await res.json() as { error?: string };
        this.ledgerError.set(data.error || 'Failed to record transaction');
      }
    } catch (e: unknown) {
      const err = e as Error;
      this.ledgerError.set(err.message || 'Network error logging transaction');
    }
  }

  // Convert uploaded receipt/photo to Base64 string for persistent storage
  onReceiptFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.txReceiptImage.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  // Delete Transaction
  async deleteTransaction(id: string) {
    const userToken = this.token();
    if (!userToken) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (res.ok) {
        this.loadTransactions();
      }
    } catch (e) {
      console.error('Failed to delete', e);
    }
  }

  // Parse SMS text using server-side Regex Engine
  async handleParseSMS() {
    const sms = this.smsText();
    if (!sms || !sms.trim()) {
      this.smsError.set('Please type or paste an SMS string first.');
      return;
    }
    this.isParsingSMS.set(true);
    this.smsError.set('');
    try {
      const res = await fetch('/api/transactions/parse-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sms })
      });
      const data = await res.json() as ParsedSMSTransaction;
      if (res.ok) {
        this.txAccount.set(data.account_source);
        this.txCategory.set(data.category);
        this.txSubcategory.set(data.subcategory);
        this.txNote.set(data.note);
        this.txAmount.set(data.amount);
        this.txFlow.set(data.flow_direction);
      } else {
        const errData = data as unknown as { error?: string };
        this.smsError.set(errData.error || 'Failed to parse SMS');
      }
    } catch (e: unknown) {
      const err = e as Error;
      this.smsError.set(err.message || 'SMS parsing connection error');
    } finally {
      this.isParsingSMS.set(false);
    }
  }

  // Paste a selected SMS preset
  applyPreset(text: string) {
    this.smsText.set(text);
    this.smsError.set('');
    this.handleParseSMS();
  }

  // Add and Delete Milestones
  addMilestone() {
    const target = this.newMilestoneTarget().trim();
    const amount = this.newMilestoneAmount();
    const timeline = this.newMilestoneTimeline().trim() || 'Undated';
    if (!target || !amount || amount <= 0) {
      return;
    }
    this.milestones.update(list => [...list, { target, amount, timeline }]);
    this.newMilestoneTarget.set('');
    this.newMilestoneAmount.set(null);
    this.newMilestoneTimeline.set('');
    
    // Auto-save milestones back to profile goals in DB
    this.saveUserProfile();
  }

  removeMilestone(idx: number) {
    this.milestones.update(list => list.filter((_, i) => i !== idx));
    
    // Auto-save milestones back to profile goals in DB
    this.saveUserProfile();
  }

  // Trigger Fiduciary Gemini AI Diagnostic
  async generateAIDiagnostic() {
    const userToken = this.token();
    if (!userToken) return;
    this.isAnalyzing.set(true);
    this.analysisError.set('');
    this.analysisResult.set(null);

    const payload = {
      netWorthMatrix: {
        assets: this.calculatedSavingsPool(),
        liabilities: this.calculatedLiabilityPool(),
        savings: this.calculatedSavingsPool()
      },
      milestones: this.milestones().map(m => ({
        target: m.target,
        amount: m.amount,
        timeline: m.timeline
      })),
      burnRates: this.categoryBurnRates().map(b => ({
        category: b.category,
        amount: b.amount
      }))
    };

    try {
      const res = await fetch('/api/advisor/diagnostic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json() as Record<string, unknown>;
      if (res.ok) {
        const rawProjections = (data['projectionYears'] || data['projection_years'] || []) as Record<string, number>[];
        const rawViability = (data['milestoneViability'] || data['milestone_viability'] || []) as Record<string, unknown>[];
        const rawRecs = (data['recommendations'] || []) as Record<string, string>[];

        const formattedResult: DiagnosticResponse = {
          projectionYears: rawProjections.map((p) => ({
            year: p['year'] || 0,
            estimatedAssets: p['estimatedAssets'] || p['estimated_assets'] || 0,
            estimatedLiabilities: p['estimatedLiabilities'] || p['estimated_liabilities'] || 0,
            netWorth: p['netWorth'] || p['net_worth'] || 0
          })),
          milestoneViability: rawViability.map((m) => ({
            target: (m['target'] as string) || '',
            isViable: m['isViable'] !== undefined ? !!m['isViable'] : !!m['is_viable'],
            inflationAdjustedCost: (m['inflationAdjustedCost'] as number) || (m['inflation_adjusted_cost'] as number) || 0,
            shortfall: (m['shortfall'] as number) !== undefined ? (m['shortfall'] as number) : 0,
            advice: (m['advice'] as string) || ''
          })),
          recommendations: rawRecs.map((r) => ({
            title: r['title'] || '',
            impact: (r['impact'] as 'High' | 'Medium' | 'Low') || 'Medium',
            financialBenefits: r['financialBenefits'] || r['financial_benefits'] || '',
            actionPlan: r['actionPlan'] || r['action_plan'] || ''
          })),
          inflationImpactNote: (data['inflationImpactNote'] as string) || (data['inflation_impact_note'] as string) || ''
        };
        this.analysisResult.set(formattedResult);
      } else {
        this.analysisError.set((data['error'] as string) || 'Gemini advisor analysis failed.');
      }
    } catch (e: unknown) {
      const err = e as Error;
      this.analysisError.set(err.message || 'Advisor connection timeout. Verify key configuration.');
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  updateStartingBalance(key: string, event: Event) {
    const val = +(event.target as HTMLInputElement).value || 0;
    this.startingBalances.update(b => ({ ...b, [key]: val }));
  }

  updateCategoryBudget(key: string, event: Event) {
    const val = +(event.target as HTMLInputElement).value || 0;
    this.categoryBudgets.update(b => ({ ...b, [key]: val }));
  }

  // Account Management
  newAccountName = signal<string>('');
  newAccountCategory = signal<AccountCategory>('Savings');
  newAccountType = signal<string>('Savings');
  newAccountBalance = signal<number>(0);

  addAccount() {
    if (!this.newAccountName().trim()) return;
    const account: Account = {
      id: crypto.randomUUID(),
      name: this.newAccountName(),
      category: this.newAccountCategory(),
      type: this.newAccountType(),
      startingBalance: this.newAccountBalance()
    };
    this.accounts.update(accs => [...accs, account]);
    this.newAccountName.set('');
    this.newAccountBalance.set(0);
  }

  removeAccount(id: string) {
    this.accounts.update(accs => accs.filter(a => a.id !== id));
  }

  updateAccountBalance(id: string, event: Event) {
    const val = +(event.target as HTMLInputElement).value || 0;
    this.accounts.update(accs => accs.map(a => a.id === id ? { ...a, startingBalance: val } : a));
  }


  exportFilteredToCSV() {
    const list = this.filteredTransactions();
    if (list.length === 0) return;

    // Define CSV Headers
    const headers = ['Date', 'Institution', 'Flow', 'Category', 'Subcategory', 'Note', 'Amount (INR)', 'Transfer To'];
    
    // Format rows
    const rows = list.map(tx => [
      tx.period.substring(0, 10),
      `"${tx.accountSource.replace(/"/g, '""')}"`,
      `"${tx.flowDirection}"`,
      `"${tx.category.replace(/"/g, '""')}"`,
      `"${(tx.subcategory || '').replace(/"/g, '""')}"`,
      `"${(tx.note || '').replace(/"/g, '""')}"`,
      tx.amount,
      `"${(tx.transferTo || '').replace(/"/g, '""')}"`
    ]);

    // Construct CSV content
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    // Download logic
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `private_ledger_export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
