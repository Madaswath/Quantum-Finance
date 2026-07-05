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
const angularApp = new AngularNodeAppEngine({
  allowedHosts: process.env['NG_ALLOWED_HOSTS']
    ? process.env['NG_ALLOWED_HOSTS'].split(',')
    : (isMainModule(import.meta.url) || process.env['pm_id']
        ? ['localhost', '127.0.0.1']
        : ['*'])
});

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

// Reverse proxy to forward all API traffic to the Python FastAPI backend
app.use('/api', async (req: Request, res: Response): Promise<void> => {
  const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:8000';
  const targetUrl = `${backendUrl}/api${req.url}`;
  
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined && key.toLowerCase() !== 'host') {
      headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }
  }

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        ...headers,
        ...(req.method !== 'GET' && req.method !== 'HEAD' && req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0
          ? { 'content-type': 'application/json' }
          : {})
      } as HeadersInit,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && (typeof req.body === 'object' && Object.keys(req.body).length > 0)) {
        fetchOptions.body = JSON.stringify(req.body);
      }
    }

    const backendRes = await fetch(targetUrl, fetchOptions);
    
    backendRes.headers.forEach((val, key) => {
      if (!['transfer-encoding', 'content-encoding', 'content-length'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });

    res.status(backendRes.status);
    
    const contentType = backendRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await backendRes.json();
      res.json(json);
    } else {
      const text = await backendRes.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Error proxying to backend:', error);
    res.status(502).json({ error: 'Gateway Error: Failed to communicate with FastAPI backend.' });
  }
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
