import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { Request, Response, NextFunction } from 'express';
import {join} from 'node:path';
import {LocalDB, parseSMS, User} from './server-db.js';
import {GoogleGenAI} from '@google/genai';

interface AuthenticatedRequest extends Request {
  user?: User;
}

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Initialize the local database engine
const db = new LocalDB();

// Body parsing middleware
app.use(express.json());

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing. Please add it in your Secrets/Environment setup.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * REST API Endpoints
 */

// Simple local session mock utilizing user email as identifier for preview robustness
app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const userId = authHeader.substring(7);
    const user = db.findUserById(userId);
    if (user) {
      (req as AuthenticatedRequest).user = user;
    }
  }
  next();
});

// Auth Routes
app.post('/api/auth/register', (req: Request, res: Response): void => {
  try {
    const {email, password} = req.body;
    if (!email || !password) {
      res.status(400).json({error: 'Email and password are required'});
      return;
    }
    const user = db.createUser(email, password);
    res.status(201).json({id: user.id, email: user.email});
  } catch (error: unknown) {
    const err = error as Error;
    res.status(400).json({error: err.message || 'Registration failed'});
  }
});

app.post('/api/auth/login', (req: Request, res: Response): void => {
  try {
    const {email, password} = req.body;
    if (!email || !password) {
      res.status(400).json({error: 'Email and password are required'});
      return;
    }
    const user = db.findUserByEmail(email);
    if (!user || user.passwordHash !== password) {
      res.status(401).json({error: 'Invalid credentials'});
      return;
    }
    res.json({id: user.id, email: user.email, token: user.id});
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({error: err.message || 'Login failed'});
  }
});

// Transaction CRUD Routes
app.get('/api/transactions', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  res.json(db.getTransactions(user.id));
});

app.post('/api/transactions', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  try {
    const {period, accountSource, category, subcategory, note, amount, flowDirection, transferTo, receiptImage} = req.body;
    if (!period || !accountSource || !category || !amount || !flowDirection) {
      res.status(400).json({error: 'Missing required transaction fields'});
      return;
    }
    const tx = db.createTransaction(user.id, {
      period,
      accountSource,
      category,
      subcategory: subcategory || '',
      note: note || '',
      amount: parseFloat(amount),
      flowDirection,
      transferTo,
      receiptImage
    });
    res.status(201).json(tx);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(400).json({error: err.message || 'Failed to create transaction'});
  }
});

app.delete('/api/transactions/:id', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  const deleted = db.deleteTransaction(user.id, req.params['id'] as string);
  if (deleted) {
    res.json({success: true});
  } else {
    res.status(404).json({error: 'Transaction not found'});
  }
});

app.post('/api/transactions/batch', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  try {
    const {transactions} = req.body;
    if (!Array.isArray(transactions)) {
      res.status(400).json({error: 'Transactions array is required'});
      return;
    }
    const inserted = db.batchInsert(user.id, transactions);
    res.status(201).json(inserted);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(400).json({error: err.message || 'Batch insertion failed'});
  }
});

// Regex SMS Parsing route
app.post('/api/transactions/parse-sms', (req: Request, res: Response): void => {
  try {
    const {text} = req.body;
    if (!text) {
      res.status(400).json({error: 'SMS text is required'});
      return;
    }
    const user = (req as AuthenticatedRequest).user;
    const rules = user ? db.getCategorizationRules(user.id) : [];
    const parsed = parseSMS(text, rules);
    res.json(parsed);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({error: err.message || 'SMS parsing failed'});
  }
});

// Fiduciary AI Advisor Diagnostic Endpoint
app.post('/api/advisor/diagnostic', async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }

  try {
    const {netWorthMatrix, milestones, burnRates} = req.body;
    const assets = netWorthMatrix?.assets || 0;
    const liabilities = netWorthMatrix?.liabilities || 0;
    const savings = netWorthMatrix?.savings || 0;
    const milestoneList = Array.isArray(milestones) ? milestones : [];
    const burnRateList = Array.isArray(burnRates) ? burnRates : [];

    // Get the Gemini AI Client
    const ai = getGeminiClient();

    // Construct fiduciary context prompt
    const prompt = `You are an elite, fiduciary wealth advisor and private banking manager.
Analyze the following user financial metrics carefully:
- Assets: ₹${assets}
- Liabilities: ₹${liabilities}
- Net Liquid Savings: ₹${savings}
- Milestones Goals:
${milestoneList.map(m => `  * Target Milestone: "${m.target}", Goal Amount: ₹${m.amount}, Timeline/Date Target: "${m.timeline}"`).join('\n')}
- Monthly Category Burn Rates:
${burnRateList.map(b => `  * ${b.category}: ₹${b.amount}`).join('\n')}

Perform forward-looking cash flow projections accounting for a realistic annual inflation rate of 6%. Assess goal viability, highlight critical budget pain points, and recommend exactly 3 to 4 hyper-specific actions (e.g., refinancing credit card liabilities, transferring high-yield savings to fixed deposits, or optimizing stock/mutual fund indices).

Return a strict, valid, well-structured JSON object. Do not include markdown code fence formatting (like \`\`\`json) or any preamble or wrap texts. Return ONLY the raw JSON string matching this TypeScript interface exactly:

interface DiagnosticResponse {
  projectionYears: { year: number; estimatedAssets: number; estimatedLiabilities: number; netWorth: number }[];
  milestoneViability: { target: string; isViable: boolean; inflationAdjustedCost: number; shortfall: number; advice: string }[];
  recommendations: { title: string; impact: 'High' | 'Medium' | 'Low'; financialBenefits: string; actionPlan: string }[];
  inflationImpactNote: string;
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.15,
      },
    });

    const text = response.text || '{}';
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }

    const data = JSON.parse(cleanedText);
    res.json(data);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Gemini Advisor Error]', err);
    res.status(500).json({
      error: 'Failed to generate financial diagnostic. Please check your GEMINI_API_KEY.',
      details: err.message
    });
  }
});

// Categorization Rules Routes
app.get('/api/categorization-rules', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  const rules = db.getCategorizationRules(user.id);
  res.json(rules);
});

app.post('/api/categorization-rules', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  const {keyword, category} = req.body;
  if (!keyword || !category) {
    res.status(400).json({error: 'Keyword and category are required'});
    return;
  }
  const rule = db.createCategorizationRule(user.id, keyword, category);
  res.status(201).json(rule);
});

app.delete('/api/categorization-rules/:id', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  const deleted = db.deleteCategorizationRule(user.id, req.params['id'] as string);
  if (deleted) {
    res.status(204).end();
  } else {
    res.status(404).json({error: 'Rule not found'});
  }
});

// User Profile Routes
app.get('/api/user-profile', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  const profile = db.getUserProfile(user.id);
  res.json(profile);
});

app.put('/api/user-profile', (req: Request, res: Response): void => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }
  const {name, age, income, goals, categoryBudgets, startingBalances} = req.body;
  const profile = db.updateUserProfile(user.id, {
    name,
    age: age ? parseInt(age.toString(), 10) : null,
    income: income ? parseFloat(income.toString()) : null,
    goals,
    categoryBudgets,
    startingBalances
  });
  res.json(profile);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
