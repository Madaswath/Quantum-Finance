import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  period: string; // ISO date
  accountSource: 'Cash' | 'HDFC Card' | 'ICICI';
  category: string;
  subcategory: string;
  note: string;
  amount: number;
  flowDirection: 'Income' | 'Exp.' | 'Transfer';
  transferTo?: 'Cash' | 'HDFC Card' | 'ICICI';
  receiptImage?: string; // base64 or url photo save
  transactionType?: 'Income' | 'Bills' | 'Expenses' | 'Savings' | 'Investments' | 'Debt Payoff';
  createdAt: string;
}

export interface CategorizationRule {
  id: string;
  userId: string;
  keyword: string;
  category: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  age: number | null;
  income: number | null;
  goals: { 
    target: string; 
    amount: number; 
    timeline: string;
    priority?: number;
    years_left?: number;
    amount_required_today?: number;
    amount_available_today?: number;
    inflation?: number;
    step_up?: number;
    sip_required?: number;
  }[];
  categoryBudgets?: Record<string, number>;
  startingBalances?: Record<string, number>;
  accounts?: { id: string; name: string; category: string; type: string; startingBalance: number; }[];
  isPremium?: boolean;
  createdAt: string;
}

const DB_FILE = join(process.cwd(), 'quantum_wealth_db.json');

export class LocalDB {
  private users: User[] = [];
  private transactions: Transaction[] = [];
  private categorizationRules: CategorizationRule[] = [];
  private userProfiles: UserProfile[] = [];

  constructor() {
    this.load();
    if (this.users.length === 0) {
      this.seed();
    }
  }

  private load() {
    try {
      if (existsSync(DB_FILE)) {
        const data = JSON.parse(readFileSync(DB_FILE, 'utf8'));
        this.users = data.users || [];
        this.transactions = data.transactions || [];
        this.categorizationRules = data.categorizationRules || [];
        this.userProfiles = data.userProfiles || [];
        console.log(`[DB] Database loaded successfully. ${this.users.length} users, ${this.transactions.length} transactions, ${this.categorizationRules.length} rules.`);
      } else {
        this.save();
      }
    } catch (e) {
      console.error('[DB] Failed to load database, resetting...', e);
      this.save();
    }
  }

  private save() {
    try {
      writeFileSync(DB_FILE, JSON.stringify({
        users: this.users,
        transactions: this.transactions,
        categorizationRules: this.categorizationRules,
        userProfiles: this.userProfiles
      }, null, 2), 'utf8');
    } catch (e) {
      console.error('[DB] Failed to save database:', e);
    }
  }

  // Categorization Rules Methods
  getCategorizationRules(userId: string): CategorizationRule[] {
    return this.categorizationRules.filter(r => r.userId === userId);
  }

  createCategorizationRule(userId: string, keyword: string, category: string): CategorizationRule {
    const existing = this.categorizationRules.find(r => r.userId === userId && r.keyword.toLowerCase() === keyword.toLowerCase());
    if (existing) {
      existing.category = category;
      this.save();
      return existing;
    }

    const rule: CategorizationRule = {
      id: randomUUID(),
      userId,
      keyword: keyword.trim(),
      category: category.trim(),
      createdAt: new Date().toISOString()
    };
    this.categorizationRules.push(rule);
    this.save();
    return rule;
  }

