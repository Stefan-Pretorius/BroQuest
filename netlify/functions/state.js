const { getStore } = require('@netlify/blobs');

const DEFAULT_STATE = {
  version: 0,
  boys: [],
  tasks: [],
  rewards: [],
  goals: [],
  settings: { voiceEnabled: true, soundEnabled: true, pin: '2468', voiceGender: 'woman' },
  activeBoyId: null
};

const STORE_NAME = 'broquest';
const KEY = 'state';
const HEADERS = { 'Content-Type': 'application/json' };

// Netlify Blobs must be enabled on the site for full persistence. If they
// aren't, we degrade to a per-instance store so the endpoint never 502s and
// the app still renders. When Blobs get enabled later, persistence resumes
// automatically with no code change.
let store = null;
let storeAttempted = false;
let memState = null;

function getStoreOrNull() {
  if (!storeAttempted) {
    storeAttempted = true;
    try { store = getStore(STORE_NAME); } catch (e) { store = null; }
  }
  return store;
}

exports.handler = async (event) => {
  try {
    const s = getStoreOrNull();

    if (event.httpMethod === 'GET') {
      let data = null;
      if (s) {
        try { data = await s.get(KEY, { type: 'json' }); } catch (e) { data = null; }
      }
      if (data === null && memState) data = memState;
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify(data || DEFAULT_STATE)
      };
    }

    if (event.httpMethod === 'POST') {
      let parsed;
      try { parsed = JSON.parse(event.body || '{}'); } catch (e) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'bad json' }) };
      }
      const payload = parsed.state || parsed;
      memState = payload;
      if (s) {
        try { await s.set(KEY, JSON.stringify(payload)); } catch (e) {}
      }
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
  } catch (e) {
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify(DEFAULT_STATE) };
  }
};
