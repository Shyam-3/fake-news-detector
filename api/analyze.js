// Vercel Serverless Function - API Proxy for Groq
const https = require('https');

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (typeof req.body !== 'undefined') {
      resolve(req.body);
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      name: 'TruthLens API proxy',
      route: '/api/analyze',
      methods: ['POST', 'OPTIONS']
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const apiKey = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.headers['x-api-key'] || '';

  if (!apiKey) {
    sendJson(res, 401, { error: 'No API key provided' });
    return;
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const postData = JSON.stringify(payload || {});
  const options = {
    hostname: 'api.groq.com',
    port: 443,
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${apiKey}`
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';

    proxyRes.on('data', chunk => {
      data += chunk;
    });

    proxyRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        sendJson(res, proxyRes.statusCode || 500, parsed);
      } catch (error) {
        res.statusCode = proxyRes.statusCode || 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(data || JSON.stringify({ error: 'Invalid response from Groq API' }));
      }
    });
  });

  proxyReq.on('error', (error) => {
    sendJson(res, 500, { error: 'Groq API Error: ' + error.message });
  });

  proxyReq.write(postData);
  proxyReq.end();
};