  deleteCategorizationRule(userId: string, ruleId: string): boolean {
    const initialLength = this.categorizationRules.length;
    this.categorizationRules = this.categorizationRules.filter(r => !(r.id === ruleId && r.userId === userId));
    const deleted = this.categorizationRules.length < initialLength;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  // User Profile Methods
  getUserProfile(userId: string): UserProfile {
    let profile = this.userProfiles.find(p => p.userId === userId);
    if (!profile) {
      profile = {
        id: randomUUID(),
        userId,
        name: '',
        age: null,
        income: null,
        goals: [],
        categoryBudgets: {
          '🍜 Food': 15000,
          '🪑 Household': 30000,
          '🧘🏼 Health': 10000,
          '🚗 Transport': 8000,
          '🎉 Entertainment': 12000,
          '📈 Investment': 50000,
          '🎓 Education': 20000,
          '🎁 Gift': 5000,
        },
        startingBalances: {
          'Cash': 15000,
          'HDFC Card': -8500,
          'ICICI': 125000
        },
        createdAt: new Date().toISOString()
      };
      this.userProfiles.push(profile);
      this.save();
    } else {
      // Ensure missing fields are populated
      let needsSave = false;
      if (!profile.categoryBudgets) {
        profile.categoryBudgets = {
          '🍜 Food': 15000,
          '🪑 Household': 30000,
          '🧘🏼 Health': 10000,
          '🚗 Transport': 8000,
          '🎉 Entertainment': 12000,
          '📈 Investment': 50000,
          '🎓 Education': 20000,
          '🎁 Gift': 5000,
        };
        needsSave = true;
      }
      if (!profile.startingBalances) {
        profile.startingBalances = {
          'Cash': 15000,
          'HDFC Card': -8500,
          'ICICI': 125000
        };
        needsSave = true;
      }
      if (needsSave) {
        this.save();
      }
    }
    return profile;
  }

  updateUserProfile(userId: string, data: Partial<Omit<UserProfile, 'id' | 'userId' | 'createdAt'>>): UserProfile {
    const profile = this.getUserProfile(userId);
    if (data.name !== undefined) profile.name = data.name;
    if (data.age !== undefined) profile.age = data.age;
    if (data.income !== undefined) profile.income = data.income;
    if (data.goals !== undefined) profile.goals = data.goals;
    if (data.categoryBudgets !== undefined) profile.categoryBudgets = data.categoryBudgets;
    if (data.startingBalances !== undefined) profile.startingBalances = data.startingBalances;
    if (data.accounts !== undefined) profile.accounts = data.accounts;
    if (data.isPremium !== undefined) profile.isPremium = data.isPremium;
    this.save();
    return profile;
  }

  // User methods
  createUser(email: string, passwordHash: string): User {
    const emailLower = email.toLowerCase().trim();
    if (this.users.find(u => u.email === emailLower)) {
      throw new Error('User already exists');
    }
    const user: User = {
      id: randomUUID(),
      email: emailLower,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    this.users.push(user);
    this.save();
    return user;
  }

  findUserByEmail(email: string): User | undefined {
    const emailLower = email.toLowerCase().trim();
    return this.users.find(u => u.email === emailLower);
  }

  findUserById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  // Transaction methods
  getTransactions(userId: string): Transaction[] {
    return this.transactions
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime());
  }

  createTransaction(userId: string, tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>): Transaction {
    const transaction: Transaction = {
      ...tx,
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString()
    };
    this.transactions.push(transaction);
    this.save();
    return transaction;
  }

  deleteTransaction(userId: string, txId: string): boolean {
    const initialLen = this.transactions.length;
    this.transactions = this.transactions.filter(t => !(t.id === txId && t.userId === userId));
    const deleted = this.transactions.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  batchInsert(userId: string, txs: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]): Transaction[] {
    const inserted: Transaction[] = [];
    for (const tx of txs) {
      const transaction: Transaction = {
        ...tx,
        id: randomUUID(),
        userId,
        createdAt: new Date().toISOString()
      };
      this.transactions.push(transaction);
      inserted.push(transaction);
    }
    this.save();
    return inserted;
  }

  // Setup initial seeding with realistic, beautiful transaction records
  private seed() {
    console.log('[DB] Seeding default records...');
    
    // Create default test user with password "password" (using a fast representation for mock auth)
    // passwordHash is simple since we check both argon/bcrypt or a custom easy representation
    const defaultUser = this.createUser('madaswath@gmail.com', 'seeded_password_hash_for_demo');

    const now = new Date();
    const may = (day: number) => {
      const d = new Date(now);
      d.setMonth(4); // May is index 4
      d.setDate(day);
      d.setHours(12, 0, 0, 0);
      return d.toISOString();
    };

    const june = (day: number) => {
      const d = new Date(now);
      d.setMonth(5); // June is index 5
      d.setDate(day);
      d.setHours(12, 0, 0, 0);
      return d.toISOString();
    };

    const samples: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[] = [
      {
        period: june(28),
        accountSource: 'ICICI',
        category: '💼 Income',
        subcategory: 'Salary',
        note: 'Quantum Corp June Salary Payout',
        amount: 180000,
        flowDirection: 'Income'
      },
      {
        period: june(27),
        accountSource: 'HDFC Card',
        category: '🍜 Food',
        subcategory: 'Restaurants',
        note: 'Chai Kings - Evening snacks & Tea',
        amount: 180,
        flowDirection: 'Exp.'
      },
      {
        period: june(26),
        accountSource: 'ICICI',
        category: '🪑 Household',
        subcategory: 'Rent',
        note: 'Monthly Apartment Rent Payment',
        amount: 28000,
        flowDirection: 'Exp.'
      },
      {
        period: june(25),
        accountSource: 'HDFC Card',
        category: '🧘🏼 Health',
        subcategory: 'Hospital',
        note: 'Apollo Pharmacy - Appa Blood Pressure Machine',
        amount: 2200,
        flowDirection: 'Exp.'
      },
      {
        period: june(24),
        accountSource: 'Cash',
        category: '🍜 Food',
        subcategory: 'Groceries',
        note: 'Organic Vegetables & Fresh Milk',
        amount: 450,
        flowDirection: 'Exp.'
      },
      {
        period: june(22),
        accountSource: 'ICICI',
        category: '📈 Investment',
        subcategory: 'Mutual Fund SIP',
        note: 'HDFC Top 100 Index Fund SIP',
        amount: 15000,
        flowDirection: 'Exp.'
      },
      {
        period: june(20),
        accountSource: 'HDFC Card',
        category: '🚗 Transport',
        subcategory: 'Commute',
        note: 'Uber Ride to office',
        amount: 620,
        flowDirection: 'Exp.'
      },
      {
        period: june(18),
        accountSource: 'HDFC Card',
        category: '🍜 Food',
        subcategory: 'Snacks',
        note: 'Swiggy Dinner Delivery',
        amount: 890,
        flowDirection: 'Exp.'
      },
      {
        period: june(15),
        accountSource: 'ICICI',
        category: '🎓 Education',
        subcategory: 'Courses',
        note: 'Data Science Certification Course',
        amount: 4500,
        flowDirection: 'Exp.'
      },
      {
        period: june(10),
        accountSource: 'Cash',
        category: '🍜 Food',
        subcategory: 'Snacks',
        note: 'Local Tea Stall Chai and biscuits',
        amount: 60,
        flowDirection: 'Exp.'
      },
      {
        period: june(5),
        accountSource: 'HDFC Card',
        category: '🪑 Household',
        subcategory: 'Utilities',
        note: 'Electricity Bill Payment',
        amount: 3200,
        flowDirection: 'Exp.'
      },
      {
        period: may(28),
        accountSource: 'ICICI',
        category: '💼 Income',
        subcategory: 'Salary',
        note: 'Quantum Corp May Salary Payout',
        amount: 180000,
        flowDirection: 'Income'
      },
      {
        period: may(20),
        accountSource: 'HDFC Card',
        category: '🧘🏼 Health',
        subcategory: 'Doctor',
        note: 'General physician consultation fee',
        amount: 800,
        flowDirection: 'Exp.'
      },
      {
        period: may(15),
        accountSource: 'ICICI',
        category: '📈 Investment',
        subcategory: 'Stocks',
        note: 'Zerodha equity purchase',
        amount: 10000,
        flowDirection: 'Exp.'
      }
    ];

    for (const sample of samples) {
      this.createTransaction(defaultUser.id, sample);
    }
    console.log(`[DB] Seeding completed. Pre-seeded ${this.transactions.length} sample transactions.`);
  }
}

export function parseSMS(
  text: string,
  customRules?: { keyword: string; category: string }[]
): Omit<Transaction, 'id' | 'userId' | 'createdAt'> {
  const normalized = text.toLowerCase().trim();
  let amount = 0;
  let accountSource: 'Cash' | 'HDFC Card' | 'ICICI' = 'Cash';
  let note = 'Parsed SMS Transaction';
  let category = '🪑 Household';
  let subcategory = 'General';
  let flowDirection: 'Income' | 'Exp.' = 'Exp.';

  // 1. Detect Account Source
  if (normalized.includes('hdfc') || normalized.includes('hdfccard')) {
    accountSource = 'HDFC Card';
  } else if (normalized.includes('icici') || normalized.includes('icicibank')) {
    accountSource = 'ICICI';
  } else if (normalized.includes('cash') || normalized.includes('hand-to-hand')) {
    accountSource = 'Cash';
  }

  // 2. Detect Amount
  // Matches e.g. Rs. 500, Rs.500, Rs 500, INR 500, Rs. 5,000.50
  const amountRegexes = [
    /(?:rs\.?|inr)\s*([0-9,.]+)/i,
    /for\s*(?:rs\.?|inr)?\s*([0-9,.]+)/i,
    /credited\s*(?:with\s*)?(?:rs\.?|inr)?\s*([0-9,.]+)/i,
    /debited\s*(?:with\s*)?(?:rs\.?|inr)?\s*([0-9,.]+)/i,
    /([0-9,.]+)\s*(?:rs|inr)/i
  ];

  for (const regex of amountRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      const parsedAmount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        amount = parsedAmount;
        break;
      }
    }
  }

  // 3. Detect Flow Direction
  if (normalized.includes('credited') || normalized.includes('received') || normalized.includes('salary') || normalized.includes('deposited')) {
    flowDirection = 'Income';
    category = '💼 Income';
    subcategory = 'Direct Deposit';
    note = 'Direct Credit Payout';
  }

  // 4. Extract Merchant/Note
  // e.g. "at [Merchant] on", "to [Merchant] from", "for [Reason]"
  const merchantMatches = [
    /at\s+([^,\n.]+)/i,
    /spent\s+on\s+([^,\n.]+)/i,
    /sent\s+to\s+([^,\n.]+)/i,
    /to\s+([^,\n.]+)\s+from/i,
    /for\s+([^,\n.]+)/i,
    /info:\s*([^,\n.]+)/i
  ];

  for (const regex of merchantMatches) {
    const match = text.match(regex); // Use original text for correct casing
    if (match && match[1]) {
      note = match[1].trim();
      break;
    }
  }

  if (note === 'Parsed SMS Transaction' && amount > 0) {
    note = `Spend of ₹${amount} via ${accountSource}`;
  }

  // 5. Deduce Category & Subcategory based on Merchant & Note
  const noteLower = note.toLowerCase();
  const textLower = text.toLowerCase();
  let customCategory = '';

  if (customRules) {
    for (const rule of customRules) {
      if (noteLower.includes(rule.keyword.toLowerCase()) || textLower.includes(rule.keyword.toLowerCase())) {
        customCategory = rule.category;
        break;
      }
    }
  }

  if (customCategory) {
    category = customCategory;
    subcategory = 'Custom Rule';
  } else if (flowDirection === 'Exp.') {
    if (noteLower.match(/(chai|tea|coffee|kings|starbucks|cafe|restaurant|diner|food|swiggy|zomato|eats|bake|bakery|lunch|dinner|breakfast|burger|pizza|snacks|milk|dairy)/)) {
      category = '🍜 Food';
      subcategory = noteLower.includes('grocer') || noteLower.includes('milk') || noteLower.includes('vegetable') ? 'Groceries' : 'Restaurants';
    } else if (noteLower.match(/(rent|owner|room|flat|apartment|furniture|utility|electricity|power|eb|water|gas|wifi|internet|broadband|house|homely|curtain|chair|table)/)) {
      category = '🪑 Household';
      subcategory = noteLower.includes('rent') ? 'Rent' : 'Utilities';
    } else if (noteLower.match(/(apollo|pharmacy|doctor|hospital|clinic|med|medicine|tablet|bp|dentist|health|wellness|insurance|physio)/)) {
      category = '🧘🏼 Health';
      subcategory = noteLower.includes('pharmacy') || noteLower.includes('medicine') ? 'Pharmacy' : 'Hospital';
    } else if (noteLower.match(/(uber|ola|metro|card|commute|cab|taxi|train|bus|ticket|petrol|fuel|shell|diesel|service|auto)/)) {
      category = '🚗 Transport';
      subcategory = noteLower.includes('petrol') || noteLower.includes('fuel') ? 'Fuel' : 'Commute';
    } else if (noteLower.match(/(zerodha|sip|mutual|fund|stock|equity|groww|invest|gold|etf|bonds)/)) {
      category = '📈 Investment';
      subcategory = 'Equity & SIPs';
    } else if (noteLower.match(/(udemy|coursera|course|book|school|tuition|class|exam|college|fees|learning)/)) {
      category = '🎓 Education';
      subcategory = 'Skills & Courses';
    } else if (noteLower.match(/(gift|present|birthday|anniversary|donation|charity|ngo)/)) {
      category = '🎁 Gift';
      subcategory = 'Personal';
    } else if (noteLower.match(/(netflix|prime|spotify|movie|theater|mall|pvr|concert|game|play|fun|pub|bar|beer|wine|club)/)) {
      category = '🎉 Entertainment';
      subcategory = 'Leisure';
    }
  }

  return {
    period: new Date().toISOString(),
    accountSource,
    category,
    subcategory,
    note,
    amount,
    flowDirection
  };
}
