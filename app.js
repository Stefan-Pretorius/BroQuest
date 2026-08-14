(function () {
  'use strict';

  var LS_KEY = 'bro_quest_v1';
  var PALETTE = ['#ff4d6d', '#ff9f1c', '#2ec4b6', '#9b5de5', '#00bbf9', '#f15bb5'];
  var AVATARS = ['🦁', '🐺', '🦅', '🐯', '🦈', '🐲', '🚀', '⚡', '🏀', '🎮', '🥷', '🤖', '🔥', '💪'];
  var LEVEL_TITLES = ['Rookie', 'Apprentice', 'Grinder', 'Go-Getter', 'Superstar', 'Legend', 'Boss', 'Demigod'];

  var state = loadState();
  var serverVersion = state.version || 0;
  var pushTimer = null;
  var selectedAvatar = AVATARS[0];
  var actx = null;
  var primed = false;
  var toastTimer = null;

  // ---------- dom refs ----------
  var el = {};
  ['tabs', 'clock', 'voiceBtn', 'soundBtn', 'board', 'hero', 'heroAdd', 'boyCard',
   'taskForm', 'titleInput', 'pointsInput', 'timeInput', 'remindCheck', 'addBtn',
   'taskList', 'shop', 'doneSection', 'doneList', 'toast', 'modal', 'newBoyName', 'avatarPicker',
   'cancelBoy', 'confirmBoy'].forEach(function (id) { el[id] = document.getElementById(id); });

  // ---------- state ----------
  function defaultState() {
    return { version: 0, boys: [], tasks: [], rewards: [], goals: [], settings: { voiceEnabled: true, soundEnabled: true, pin: '2468', voiceGender: 'woman' }, activeBoyId: null };
  }
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
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch (e) {}
    return defaultState();
  }
  function saveState() {
    state.version = Date.now();
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    syncPush();
  }

  // ---------- server sync (XHR — fetch doesn't exist on iOS 9) ----------
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
  function pushNow() {
    clearTimeout(pushTimer);
    httpRequest('POST', '/api/state', JSON.stringify({ state: state }), function () {}, function () {});
  }
  function syncPush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 500);
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
  function adoptServer(s) {
    var prev = {};
    state.goals.forEach(function (g) { prev[g.id] = !!g.awarded; });
    s = normalizeState(s);
    if (isEmptyState(s)) {
      // Never adopt an empty state — it would wipe all the family's data.
      // If the server is empty (cold start / blobs unavailable), keep our
      // local copy and heal the server back up instead.
      serverVersion = state.version;
      pushNow();
      return;
    }
    mergeFrom(s);
    serverVersion = state.version;
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    render();
    pushNow();
    state.goals.forEach(function (g) {
      if (g.awarded && prev[g.id] !== true && prev[g.id] !== undefined) {
        var boy = boyById(g.boyId);
        if (boy) {
          burst(Math.round(window.innerWidth / 2), 180, 90);
          speakNow('Great news! ' + boy.name + ' earned the goal: ' + g.title + '!');
          toast('🎯 ' + boy.name + ' earned: ' + g.title + '!');
        }
      }
    });
  }
  function syncPoll() {
    httpRequest('GET', '/api/state', null, function (s) {
      if (!s) return;
      s = normalizeState(s);
      if (s.version > serverVersion) {
        adoptServer(s);
      } else if (s.version === 0 && state.version > 0) {
        pushNow();
      }
    }, function () {});
  }
  function uid() { return 'id' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function yesterdayStr() { var d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function boyById(id) { for (var i = 0; i < state.boys.length; i++) { if (state.boys[i].id === id) return state.boys[i]; } return null; }
  function taskById(id) { for (var i = 0; i < state.tasks.length; i++) { if (state.tasks[i].id === id) return state.tasks[i]; } return null; }
  function tasksFor(boyId, done) {
    return state.tasks.filter(function (t) { return t.boyId === boyId && !!t.done === done; })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
  }
  function hasOpen(boyId) { return state.tasks.some(function (t) { return t.boyId === boyId && !t.done; }); }
  function boyColor(boy) { return PALETTE[state.boys.indexOf(boy) % PALETTE.length]; }
  function levelInfo(pts) {
    var lvl = Math.floor(pts / 100) + 1;
    var base = (lvl - 1) * 100;
    var pct = Math.min(100, Math.round(((pts - base) / 100) * 100));
    var title = LEVEL_TITLES[Math.min(lvl - 1, LEVEL_TITLES.length - 1)];
    return { lvl: lvl, title: title, pct: pct };
  }
  function markStreak(boy) {
    var t = todayStr();
    if (boy.lastDone === t) return;
    boy.streak = (boy.lastDone === yesterdayStr()) ? ((boy.streak || 0) + 1) : 1;
    boy.lastDone = t;
  }
  function currentGoal(boy) {
    for (var i = 0; i < state.goals.length; i++) {
      if (state.goals[i].boyId === boy.id && !state.goals[i].awarded) return state.goals[i];
    }
    return null;
  }
  function goalProgress(g) {
    var boy = boyById(g.boyId);
    var pts = boy ? boy.points : 0;
    return Math.min(100, Math.round((pts / g.target) * 100));
  }

  // ---------- audio ----------
  function initAudio() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended' && actx.resume) actx.resume();
    } catch (e) {}
  }
  function tone(freq, start, dur, type) {
    if (!actx || !state.settings.soundEnabled) return;
    try {
      var t = actx.currentTime + start;
      var o = actx.createOscillator();
      var g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(actx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  function sfxAdd() { tone(660, 0, 0.09, 'square'); }
  function sfxComplete() { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.2, 'triangle'); }); }
  function sfxDelete() { tone(220, 0, 0.14, 'sawtooth'); }
  function sfxLevelUp() {
    [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.08, 0.22, 'triangle'); });
    tone(1319, 0.45, 0.4, 'sine');
  }

  // ---------- speech (iOS needs priming after a tap) ----------
  // iOS quirk: speech only works after a user gesture, the first real
  // utterance must come a moment AFTER the unlock gesture, and the queue
  // can silently stall. So we prime on the first tap (capture phase so it
  // runs before any button handler), delay the first real utterance, and
  // run everything through a watchdog-protected queue with cancel() resets.
  var primeTime = 0;
  var speakQueue = [];
  var speaking = false;
  function primeSpeech() {
    if (primed || !('speechSynthesis' in window)) return;
    primed = true;
    primeTime = Date.now();
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(' ');
      u.volume = 1;
      window.speechSynthesis.speak(u);
      window.speechSynthesis.resume();
    } catch (e) {}
  }
  function pickVoice(wantMan) {
    try {
      var vs = window.speechSynthesis.getVoices();
      if (!vs || !vs.length) return null;
      var i, n;
      for (i = 0; i < vs.length; i++) {
        n = vs[i].name.toLowerCase();
        if (wantMan && n.indexOf('daniel') >= 0) return vs[i];
        if (!wantMan && (n.indexOf('samantha') >= 0 || n.indexOf('victoria') >= 0)) return vs[i];
      }
      for (i = 0; i < vs.length; i++) {
        n = vs[i].name.toLowerCase();
        if (wantMan && n.indexOf('male') >= 0) return vs[i];
        if (!wantMan && n.indexOf('female') >= 0) return vs[i];
      }
    } catch (e) {}
    return null;
  }
  function flushQueue() {
    if (speaking || !speakQueue.length) return;
    var text = speakQueue.shift();
    speaking = true;
    var watchdog = setTimeout(function () { speaking = false; flushQueue(); }, Math.max(5000, text.length * 130));
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.volume = 1;  // iOS quirk: volume must be set or first utterance is silent
      u.rate = 0.95;
      u.pitch = 1.05;
      var pick = pickVoice(state.settings.voiceGender === 'man');
      if (pick) u.voice = pick;
      var done = function () {
        clearTimeout(watchdog);
        speaking = false;
        setTimeout(flushQueue, 150);
      };
      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
      window.speechSynthesis.resume();
    } catch (e) {
      clearTimeout(watchdog);
      speaking = false;
      flushQueue();
    }
  }
  function speakNow(text) {
    if (!state.settings.voiceEnabled || !('speechSynthesis' in window)) return;
    if (!primed) primeSpeech();
    // iOS drops utterances spoken in the same instant as the unlock gesture;
    // hold the first one back so the audio session has time to come up.
    var age = Date.now() - primeTime;
    if (age < 600) {
      setTimeout(function () { speakNow(text); }, 700 - age);
      return;
    }
    if (speakQueue.length < 8) speakQueue.push(String(text));
    flushQueue();
  }

  // ---------- confetti (DOM bits — a full-screen fixed <canvas> can blank
  // the page on old iOS, so we never put one over the content) ----------
  function burst(x, y, n) {
    var colors = ['#ff4d6d', '#ff9f1c', '#ffd166', '#2ec4b6', '#9b5de5', '#00bbf9', '#f15bb5'];
    var count = Math.min(n, 26);
    for (var i = 0; i < count; i++) {
      var d = document.createElement('div');
      d.className = 'fx-bit';
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      d.style.background = colors[(Math.random() * colors.length) | 0];
      var tx = (Math.random() * 160 - 80);
      var ty = (Math.random() * 160 - 40) + 40;
      var deg = (Math.random() * 720 - 360) | 0;
      (function (node) {
        setTimeout(function () {
          node.style.webkitTransition = 'transform .75s ease-out, opacity .75s ease-out';
          node.style.webkitTransform = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + deg + 'deg)';
          node.style.opacity = '0';
        }, 10);
        setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 820);
      })(d);
    }
  }
  function floatPts(x, y, text) {
    var d = document.createElement('div');
    d.className = 'float-pts';
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 950);
  }

  // ---------- toast ----------
  function toast(msg, undoFn) {
    el.toast.innerHTML = '<span></span>';
    var span = el.toast.querySelector('span');
    span.textContent = msg;
    if (undoFn) {
      var b = document.createElement('button');
      b.textContent = 'Undo';
      b.addEventListener('click', function () { undoFn(); hideToast(); });
      el.toast.appendChild(b);
    }
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
  }
  function hideToast() { el.toast.classList.add('hidden'); }

  // ---------- boys ----------
  function addBoy(name, avatar) {
    var id = uid();
    state.boys.push({
      id: id, name: name, avatar: avatar || AVATARS[0],
      points: 0, streak: 0, lastDone: null, createdAt: Date.now()
    });
    state.activeBoyId = id;
    saveState();
    render();
  }
  function deleteBoy(id) {
    var boy = boyById(id);
    if (!boy) return;
    if (!window.confirm('Delete ' + boy.name + ' and all their quests?')) return;
    state.tasks = state.tasks.filter(function (t) { return t.boyId !== id; });
    state.boys = state.boys.filter(function (b) { return b.id !== id; });
    if (state.activeBoyId === id) state.activeBoyId = state.boys.length ? state.boys[0].id : null;
    saveState();
    render();
  }

  // ---------- tasks ----------
  function speakTime(hm) {
    var p = hm.split(':');
    var h = +p[0];
    var m = +p[1];
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + (m ? ':' + pad(m) : '') + ' ' + ap;
  }
  function addTask() {
    var title = el.titleInput.value.trim();
    if (!title) return;
    var hr = new Date().getHours();
    if (hr >= 22 || hr < 6) {
      toast('😴 Quest time is 6 AM – 10 PM. Go to sleep, bro!');
      return;
    }
    var pts = parseInt(el.pointsInput.value, 10);
    if (isNaN(pts) || pts < 1) pts = 10;
    if (pts > 100) pts = 100;
    var at = el.timeInput.value || null;
    var willSpeak = !!(at && el.remindCheck.checked);
    state.tasks.push({
      id: uid(), boyId: state.activeBoyId, title: title, done: false,
      points: pts, remindAt: at, remindEnabled: willSpeak,
      createdAt: Date.now(), completedAt: null, lastAnnounced: null, lastOverdueAt: null
    });
    el.titleInput.value = '';
    el.timeInput.value = '';
    el.remindCheck.checked = true;
    saveState();
    render();
    sfxAdd();
    if (willSpeak) {
      speakNow('Got it! I will remind you about ' + title + ' at ' + speakTime(at) + '.');
    }
    el.titleInput.focus();
  }
  function toggleTask(id, x, y) {
    var t = taskById(id);
    if (!t) return;
    if (!t.done) {
      var boy = boyById(t.boyId);
      var oldLevel = boy ? levelInfo(boy.points).lvl : 1;
      t.done = true;
      t.completedAt = Date.now();
      if (boy) {
        boy.points += t.points;
        markStreak(boy);
        state.goals.forEach(function (g) {
          if (g.boyId === boy.id && !g.awarded && !g.notifiedReached && boy.points >= g.target) {
            g.notifiedReached = true;
            setTimeout(function () {
              speakNow('You reached your goal, ' + boy.name + ': ' + g.title + '! Tell a parent to award it!');
              toast('🎯 ' + boy.name + ' reached the goal: ' + g.title + '!');
            }, 900);
          }
        });
        saveState();
        burst(x, y, 80);
        setTimeout(function () { burst(x, y, 60); }, 240);
        sfxComplete();
        floatPts(x, y - 10, '+' + t.points);
        bounceAvatar();
        var info = levelInfo(boy.points);
        if (info.lvl > oldLevel) {
          sfxLevelUp();
          setTimeout(function () {
            toast(boy.name + ' leveled up! Now Level ' + info.lvl + ' — ' + info.title + ' 🏆');
          }, 450);
        } else if (!hasOpen(boy.id)) {
          setTimeout(function () {
            speakNow('Amazing, ' + boy.name + '! All quests complete. You are a legend!');
            toast('🏆 All quests done, ' + boy.name + '!');
          }, 600);
        }
        render();
      }
    } else {
      t.done = false;
      t.completedAt = null;
      var b2 = boyById(t.boyId);
      if (b2) { b2.points -= t.points; if (b2.points < 0) b2.points = 0; }
      saveState();
      render();
    }
  }
  function deleteTask(id) {
    var t = taskById(id);
    if (!t) return;
    var idx = state.tasks.indexOf(t);
    state.tasks.splice(idx, 1);
    saveState();
    render();
    sfxDelete();
    toast('Quest deleted', function () { state.tasks.push(t); saveState(); render(); });
  }

  // ---------- settings ----------
  function toggleVoice() {
    state.settings.voiceEnabled = !state.settings.voiceEnabled;
    saveState();
    render();
    if (state.settings.voiceEnabled) speakNow('Voice reminders are on! This is BroQuest speaking. Add a time to a quest and I will remind you.');
  }
  function toggleSound() {
    state.settings.soundEnabled = !state.settings.soundEnabled;
    if (!actx) initAudio();
    saveState();
    render();
    if (state.settings.soundEnabled) sfxAdd();
  }

  // ---------- reminders ----------
  function toMin(hm) { var p = hm.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function reminderTick() {
    if (!state.settings.voiceEnabled) return;
    var now = new Date();
    var hm = hhmm(now);
    var day = todayStr();
    var due = {};
    var over = {};
    var changed = false;
    state.tasks.forEach(function (t) {
      if (t.done || !t.remindAt || !t.remindEnabled) return;
      if (t.remindAt === hm && t.lastAnnounced !== day) {
        t.lastAnnounced = day;
        (due[t.boyId] = due[t.boyId] || []).push(t);
        changed = true;
      }
      var diff = toMin(hm) - toMin(t.remindAt);
      if (diff >= 30 && (!t.lastOverdueAt || now.getTime() - t.lastOverdueAt >= 3600000)) {
        t.lastOverdueAt = now.getTime();
        (over[t.boyId] = over[t.boyId] || []).push(t);
        changed = true;
      }
    });
    Object.keys(due).forEach(function (id) {
      var boy = boyById(id);
      if (!boy) return;
      var titles = due[id].map(function (t) { return t.title; }).join(', ');
      speakNow('Hey ' + boy.name + '! Time for a quest: ' + titles + '.');
    });
    Object.keys(over).forEach(function (id) {
      var boy = boyById(id);
      if (!boy) return;
      var titles = over[id].map(function (t) { return t.title; }).join(', ');
      speakNow(boy.name + ', these quests are still waiting for you: ' + titles + '. Get it done, bro!');
    });
    if (changed) saveState();
  }
  setInterval(reminderTick, 20000);

  // ---------- render ----------
  function render() {
    var boy = boyById(state.activeBoyId);
    el.voiceBtn.textContent = state.settings.voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF';
    el.voiceBtn.title = state.settings.voiceEnabled ? 'Voice reminders ON' : 'Voice reminders OFF';
    el.soundBtn.textContent = state.settings.soundEnabled ? '🎵' : '🚫';
    el.soundBtn.title = state.settings.soundEnabled ? 'Sounds ON' : 'Sounds OFF';
    renderTabs();
    if (!boy) {
      el.hero.classList.remove('hidden');
      el.boyCard.classList.add('hidden');
      el.taskForm.classList.add('hidden');
      el.taskList.innerHTML = '';
      el.doneSection.classList.add('hidden');
      el.doneList.innerHTML = '';
      return;
    }
    el.hero.classList.add('hidden');
    el.board.style.setProperty('--accent', boyColor(boy));
    renderBoyCard(boy);
    el.taskForm.classList.remove('hidden');
    renderTasks(boy);
    renderShop(boy);
  }
  function renderTabs() {
    var html = '';
    state.boys.forEach(function (b) {
      var active = b.id === state.activeBoyId;
      html += '<button class="tab' + (active ? ' active' : '') + '" data-boy="' + b.id + '" style="--accent:' + boyColor(b) + '">' +
        '<span class="ava">' + b.avatar + '</span>' + esc(b.name) + '</button>';
    });
    html += '<button class="tab tab-add" id="addBoyBtn">＋</button>';
    el.tabs.innerHTML = html;
  }
  function renderBoyCard(boy) {
    var info = levelInfo(boy.points);
    el.boyCard.innerHTML =
      '<div class="boy-top">' +
        '<div class="avatar">' + boy.avatar + '</div>' +
        '<div class="boy-info">' +
          '<h2>' + esc(boy.name) + '</h2>' +
          '<div class="stats">⭐ ' + boy.points + ' pts · Lv ' + info.lvl + ' ' + info.title +
          (boy.streak > 1 ? ' · 🔥 ' + boy.streak + '-day streak' : '') + '</div>' +
        '</div>' +
        '<button class="icon-btn del-boy" id="delBoyBtn" title="Delete brother">🗑</button>' +
      '</div>' +
      '<div class="level-bar"><div class="level-fill" style="width:' + info.pct + '%"></div></div>' +
      '<div class="level-caption">Next level in ' + Math.max(0, 100 - (boy.points % 100)) + ' pts → ' +
        LEVEL_TITLES[Math.min(info.lvl, LEVEL_TITLES.length - 1)] + '</div>';
    var g = currentGoal(boy);
    if (g) {
      var gp = goalProgress(g);
      var reached = gp >= 100;
      el.boyCard.innerHTML +=
        '<div class="goal-box">' +
          '<div class="goal-row"><span>🎯 ' + esc(g.title) + '</span><span>' + Math.min(boy.points, g.target) + '/' + g.target + ' pts</span></div>' +
          '<div class="level-bar"><div class="level-fill' + (reached ? ' goal-hit' : '') + '" style="width:' + gp + '%"></div></div>' +
          (reached ? '<div class="goal-note">🏆 Goal reached! Get a parent to award it.</div>' : '') +
        '</div>';
    }
    var db = document.getElementById('delBoyBtn');
    if (db) db.addEventListener('click', function () { deleteBoy(boy.id); });
  }
  function bounceAvatar() {
    var av = el.boyCard.querySelector('.avatar');
    if (!av) return;
    av.classList.remove('bounce');
    void av.offsetWidth;
    av.classList.add('bounce');
  }
  function renderTasks(boy) {
    var open = tasksFor(boy.id, false);
    var done = tasksFor(boy.id, true).slice(-30).reverse();
    if (open.length) {
      var html = '';
      open.forEach(function (t) { html += taskHtml(t, false); });
      el.taskList.innerHTML = html;
      bindTasks(el.taskList, false);
    } else {
      el.taskList.innerHTML = '<li class="empty">Nothing on the list — add a quest below! 🎯</li>';
    }
    if (done.length) {
      el.doneSection.classList.remove('hidden');
      el.doneList.innerHTML = done.map(function (t) { return taskHtml(t, true); }).join('');
      bindTasks(el.doneList, true);
    } else {
      el.doneSection.classList.add('hidden');
      el.doneList.innerHTML = '';
    }
  }
  function taskHtml(t, done) {
    var meta = '';
    if (t.points) meta += t.points + '⭐';
    if (t.remindAt && t.remindEnabled) meta += ' ⏰' + t.remindAt;
    return '<li class="task" data-id="' + t.id + '">' +
      '<button class="check' + (done ? ' done' : '') + '" title="' + (done ? 'Un-tick' : 'Tick off') + '">' + (done ? '✓' : '') + '</button>' +
      '<span class="title' + (done ? ' done' : '') + '">' + esc(t.title) + '</span>' +
      (meta ? '<span class="task-meta">' + meta + '</span>' : '') +
      '<button class="del" title="Delete">✕</button>' +
    '</li>';
  }
  function bindTasks(list, done) {
    var items = list.querySelectorAll('.task');
    for (var i = 0; i < items.length; i++) {
      (function (li) {
        var id = li.getAttribute('data-id');
        li.querySelector('.check').addEventListener('click', function (ev) {
          toggleTask(id, ev.clientX, ev.clientY);
        });
        li.querySelector('.del').addEventListener('click', function () {
          deleteTask(id);
        });
      })(items[i]);
    }
  }

  // ---------- reward shop ----------
  function rewardById(id) {
    for (var i = 0; i < state.rewards.length; i++) if (state.rewards[i].id === id) return state.rewards[i];
    return null;
  }
  function renderShop(boy) {
    if (!state.rewards.length) {
      el.shop.classList.remove('hidden');
      el.shop.innerHTML = '<h2>🏆 Reward Shop</h2><div class="empty">No rewards yet — parents can add them on the ⚙️ page.</div>';
      return;
    }
    el.shop.classList.remove('hidden');
    var html = '<h2>🏆 Reward Shop</h2><div class="shop-grid">';
    state.rewards.forEach(function (r) {
      var afford = boy.points >= r.cost;
      html += '<div class="reward' + (afford ? '' : ' locked') + '" data-id="' + r.id + '">' +
        '<span class="r-emoji">' + r.emoji + '</span>' +
        '<span class="r-name">' + esc(r.name) + '</span>' +
        '<button class="btn r-claim"' + (afford ? '' : ' disabled') + '>' + r.cost + '⭐</button>' +
      '</div>';
    });
    html += '</div>';
    el.shop.innerHTML = html;
    var btns = el.shop.querySelectorAll('.r-claim');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          claimReward(b.parentNode.getAttribute('data-id'));
        });
      })(btns[i]);
    }
  }
  function claimReward(rid) {
    var boy = boyById(state.activeBoyId);
    var rw = rewardById(rid);
    if (!boy || !rw || boy.points < rw.cost) return;
    boy.points -= rw.cost;
    sfxLevelUp();
    burst(Math.round(window.innerWidth / 2), 200, 90);
    speakNow(boy.name + ' cashed in ' + rw.name + ' for ' + rw.cost + ' points. Enjoy!');
    toast('🎉 ' + boy.name + ' claimed ' + rw.name + '!');
    saveState();
    render();
  }

  // ---------- modal ----------
  function openModal() {
    el.modal.classList.remove('hidden');
    el.newBoyName.value = '';
    renderAvatars();
    setTimeout(function () { el.newBoyName.focus(); }, 50);
  }
  function closeModal() { el.modal.classList.add('hidden'); }
  function renderAvatars() {
    var html = '';
    AVATARS.forEach(function (a) {
      html += '<button type="button" class="' + (a === selectedAvatar ? 'selected' : '') + '" data-ava="' + a + '">' + a + '</button>';
    });
    el.avatarPicker.innerHTML = html;
    var btns = el.avatarPicker.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          selectedAvatar = b.getAttribute('data-ava');
          renderAvatars();
        });
      })(btns[i]);
    }
  }
  function confirmBoyAdd() {
    var name = el.newBoyName.value.trim();
    if (!name) return;
    addBoy(name, selectedAvatar);
    closeModal();
  }

  // ---------- events ----------
  // iOS 9 has no Element.closest — walk up the parents by attribute instead.
  function parentWithAttr(node, attr) {
    var n = node;
    while (n && n.getAttribute) {
      if (n.getAttribute(attr) !== null) return n;
      n = n.parentNode;
    }
    return null;
  }
  el.tabs.addEventListener('click', function (ev) {
    var target = ev.target;
    var boyTab = parentWithAttr(target, 'data-boy');
    if (boyTab) {
      state.activeBoyId = boyTab.getAttribute('data-boy');
      saveState();
      render();
      return;
    }
    var addBtn = parentWithAttr(target, 'id');
    if ((addBtn && addBtn.id === 'addBoyBtn') || target.id === 'addBoyBtn') openModal();
  });
  el.taskForm.addEventListener('submit', function (ev) { ev.preventDefault(); addTask(); });
  el.voiceBtn.addEventListener('click', toggleVoice);
  el.soundBtn.addEventListener('click', toggleSound);
  el.confirmBoy.addEventListener('click', confirmBoyAdd);
  el.cancelBoy.addEventListener('click', closeModal);
  el.heroAdd.addEventListener('click', openModal);
  el.newBoyName.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') confirmBoyAdd(); });

  // iOS: unlock audio + speech on the very first touch/click (capture phase,
  // so priming runs before any button handler on that first tap)
  function primeGesture() { primeSpeech(); initAudio(); }
  document.addEventListener('touchstart', primeGesture, { capture: true, once: true });
  document.addEventListener('click', primeGesture, { capture: true, once: true });

  // ---------- boot ----------
  setInterval(tickClock, 1000);
  function tickClock() { el.clock.textContent = hhmm(new Date()); }
  render();

  // one-time hint: iOS only unlocks speech/sound after the first tap
  if (state.settings.voiceEnabled && !localStorage.getItem('bro_quest_hint')) {
    localStorage.setItem('bro_quest_hint', '1');
    setTimeout(function () {
      toast('👆 Tap anywhere once to unlock voice & sounds (iOS rule) — then press 🔊 Voice to hear it.');
    }, 1500);
  }

  // keep in sync with the server (parent page, other devices)
  syncPoll();
  setInterval(syncPoll, 8000);
  window.addEventListener('pagehide', pushNow);
})();
