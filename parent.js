(function () {
  'use strict';

  var AVATARS = ['🦁', '🐺', '🦅', '🐯', '🦈', '🐲', '🚀', '⚡', '🏀', '🎮', '🥷', '🤖', '🔥', '💪'];
  var LS_KEY = 'bro_quest_v1';

  var state = {
    version: 0, boys: [], tasks: [], rewards: [], goals: [],
    settings: { voiceEnabled: true, soundEnabled: true, pin: '2468', voiceGender: 'woman' },
    activeBoyId: null
  };
  var serverVersion = 0;
  var pushTimer = null;

  var el = {};
  ['pinScreen', 'pinInput', 'pinHint', 'unlockBtn', 'parentUI', 'boyList', 'newBoyName', 'addBoyBtn',
   'boySelect', 'goalBoySelect', 'pTitle', 'pPoints', 'pTime', 'pRemind', 'pAddBtn', 'taskList',
   'rEmoji', 'rName', 'rCost', 'rAddBtn', 'rewardList', 'gTitle', 'gTarget', 'gAddBtn', 'goalList',
   'voiceBtn', 'soundBtn', 'voiceGenderBtn', 'newPin', 'savePinBtn', 'resetBtn', 'syncNote'].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() { return 'id' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

  function normalizeState(s) {
    s = s || {};
    if (!s.boys) s.boys = [];
    if (!s.tasks) s.tasks = [];
    if (!s.rewards) s.rewards = [];
    if (!s.goals) s.goals = [];
    s.settings = {
      voiceEnabled: !s.settings || s.settings.voiceEnabled !== false,
      soundEnabled: !s.settings || s.settings.soundEnabled !== false,
      pin: (s.settings && s.settings.pin) || '2468',
      voiceGender: (s.settings && s.settings.voiceGender) || 'woman'
    };
    if (!s.version) s.version = 0;
    if (!s.activeBoyId) s.activeBoyId = null;
    return s;
  }
  function boyById(id) {
    for (var i = 0; i < state.boys.length; i++) if (state.boys[i].id === id) return state.boys[i];
    return null;
  }
  function loadCache() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch (e) {}
    return null;
  }
  function writeCache() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---------- sync (XHR — fetch doesn't exist on iOS 9) ----------
  function setOnline() { el.syncNote.className = 'sync-note online'; }
  function setOffline() { el.syncNote.className = 'sync-note offline'; }
  function httpRequest(method, url, body, onOk, onErr) {
    var xhr;
    try { xhr = new XMLHttpRequest(); } catch (e) { if (onErr) onErr(e); return; }
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        var data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        if (onOk) onOk(data);
      } else if (onErr) {
        onErr(new Error('HTTP ' + xhr.status));
      }
    };
    try { xhr.send(body ? body : null); } catch (e) { if (onErr) onErr(e); }
  }
  function fetchState(cb) {
    httpRequest('GET', '/api/state', null, function (s) { cb(normalizeState(s)); }, function () { cb(null); });
  }
  function pushNow() {
    clearTimeout(pushTimer);
    httpRequest('POST', '/api/state', JSON.stringify({ state: state }), setOnline, setOffline);
  }
  function syncPush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 400);
  }
  function save() {
    state.version = Date.now();
    writeCache();
    render();
    syncPush();
  }
  function isEmptyState(s) {
    return s && !s.boys.length && !s.tasks.length && !s.rewards.length && !s.goals.length;
  }
  function mergeById(a, b) {
    var map = {}, out = [], k;
    a.forEach(function (x) { if (x && x.id) map[x.id] = x; });
    b.forEach(function (x) { if (x && x.id) map[x.id] = x; });
    for (k in map) { if (Object.prototype.hasOwnProperty.call(map, k)) out.push(map[k]); }
    return out;
  }
  function mergeFrom(s) {
    state.boys = mergeById(state.boys, s.boys);
    state.tasks = mergeById(state.tasks, s.tasks);
    state.rewards = mergeById(state.rewards, s.rewards);
    state.goals = mergeById(state.goals, s.goals);
    if (s.settings) {
      state.settings.voiceEnabled = s.settings.voiceEnabled;
      state.settings.soundEnabled = s.settings.soundEnabled;
      if (s.settings.pin !== '2468') state.settings.pin = s.settings.pin;
    }
    if (s.activeBoyId) state.activeBoyId = s.activeBoyId;
    state.version = Math.max(state.version || 0, s.version || 0);
  }
  function handleServer(s) {
    if (!s) { setOffline(); render(); return; }
    setOnline();
    s = normalizeState(s);
    if (isEmptyState(s)) {
      // Never adopt an empty state — it would wipe all the family's data.
      // If the server is empty (cold start / blobs unavailable), keep our
      // local copy and heal the server back up instead.
      if (state.version > 0) pushNow();
      return;
    }
    mergeFrom(s);
    serverVersion = state.version;
    writeCache();
    render();
  }
  function poll() {
    fetchState(handleServer);
  }

  // ---------- PIN ----------
  function tryUnlock() {
    if (String(el.pinInput.value) === String(state.settings.pin)) {
      el.pinScreen.classList.add('hidden');
      el.parentUI.classList.remove('hidden');
      el.pinHint.classList.add('hidden');
      el.pinInput.value = '';
      poll();
    } else {
      el.pinHint.classList.remove('hidden');
      el.pinInput.value = '';
      el.pinInput.focus();
    }
  }
  el.unlockBtn.addEventListener('click', tryUnlock);
  el.pinInput.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') tryUnlock(); });

  // ---------- boys ----------
  function renderBoys() {
    var html = '';
    state.boys.forEach(function (b) {
      html += '<span class="boy-chip">' + b.avatar + ' ' + esc(b.name) +
        ' · ⭐' + b.points +
        '<button class="del" data-del-boy="' + b.id + '" title="Delete">✕</button></span>';
    });
    if (!state.boys.length) html = '<div class="empty-note">No boys yet — add one below.</div>';
    el.boyList.innerHTML = html;
    var dels = el.boyList.querySelectorAll('[data-del-boy]');
    for (var i = 0; i < dels.length; i++) {
      (function (d) {
        d.addEventListener('click', function () { deleteBoy(d.getAttribute('data-del-boy')); });
      })(dels[i]);
    }
  }
  function addBoy() {
    var name = el.newBoyName.value.trim();
    if (!name) return;
    var id = uid();
    state.boys.push({
      id: id, name: name, avatar: AVATARS[state.boys.length % AVATARS.length],
      points: 0, streak: 0, lastDone: null, createdAt: Date.now()
    });
    el.newBoyName.value = '';
    save();
    if (!state.activeBoyId) state.activeBoyId = id;
  }
  function deleteBoy(id) {
    var boy = boyById(id);
    if (!boy) return;
    if (!window.confirm('Delete ' + boy.name + ' and all their quests?')) return;
    state.tasks = state.tasks.filter(function (t) { return t.boyId !== id; });
    state.goals = state.goals.filter(function (g) { return g.boyId !== id; });
    state.boys = state.boys.filter(function (b) { return b.id !== id; });
    if (state.activeBoyId === id) state.activeBoyId = state.boys.length ? state.boys[0].id : null;
    save();
  }

  // ---------- selects ----------
  function renderSelects() {
    var opts = '';
    state.boys.forEach(function (b) { opts += '<option value="' + b.id + '">' + b.avatar + ' ' + esc(b.name) + '</option>'; });
    el.boySelect.innerHTML = opts;
    el.goalBoySelect.innerHTML = opts;
    if (el.boySelect.value && !state.boys.some(function (b) { return b.id === el.boySelect.value; })) {
      el.boySelect.value = state.boys.length ? state.boys[0].id : '';
    }
    if (state.boys.length && !el.boySelect.value) {
      el.boySelect.value = state.boys[0].id;
      el.goalBoySelect.value = state.boys[0].id;
    }
    if (el.boySelect.value) el.goalBoySelect.value = el.boySelect.value;
  }

  // ---------- tasks ----------
  function renderTasks() {
    var bid = el.boySelect.value;
    var list = state.tasks.filter(function (t) { return t.boyId === bid; })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
    if (!list.length) {
      el.taskList.innerHTML = '<li class="empty">No quests yet for this boy.</li>';
      return;
    }
    var html = '';
    list.forEach(function (t) {
      var meta = t.points + '⭐';
      if (t.remindAt && t.remindEnabled) meta += ' ⏰' + t.remindAt;
      html += '<li class="task" data-id="' + t.id + '">' +
        '<button class="check' + (t.done ? ' done' : '') + '">' + (t.done ? '✓' : '') + '</button>' +
        '<span class="title' + (t.done ? ' done' : '') + '">' + esc(t.title) + '</span>' +
        '<span class="task-meta">' + meta + '</span>' +
        '<button class="del">✕</button>' +
      '</li>';
    });
    el.taskList.innerHTML = html;
    var items = el.taskList.querySelectorAll('.task');
    for (var i = 0; i < items.length; i++) {
      (function (li) {
        var id = li.getAttribute('data-id');
        li.querySelector('.check').addEventListener('click', function () { toggleTask(id); });
        li.querySelector('.del').addEventListener('click', function () { deleteTask(id); });
      })(items[i]);
    }
  }
  function addTask() {
    var title = el.pTitle.value.trim();
    if (!title || !el.boySelect.value) return;
    var pts = parseInt(el.pPoints.value, 10);
    if (isNaN(pts) || pts < 1) pts = 10;
    var at = el.pTime.value || null;
    state.tasks.push({
      id: uid(), boyId: el.boySelect.value, title: title, done: false,
      points: pts, remindAt: at, remindEnabled: !!(at && el.pRemind.checked),
      createdAt: Date.now(), completedAt: null, lastAnnounced: null, lastOverdueAt: null
    });
    el.pTitle.value = '';
    el.pTime.value = '';
    save();
  }
  function toggleTask(id) {
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id !== id) continue;
      var t = state.tasks[i];
      var boy = boyById(t.boyId);
      if (!t.done) {
        t.done = true; t.completedAt = Date.now();
        if (boy) boy.points += t.points;
      } else {
        t.done = false; t.completedAt = null;
        if (boy) { boy.points -= t.points; if (boy.points < 0) boy.points = 0; }
      }
      save();
      return;
    }
  }
  function deleteTask(id) {
    var idx = -1;
    for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].id === id) idx = i;
    if (idx >= 0) { state.tasks.splice(idx, 1); save(); }
  }

  // ---------- rewards ----------
  function renderRewards() {
    if (!state.rewards.length) {
      el.rewardList.innerHTML = '<div class="empty-note">No rewards yet. Add one above.</div>';
      return;
    }
    var html = '';
    state.rewards.forEach(function (r) {
      html += '<div class="list-item">' +
        '<span class="grow">' + r.emoji + ' ' + esc(r.name) + '</span>' +
        '<span class="meta">' + r.cost + '⭐</span>' +
        '<button class="del" data-del-reward="' + r.id + '">✕</button>' +
      '</div>';
    });
    el.rewardList.innerHTML = html;
    var dels = el.rewardList.querySelectorAll('[data-del-reward]');
    for (var i = 0; i < dels.length; i++) {
      (function (d) {
        d.addEventListener('click', function () {
          var id = d.getAttribute('data-del-reward');
          state.rewards = state.rewards.filter(function (r) { return r.id !== id; });
          save();
        });
      })(dels[i]);
    }
  }
  function addReward() {
    var name = el.rName.value.trim();
    if (!name) return;
    var cost = parseInt(el.rCost.value, 10);
    if (isNaN(cost) || cost < 1) cost = 100;
    var emoji = el.rEmoji.value.trim() || '🎁';
    state.rewards.push({ id: uid(), name: name, emoji: emoji, cost: cost });
    el.rName.value = '';
    el.rEmoji.value = '';
    save();
  }

  // ---------- goals ----------
  function renderGoals() {
    var bid = el.goalBoySelect.value;
    var list = state.goals.filter(function (g) { return g.boyId === bid; })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
    if (!list.length) {
      el.goalList.innerHTML = '<div class="empty-note">No goals for this boy.</div>';
      return;
    }
    var boy = boyById(bid);
    var pts = boy ? boy.points : 0;
    var html = '';
    list.forEach(function (g) {
      var pct = Math.min(100, Math.round((pts / g.target) * 100));
      var reached = pct >= 100;
      html += '<div class="list-item">' +
        '<div class="grow">' +
          '<div>' + esc(g.title) + ' <span class="meta">' + Math.min(pts, g.target) + '/' + g.target + ' pts</span></div>' +
          '<div class="goal-bar"><div class="fill' + (reached ? ' hit' : '') + '" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        (g.awarded ? '<span class="awarded">Awarded ✓</span>' :
          (reached ? '<button class="btn small award-btn" data-award="' + g.id + '">Award</button>' : '')) +
        '<button class="del" data-del-goal="' + g.id + '">✕</button>' +
      '</div>';
    });
    el.goalList.innerHTML = html;
    var awards = el.goalList.querySelectorAll('[data-award]');
    for (var i = 0; i < awards.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-award');
          for (var j = 0; j < state.goals.length; j++) {
            if (state.goals[j].id === id) { state.goals[j].awarded = true; state.goals[j].awardedAt = Date.now(); }
          }
          save();
        });
      })(awards[i]);
    }
    var dels = el.goalList.querySelectorAll('[data-del-goal]');
    for (var k = 0; k < dels.length; k++) {
      (function (d) {
        d.addEventListener('click', function () {
          var id = d.getAttribute('data-del-goal');
          state.goals = state.goals.filter(function (g) { return g.id !== id; });
          save();
        });
      })(dels[k]);
    }
  }
  function addGoal() {
    var title = el.gTitle.value.trim();
    if (!title || !el.goalBoySelect.value) return;
    var target = parseInt(el.gTarget.value, 10);
    if (isNaN(target) || target < 1) target = 1000;
    state.goals.push({
      id: uid(), boyId: el.goalBoySelect.value, title: title, target: target,
      awarded: false, notifiedReached: false, createdAt: Date.now()
    });
    el.gTitle.value = '';
    save();
  }

  // ---------- settings ----------
  function renderSettings() {
    el.voiceBtn.textContent = '🔊 Voice reminders: ' + (state.settings.voiceEnabled ? 'ON' : 'OFF');
    el.soundBtn.textContent = '🎵 Sounds: ' + (state.settings.soundEnabled ? 'ON' : 'OFF');
    el.voiceGenderBtn.textContent = '🗣 Voice: ' + (state.settings.voiceGender === 'man' ? 'Man 👨' : 'Woman 👩');
  }
  function savePin() {
    var v = el.newPin.value.trim();
    if (!/^\d{4}$/.test(v)) { el.newPin.value = ''; el.newPin.focus(); return; }
    state.settings.pin = v;
    el.newPin.value = '';
    save();
  }

  // ---------- render ----------
  function render() {
    renderBoys();
    renderSelects();
    renderTasks();
    renderRewards();
    renderGoals();
    renderSettings();
  }

  // ---------- events ----------
  el.addBoyBtn.addEventListener('click', addBoy);
  el.newBoyName.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') addBoy(); });
  el.pAddBtn.addEventListener('click', addTask);
  el.rAddBtn.addEventListener('click', addReward);
  el.gAddBtn.addEventListener('click', addGoal);
  el.boySelect.addEventListener('change', function () { el.goalBoySelect.value = el.boySelect.value; renderTasks(); renderGoals(); });
  el.goalBoySelect.addEventListener('change', function () { el.boySelect.value = el.goalBoySelect.value; renderTasks(); renderGoals(); });
  el.voiceBtn.addEventListener('click', function () { state.settings.voiceEnabled = !state.settings.voiceEnabled; save(); });
  el.soundBtn.addEventListener('click', function () { state.settings.soundEnabled = !state.settings.soundEnabled; save(); });
  el.voiceGenderBtn.addEventListener('click', function () {
    state.settings.voiceGender = state.settings.voiceGender === 'man' ? 'woman' : 'man';
    save();
  });
  el.savePinBtn.addEventListener('click', savePin);
  el.resetBtn.addEventListener('click', function () {
    if (!window.confirm('Delete ALL boys, quests, rewards and goals?')) return;
    state = normalizeState({ settings: { voiceEnabled: true, soundEnabled: true, pin: state.settings.pin } });
    save();
  });

  // ---------- boot ----------
  // Load the local copy first so a refresh or offline open never shows (or
  // worse, writes back) an empty state. Then sync with the server.
  var cached = loadCache();
  if (cached) { state = cached; serverVersion = cached.version || 0; }
  fetchState(handleServer);
  setInterval(function () {
    if (!el.parentUI.classList.contains('hidden')) poll();
  }, 8000);
})();
