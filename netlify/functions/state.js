const { getStore } = require('@netlify/blobs');

const DEFAULT_STATE = {
  version: 0,
  boys: [],
  tasks: [],
  rewards: [],
  goals: [],
  settings: { voiceEnabled: true, soundEnabled: true, pin: '2468' },
  activeBoyId: null
};

const STORE_NAME = 'broquest';
const KEY = 'state';
const HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  const store = getStore(STORE_NAME);

  if (event.httpMethod === 'GET') {
    const data = await store.get(KEY, { type: 'json' });
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify(data || DEFAULT_STATE)
    };
  }

  if (event.httpMethod === 'POST') {
    let parsed;
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'bad json' }) };
    }
    await store.set(KEY, JSON.stringify(parsed.state || parsed));
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
};
