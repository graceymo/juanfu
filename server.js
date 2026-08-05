const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3456;

// Increase body size limit for image uploads (base64)
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Database ────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'data', 'health.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar_color TEXT DEFAULT '#378ADD',
    height REAL,
    weight REAL,
    body_fat REAL,
    body_data_public INTEGER DEFAULT 0,
    notify_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS circles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS circle_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    circle_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(circle_id, user_id),
    FOREIGN KEY (circle_id) REFERENCES circles(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    circle_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    exercise_type TEXT NOT NULL,
    duration_minutes REAL DEFAULT 0,
    distance REAL,
    reps INTEGER,
    pace TEXT,
    incline REAL,
    manual_calories REAL,
    points REAL NOT NULL,
    image_url TEXT,
    notes TEXT DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (circle_id) REFERENCES circles(id)
  );

  CREATE TABLE IF NOT EXISTS diets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    circle_id INTEGER NOT NULL,
    food_type TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    penalty REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (circle_id) REFERENCES circles(id)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    circle_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    exercise_target REAL,
    exercise_target_type TEXT DEFAULT 'points',
    diet_limit INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(user_id, circle_id, week_start),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (circle_id) REFERENCES circles(id)
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    circle_id INTEGER NOT NULL,
    content TEXT DEFAULT '',
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (circle_id) REFERENCES circles(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id INTEGER,
    related_type TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS shared_posts (
    id TEXT PRIMARY KEY,
    author_name TEXT NOT NULL,
    author_emoji TEXT NOT NULL,
    content TEXT NOT NULL,
    image TEXT,
    circle_id TEXT NOT NULL,
    circle_ids_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shared_post_likes (
    post_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, user_name),
    FOREIGN KEY (post_id) REFERENCES shared_posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shared_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    parent_comment_id TEXT,
    user_name TEXT NOT NULL,
    user_emoji TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES shared_posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shared_comment_likes (
    comment_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (comment_id, user_name),
    FOREIGN KEY (comment_id) REFERENCES shared_comments(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_shared_posts_updated_at ON shared_posts(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_shared_comments_post ON shared_comments(post_id, created_at ASC);
`);

// ── Constants ───────────────────────────────────────────────────

// Gym exercises: points per rep
const GYM_EXERCISES = {
  ab_wheel:       { label: '卷腹轮',         pts_per_rep: 2 },
  bulgarian_squat:{ label: '保加利亚蹲',     pts_per_rep: 1.5 },
  romanian_dl:    { label: '罗马尼亚硬拉',   pts_per_rep: 2 },
  dead_bug:       { label: '死虫式',         pts_per_rep: 1 },
  ab_roller:      { label: '健腹轮',         pts_per_rep: 2 },
  burpee:         { label: '波比跳',         pts_per_rep: 3 },
  pushup:         { label: '俯卧撑',         pts_per_rep: 1 },
  pullup:         { label: '引体向上',       pts_per_rep: 3 },
  squat:          { label: '深蹲',           pts_per_rep: 1.5 },
  glute_bridge:   { label: '臀桥',           pts_per_rep: 1 },
  plank:          { label: '平板支撑(min)',  pts_per_min: 12 },
  russian_twist:  { label: '俄罗斯转体',     pts_per_rep: 1 },
  mountain_climber:{ label: '登山者',        pts_per_rep: 1.5 },
  kettlebell:     { label: '壶铃摇摆',       pts_per_rep: 2 },
  lunge:          { label: '弓步蹲',         pts_per_rep: 1.5 },
  crunch:         { label: '卷腹',           pts_per_rep: 1 },
  leg_raise:      { label: '悬垂举腿',       pts_per_rep: 2.5 },
};

// Cardio machines: MET values
const CARDIO_MACHINES = {
  treadmill:   { label: '跑步机',   met: 8 },
  stair_climber:{ label: '爬楼机',   met: 9 },
  elliptical:  { label: '椭圆机',   met: 5 },
  rowing:      { label: '划船机',   met: 7 },
  stationary_bike:{ label: '动感单车', met: 8.5 },
};

// Sports: manual input (calories from watch)
const SPORTS = [
  '瑜伽', '普拉提', '攀岩', '越野跑', '马拉松', '室外跑',
  'Hyrox', '游泳', '骑行', '徒步', '综合格斗', '舞蹈',
  'CrossFit', '网球', '羽毛球', '足球', '篮球', '其他'
];

const DIET_PENALTY_PER_ITEM = 10;

const FOOD_TYPES = {
  milk_tea:      '奶茶',
  fruit_tea:     '果茶',
  sweet_coffee:  '加糖咖啡',
  fried_chicken: '炸鸡',
  bbq:           '烧烤',
  dessert:       '甜品蛋糕',
  chips:         '薯片零食',
  instant_noodles:'方便面',
  beer:          '啤酒',
  soda:          '碳酸饮料',
  ice_cream:     '冰淇淋',
  pizza:         '披萨',
  hotpot:        '火锅(过量)',
  burger:        '汉堡',
  other:         '其他',
};

// ── Helpers ─────────────────────────────────────────────────────
const fmtLocal = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const todayStr = () => fmtLocal(new Date());

const getWeekStart = dateStr => {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return fmtLocal(d);
};

const genInviteCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

const createNotification = (userId, type, message, relatedId = null, relatedType = null) => {
  db.prepare('INSERT INTO notifications (user_id, type, message, related_id, related_type) VALUES (?,?,?,?,?)')
    .run(userId, type, message, relatedId, relatedType);
};

const notifyCircle = (circleId, excludeUserId, type, message, relatedId, relatedType) => {
  const members = db.prepare(
    'SELECT cm.user_id FROM circle_members cm JOIN users u ON cm.user_id=u.id WHERE cm.circle_id=? AND cm.user_id!=? AND u.notify_enabled=1'
  ).all(circleId, excludeUserId);
  const stmt = db.prepare('INSERT INTO notifications (user_id, type, message, related_id, related_type) VALUES (?,?,?,?,?)');
  for (const m of members) {
    stmt.run(m.user_id, type, message, relatedId, relatedType);
  }
};

const nowISO = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseCircleIds = (value, fallbackCircleId) => {
  let ids = [];
  if (Array.isArray(value)) ids = value;
  else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) ids = parsed;
    } catch {
      ids = [];
    }
  }
  if (ids.length === 0 && fallbackCircleId) ids = [fallbackCircleId];
  return [...new Set(ids.filter(Boolean))];
};

const buildSharedPostView = (post, viewerName) => {
  const likes = db.prepare('SELECT user_name FROM shared_post_likes WHERE post_id=?').all(post.id);
  const comments = db.prepare('SELECT * FROM shared_comments WHERE post_id=? ORDER BY created_at ASC').all(post.id);
  const commentLikeRows = db.prepare(
    'SELECT comment_id, user_name FROM shared_comment_likes WHERE comment_id IN (SELECT id FROM shared_comments WHERE post_id=?)'
  ).all(post.id);

  const commentLikeMap = new Map();
  for (const row of commentLikeRows) {
    if (!commentLikeMap.has(row.comment_id)) commentLikeMap.set(row.comment_id, new Set());
    commentLikeMap.get(row.comment_id).add(row.user_name);
  }

  const commentNodeById = new Map();
  comments.forEach(c => {
    const likedSet = commentLikeMap.get(c.id) || new Set();
    commentNodeById.set(c.id, {
      id: c.id,
      name: c.user_name,
      emoji: c.user_emoji,
      content: c.content,
      createdAt: c.created_at,
      time: '刚刚',
      likes: likedSet.size,
      liked: viewerName ? likedSet.has(viewerName) : false,
      replies: []
    });
  });

  const commentsList = [];
  comments.forEach(c => {
    const node = commentNodeById.get(c.id);
    if (c.parent_comment_id && commentNodeById.has(c.parent_comment_id)) {
      commentNodeById.get(c.parent_comment_id).replies.push(node);
    } else {
      commentsList.push(node);
    }
  });

  const likeSet = new Set(likes.map(x => x.user_name));
  const circleIds = parseCircleIds(post.circle_ids_json, post.circle_id);

  return {
    id: post.id,
    circleId: post.circle_id,
    circleIds,
    name: post.author_name,
    emoji: post.author_emoji,
    content: post.content,
    image: post.image,
    createdAt: post.created_at,
    time: '刚刚',
    likes: likeSet.size,
    liked: viewerName ? likeSet.has(viewerName) : false,
    commentsList
  };
};

const listSharedPostsByCircle = (circleId, viewerName, limit = 100) => {
  const posts = db.prepare('SELECT * FROM shared_posts ORDER BY updated_at DESC LIMIT ?').all(limit * 3);
  const filtered = posts.filter(p => parseCircleIds(p.circle_ids_json, p.circle_id).includes(circleId));
  return filtered.slice(0, limit).map(p => buildSharedPostView(p, viewerName));
};

// ── Exercise points calculation ─────────────────────────────────
const calcPoints = (category, type, body, duration, reps, pace, incline, manualCals) => {
  const weight = body.weight || 65;
  if (category === 'gym') {
    const ex = GYM_EXERCISES[type];
    if (!ex) return 0;
    if (type === 'plank') return Math.round(ex.pts_per_min * (duration || 0));
    return Math.round(ex.pts_per_rep * (reps || 0));
  }
  if (category === 'cardio') {
    const m = CARDIO_MACHINES[type];
    if (!m) return 0;
    let pts = Math.round(m.met * weight * ((duration || 30) / 60));
    // Pace bonus: faster = more points
    if (pace && m.met >= 7) {
      const paceNum = parseFloat(pace);
      if (!isNaN(paceNum) && paceNum < 6) pts = Math.round(pts * 1.2);
    }
    // Incline bonus
    if (incline && incline > 0) pts = Math.round(pts * (1 + incline / 20));
    return pts;
  }
  if (category === 'sport') {
    return Math.round(manualCals || 0);
  }
  return 0;
};

// ── Goal bonus calculation ──────────────────────────────────────
const calcGoalBonus = (userId, circleId, weekStart, weekEnd, totalPoints, totalDiet) => {
  const goal = db.prepare(
    'SELECT * FROM goals WHERE user_id=? AND circle_id=? AND week_start=?'
  ).get(userId, circleId, weekStart);
  if (!goal) return 0;

  let bonus = 0;
  if (goal.exercise_target && totalPoints >= goal.exercise_target) {
    bonus += Math.round(totalPoints / goal.exercise_target >= 1.5 ? 100 : 50);
  }
  if (goal.diet_limit !== null && totalDiet <= goal.diet_limit) {
    bonus += totalDiet < goal.diet_limit / 2 ? 30 : 20;
  }
  return bonus;
};

// ── API: Users ──────────────────────────────────────────────────
app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY id').all());
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.post('/api/users', (req, res) => {
  const { name, avatar_color, height, weight, body_fat, body_data_public } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare(
    'INSERT INTO users (name, avatar_color, height, weight, body_fat, body_data_public) VALUES (?,?,?,?,?,?)'
  ).run(name, avatar_color || '#378ADD', height || null, weight || null, body_fat || null, body_data_public ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/users/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  db.prepare(`UPDATE users SET name=?, avatar_color=?, height=?, weight=?, body_fat=?, body_data_public=?, notify_enabled=? WHERE id=?`)
    .run(b.name||u.name, b.avatar_color||u.avatar_color,
      b.height!==undefined?b.height:u.height, b.weight!==undefined?b.weight:u.weight,
      b.body_fat!==undefined?b.body_fat:u.body_fat,
      b.body_data_public!==undefined?(b.body_data_public?1:0):u.body_data_public,
      b.notify_enabled!==undefined?(b.notify_enabled?1:0):u.notify_enabled,
      req.params.id);
  res.json(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id));
});

app.delete('/api/users/:id', (req, res) => {
  const tables = ['exercises','diets','goals','posts','notifications','circle_members'];
  for (const t of tables) db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(req.params.id);
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Circles ────────────────────────────────────────────────
app.get('/api/circles', (req, res) => {
  const { user_id } = req.query;
  if (user_id) {
    const circles = db.prepare(`
      SELECT c.*, cm.role FROM circles c
      JOIN circle_members cm ON c.id=cm.circle_id
      WHERE cm.user_id=? ORDER BY c.id
    `).all(user_id);
    return res.json(circles);
  }
  res.json(db.prepare('SELECT * FROM circles ORDER BY id').all());
});

app.post('/api/circles', (req, res) => {
  const { name, created_by } = req.body;
  if (!name || !created_by) return res.status(400).json({ error: 'name and created_by required' });
  const code = genInviteCode();
  const r = db.prepare('INSERT INTO circles (name, invite_code, created_by) VALUES (?,?,?)')
    .run(name, code, created_by);
  const circleId = r.lastInsertRowid;
  db.prepare('INSERT INTO circle_members (circle_id, user_id, role) VALUES (?,?,?)')
    .run(circleId, created_by, 'leader');
  res.status(201).json(db.prepare('SELECT * FROM circles WHERE id=?').get(circleId));
});

app.post('/api/circles/join', (req, res) => {
  const { user_id, invite_code } = req.body;
  if (!user_id || !invite_code) return res.status(400).json({ error: 'user_id and invite_code required' });
  const circle = db.prepare('SELECT * FROM circles WHERE invite_code=?').get(invite_code.toUpperCase());
  if (!circle) return res.status(404).json({ error: '邀请码无效' });
  const existing = db.prepare('SELECT * FROM circle_members WHERE circle_id=? AND user_id=?')
    .get(circle.id, user_id);
  if (existing) return res.status(400).json({ error: '已在圈内' });
  db.prepare('INSERT INTO circle_members (circle_id, user_id, role) VALUES (?,?,?)')
    .run(circle.id, user_id, 'member');
  const user = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  notifyCircle(circle.id, user_id, 'join', `${user.name} 加入了圈子`, circle.id, 'circle');
  res.json({ circle, message: '已加入 ' + circle.name });
});

app.put('/api/circles/:id/role', (req, res) => {
  const { user_id, role } = req.body;
  if (!user_id || !role) return res.status(400).json({ error: 'user_id and role required' });
  db.prepare('UPDATE circle_members SET role=? WHERE circle_id=? AND user_id=?')
    .run(role, req.params.id, user_id);
  res.json({ ok: true });
});

app.delete('/api/circles/:id/members/:userId', (req, res) => {
  db.prepare('DELETE FROM circle_members WHERE circle_id=? AND user_id=?')
    .run(req.params.id, req.params.userId);
  res.json({ ok: true });
});

app.get('/api/circles/:id/members', (req, res) => {
  const members = db.prepare(`
    SELECT u.id, u.name, u.avatar_color, u.body_data_public, u.height, u.weight, u.body_fat, cm.role, cm.joined_at
    FROM circle_members cm JOIN users u ON cm.user_id=u.id
    WHERE cm.circle_id=? ORDER BY cm.joined_at
  `).all(req.params.id);
  res.json(members);
});

// ── API: Exercises ──────────────────────────────────────────────
app.post('/api/exercises', (req, res) => {
  const { user_id, circle_id, category, exercise_type, duration_minutes, distance, reps, pace, incline, manual_calories, image_url, notes, date } = req.body;
  if (!user_id || !circle_id || !category || !exercise_type || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(user_id);
  const points = calcPoints(category, exercise_type, user, duration_minutes, reps, pace, incline, manual_calories);

  const r = db.prepare(`
    INSERT INTO exercises (user_id, circle_id, category, exercise_type, duration_minutes, distance, reps, pace, incline, manual_calories, points, image_url, notes, date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(user_id, circle_id, category, exercise_type, duration_minutes||0, distance||null, reps||null,
    pace||null, incline||null, manual_calories||null, points, image_url||null, notes||'', date);

  // Notify circle
  const exLabel = category==='gym' ? (GYM_EXERCISES[exercise_type]?.label||exercise_type) :
    category==='cardio' ? (CARDIO_MACHINES[exercise_type]?.label||exercise_type) : exercise_type;
  notifyCircle(circle_id, user_id, 'exercise', `${user.name} 完成 ${exLabel} (+${points}分)`, r.lastInsertRowid, 'exercise');

  const record = db.prepare('SELECT * FROM exercises WHERE id=?').get(r.lastInsertRowid);
  res.status(201).json(record);
});

app.get('/api/exercises', (req, res) => {
  const { user_id, circle_id, date, week_start } = req.query;
  let sql = 'SELECT * FROM exercises WHERE 1=1';
  const params = [];
  if (user_id) { sql += ' AND user_id=?'; params.push(user_id); }
  if (circle_id) { sql += ' AND circle_id=?'; params.push(circle_id); }
  if (date) { sql += ' AND date=?'; params.push(date); }
  if (week_start) {
    const parts = week_start.split('-').map(Number);
    sql += ' AND date>=? AND date<?';
    params.push(week_start, fmtLocal(new Date(parts[0], parts[1]-1, parts[2]+7)));
  }
  sql += ' ORDER BY date DESC, id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.delete('/api/exercises/:id', (req, res) => {
  db.prepare('DELETE FROM exercises WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Diets ──────────────────────────────────────────────────
app.post('/api/diets', (req, res) => {
  const { user_id, circle_id, food_type, quantity, date } = req.body;
  if (!user_id || !circle_id || !food_type || !date) return res.status(400).json({ error: 'Missing fields' });
  const qty = quantity || 1;
  const penalty = DIET_PENALTY_PER_ITEM * qty;
  const r = db.prepare('INSERT INTO diets (user_id, circle_id, food_type, quantity, penalty, date) VALUES (?,?,?,?,?,?)')
    .run(user_id, circle_id, food_type, qty, penalty, date);

  const user = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  const foodLabel = FOOD_TYPES[food_type] || food_type;
  notifyCircle(circle_id, user_id, 'diet', `${user.name} 记录了 ${foodLabel} x${qty} (-${penalty}分)`, r.lastInsertRowid, 'diet');

  res.status(201).json(db.prepare('SELECT * FROM diets WHERE id=?').get(r.lastInsertRowid));
});

app.get('/api/diets', (req, res) => {
  const { user_id, circle_id, date, week_start } = req.query;
  let sql = 'SELECT * FROM diets WHERE 1=1';
  const params = [];
  if (user_id) { sql += ' AND user_id=?'; params.push(user_id); }
  if (circle_id) { sql += ' AND circle_id=?'; params.push(circle_id); }
  if (date) { sql += ' AND date=?'; params.push(date); }
  if (week_start) {
    const parts = week_start.split('-').map(Number);
    sql += ' AND date>=? AND date<?';
    params.push(week_start, fmtLocal(new Date(parts[0], parts[1]-1, parts[2]+7)));
  }
  sql += ' ORDER BY date DESC, id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.delete('/api/diets/:id', (req, res) => {
  db.prepare('DELETE FROM diets WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Goals ──────────────────────────────────────────────────
app.post('/api/goals', (req, res) => {
  const { user_id, circle_id, week_start, exercise_target, exercise_target_type, diet_limit } = req.body;
  if (!user_id || !circle_id || !week_start) return res.status(400).json({ error: 'Missing fields' });
  db.prepare(`INSERT OR REPLACE INTO goals (user_id, circle_id, week_start, exercise_target, exercise_target_type, diet_limit)
    VALUES (?,?,?,?,?,?)`).run(user_id, circle_id, week_start, exercise_target||null, exercise_target_type||'points', diet_limit!==undefined?diet_limit:null);
  res.status(201).json(db.prepare('SELECT * FROM goals WHERE user_id=? AND circle_id=? AND week_start=?').get(user_id, circle_id, week_start));
});

app.get('/api/goals', (req, res) => {
  const { user_id, circle_id, week_start } = req.query;
  if (!user_id || !circle_id || !week_start) return res.status(400).json({ error: 'Missing params' });
  const goal = db.prepare('SELECT * FROM goals WHERE user_id=? AND circle_id=? AND week_start=?')
    .get(user_id, circle_id, week_start);
  res.json(goal || null);
});

// ── API: Posts ──────────────────────────────────────────────────
app.post('/api/posts', (req, res) => {
  const { user_id, circle_id, content, image_url } = req.body;
  if (!user_id || !circle_id) return res.status(400).json({ error: 'Missing fields' });
  const r = db.prepare('INSERT INTO posts (user_id, circle_id, content, image_url) VALUES (?,?,?,?)')
    .run(user_id, circle_id, content||'', image_url||null);
  const user = db.prepare('SELECT name FROM users WHERE id=?').get(user_id);
  notifyCircle(circle_id, user_id, 'post', `${user.name} 发布了新动态`, r.lastInsertRowid, 'post');
  res.status(201).json(db.prepare(`
    SELECT p.*, u.name as user_name, u.avatar_color FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id=?
  `).get(r.lastInsertRowid));
});

app.get('/api/posts', (req, res) => {
  const { circle_id, limit } = req.query;
  if (!circle_id) return res.status(400).json({ error: 'circle_id required' });
  const posts = db.prepare(`
    SELECT p.*, u.name as user_name, u.avatar_color
    FROM posts p JOIN users u ON p.user_id=u.id
    WHERE p.circle_id=? ORDER BY p.created_at DESC LIMIT ?
  `).all(circle_id, limit || 50);
  res.json(posts);
});

// ── API: Shared social feed (for prototype multi-device sync) ──
app.get('/api/shared/health', (req, res) => {
  res.json({ ok: true, now: nowISO() });
});

app.get('/api/shared/feed', (req, res) => {
  const { circleId, viewer, limit } = req.query;
  if (!circleId) return res.status(400).json({ error: 'circleId required' });
  const rows = listSharedPostsByCircle(circleId, viewer || '', Number(limit) || 100);
  res.json({ posts: rows, serverTime: nowISO() });
});

app.post('/api/shared/posts', (req, res) => {
  const { authorName, authorEmoji, content, image, circleIds, circleId } = req.body || {};
  if (!authorName || !content) return res.status(400).json({ error: 'authorName and content required' });
  const finalCircleIds = parseCircleIds(circleIds, circleId);
  if (finalCircleIds.length === 0) return res.status(400).json({ error: 'circleIds required' });

  const postId = makeId('post');
  const now = nowISO();
  db.prepare(`
    INSERT INTO shared_posts (id, author_name, author_emoji, content, image, circle_id, circle_ids_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    postId,
    authorName,
    authorEmoji || '👤',
    content,
    image || null,
    finalCircleIds[0],
    JSON.stringify(finalCircleIds),
    now,
    now
  );

  const post = db.prepare('SELECT * FROM shared_posts WHERE id=?').get(postId);
  res.status(201).json({ post: buildSharedPostView(post, authorName), serverTime: now });
});

app.post('/api/shared/posts/:postId/toggle-like', (req, res) => {
  const { userName } = req.body || {};
  if (!userName) return res.status(400).json({ error: 'userName required' });
  const post = db.prepare('SELECT * FROM shared_posts WHERE id=?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'post not found' });

  const existing = db.prepare('SELECT 1 FROM shared_post_likes WHERE post_id=? AND user_name=?').get(req.params.postId, userName);
  const now = nowISO();
  if (existing) {
    db.prepare('DELETE FROM shared_post_likes WHERE post_id=? AND user_name=?').run(req.params.postId, userName);
  } else {
    db.prepare('INSERT INTO shared_post_likes (post_id, user_name, created_at) VALUES (?, ?, ?)').run(req.params.postId, userName, now);
  }
  db.prepare('UPDATE shared_posts SET updated_at=? WHERE id=?').run(now, req.params.postId);

  const refreshed = db.prepare('SELECT * FROM shared_posts WHERE id=?').get(req.params.postId);
  res.json({ post: buildSharedPostView(refreshed, userName), serverTime: now });
});

app.post('/api/shared/posts/:postId/comments', (req, res) => {
  const { userName, userEmoji, content, parentId } = req.body || {};
  if (!userName || !content) return res.status(400).json({ error: 'userName and content required' });
  const post = db.prepare('SELECT * FROM shared_posts WHERE id=?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'post not found' });

  if (parentId) {
    const parent = db.prepare('SELECT id FROM shared_comments WHERE id=? AND post_id=?').get(parentId, req.params.postId);
    if (!parent) return res.status(400).json({ error: 'parent comment not found' });
  }

  const now = nowISO();
  const commentId = makeId('cmt');
  db.prepare(`
    INSERT INTO shared_comments (id, post_id, parent_comment_id, user_name, user_emoji, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(commentId, req.params.postId, parentId || null, userName, userEmoji || '👤', content, now, now);
  db.prepare('UPDATE shared_posts SET updated_at=? WHERE id=?').run(now, req.params.postId);

  const refreshed = db.prepare('SELECT * FROM shared_posts WHERE id=?').get(req.params.postId);
  res.status(201).json({ post: buildSharedPostView(refreshed, userName), serverTime: now });
});

app.post('/api/shared/posts/:postId/comments/:commentId/toggle-like', (req, res) => {
  const { userName } = req.body || {};
  if (!userName) return res.status(400).json({ error: 'userName required' });

  const comment = db.prepare('SELECT * FROM shared_comments WHERE id=? AND post_id=?').get(req.params.commentId, req.params.postId);
  if (!comment) return res.status(404).json({ error: 'comment not found' });

  const existing = db.prepare('SELECT 1 FROM shared_comment_likes WHERE comment_id=? AND user_name=?').get(req.params.commentId, userName);
  const now = nowISO();
  if (existing) {
    db.prepare('DELETE FROM shared_comment_likes WHERE comment_id=? AND user_name=?').run(req.params.commentId, userName);
  } else {
    db.prepare('INSERT INTO shared_comment_likes (comment_id, user_name, created_at) VALUES (?, ?, ?)').run(req.params.commentId, userName, now);
  }
  db.prepare('UPDATE shared_comments SET updated_at=? WHERE id=?').run(now, req.params.commentId);
  db.prepare('UPDATE shared_posts SET updated_at=? WHERE id=?').run(now, req.params.postId);

  const refreshed = db.prepare('SELECT * FROM shared_posts WHERE id=?').get(req.params.postId);
  res.json({ post: buildSharedPostView(refreshed, userName), serverTime: now });
});

// ── API: Notifications ──────────────────────────────────────────
app.get('/api/notifications', (req, res) => {
  const { user_id, limit } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const notifs = db.prepare(
    'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ?'
  ).all(user_id, limit || 30);
  res.json(notifs);
});

app.put('/api/notifications/read-all', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0').run(user_id);
  res.json({ ok: true });
});

app.get('/api/notifications/unread-count', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const r = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id=? AND is_read=0').get(user_id);
  res.json({ count: r.cnt });
});

// ── API: Leaderboard ────────────────────────────────────────────
app.get('/api/leaderboard', (req, res) => {
  const { circle_id, week_start } = req.query;
  if (!circle_id) return res.status(400).json({ error: 'circle_id required' });
  const ws = week_start || getWeekStart(todayStr());
  const parts = ws.split('-').map(Number);
  const we = fmtLocal(new Date(parts[0], parts[1]-1, parts[2]+7));

  const members = db.prepare(`
    SELECT u.id, u.name, u.avatar_color, u.body_data_public, u.height, u.weight, u.body_fat
    FROM circle_members cm JOIN users u ON cm.user_id=u.id WHERE cm.circle_id=?
  `).all(circle_id);

  const results = members.map(m => {
    const ex = db.prepare('SELECT COALESCE(SUM(points),0) as total, COUNT(*) as cnt FROM exercises WHERE user_id=? AND circle_id=? AND date>=? AND date<?')
      .get(m.id, circle_id, ws, we);
    const diet = db.prepare('SELECT COALESCE(SUM(penalty),0) as total, COUNT(*) as cnt FROM diets WHERE user_id=? AND circle_id=? AND date>=? AND date<?')
      .get(m.id, circle_id, ws, we);

    const exPoints = ex.total || 0;
    const dietPenalty = diet.total || 0;
    const exCount = ex.cnt || 0;
    const dietCount = diet.cnt || 0;

    // Streak
    const streakDays = calcStreak(m.id, circle_id, ws, we);
    const streakBonus = streakDays >= 7 ? 30 : streakDays >= 5 ? 15 : streakDays >= 3 ? 5 : 0;

    // Goal bonus
    const goalBonus = calcGoalBonus(m.id, circle_id, ws, we, exPoints, dietCount);

    const netScore = exPoints - dietPenalty + streakBonus + goalBonus;

    return {
      user_id: m.id, name: m.name, avatar_color: m.avatar_color,
      body_data_public: m.body_data_public,
      height: m.body_data_public?m.height:null, weight: m.body_data_public?m.weight:null, body_fat: m.body_data_public?m.body_fat:null,
      exercise_points: exPoints, diet_penalty: dietPenalty,
      streak_bonus: streakBonus, goal_bonus: goalBonus,
      net_score: netScore, exercise_count: exCount, diet_count: dietCount,
      streak_days: streakDays
    };
  });

  results.sort((a, b) => b.net_score - a.net_score);
  results.forEach((r, i) => r.rank = i + 1);
  res.json({ circle_id, week_start: ws, week_end: we, rankings: results });
});

function calcStreak(userId, circleId, ws, we) {
  const days = db.prepare(
    'SELECT DISTINCT date FROM exercises WHERE user_id=? AND circle_id=? AND date>=? AND date<? ORDER BY date DESC'
  ).all(userId, circleId, ws, we);
  if (days.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i-1].date + 'T00:00:00');
    const curr = new Date(days[i].date + 'T00:00:00');
    if ((prev - curr) / 86400000 === 1) streak++;
    else break;
  }
  return streak;
}

// ── API: Summary ────────────────────────────────────────────────
app.get('/api/summary', (req, res) => {
  const { user_id, circle_id, week_start } = req.query;
  if (!user_id || !circle_id) return res.status(400).json({ error: 'user_id and circle_id required' });
  const ws = week_start || getWeekStart(todayStr());
  const parts = ws.split('-').map(Number);
  const we = fmtLocal(new Date(parts[0], parts[1]-1, parts[2]+7));

  const exRows = db.prepare(
    'SELECT category, exercise_type, SUM(points) as total_pts, COUNT(*) as cnt, SUM(duration_minutes) as total_min FROM exercises WHERE user_id=? AND circle_id=? AND date>=? AND date<? GROUP BY category, exercise_type'
  ).all(user_id, circle_id, ws, we);

  const dietRows = db.prepare(
    'SELECT food_type, SUM(penalty) as total_penalty, COUNT(*) as cnt FROM diets WHERE user_id=? AND circle_id=? AND date>=? AND date<? GROUP BY food_type'
  ).all(user_id, circle_id, ws, we);

  const totalExPoints = exRows.reduce((s,r)=>s+r.total_pts,0);
  const totalExCount = exRows.reduce((s,r)=>s+r.cnt,0);
  const totalDietPenalty = dietRows.reduce((s,r)=>s+r.total_penalty,0);
  const totalDietCount = dietRows.reduce((s,r)=>s+r.cnt,0);

  const today = todayStr();
  const todayEx = db.prepare('SELECT * FROM exercises WHERE user_id=? AND circle_id=? AND date=?').all(user_id, circle_id, today);
  const todayDiet = db.prepare('SELECT * FROM diets WHERE user_id=? AND circle_id=? AND date=?').all(user_id, circle_id, today);

  // Calendar: last 4 weeks of exercise dates
  const calStart = fmtLocal(new Date(new Date() - 27*86400000));
  const calDays = db.prepare(
    'SELECT DISTINCT date FROM exercises WHERE user_id=? AND circle_id=? AND date>=? AND date<=?'
  ).all(user_id, circle_id, calStart, today).map(r => r.date);

  // Goal
  const goal = db.prepare('SELECT * FROM goals WHERE user_id=? AND circle_id=? AND week_start=?').get(user_id, circle_id, ws);
  const streakDays = calcStreak(user_id, circle_id, ws, we);

  res.json({
    week_start: ws, week_end: we,
    total_exercise_points: totalExPoints, total_exercise_count: totalExCount,
    total_diet_penalty: totalDietPenalty, total_diet_count: totalDietCount,
    net_score: totalExPoints - totalDietPenalty,
    streak_days: streakDays,
    exercise_by_type: exRows, diet_by_type: dietRows,
    today: { exercises: todayEx, diets: todayDiet },
    calendar_days: calDays,
    goal
  });
});

// ── API: Today ──────────────────────────────────────────────────
app.get('/api/today', (req, res) => {
  const { user_id, circle_id } = req.query;
  if (!user_id || !circle_id) return res.status(400).json({ error: 'user_id and circle_id required' });
  const today = todayStr();
  res.json({
    date: today,
    exercises: db.prepare('SELECT * FROM exercises WHERE user_id=? AND circle_id=? AND date=?').all(user_id, circle_id, today),
    diets: db.prepare('SELECT * FROM diets WHERE user_id=? AND circle_id=? AND date=?').all(user_id, circle_id, today)
  });
});

// ── API: Constants ──────────────────────────────────────────────
app.get('/api/constants', (req, res) => {
  res.json({
    gym_exercises: GYM_EXERCISES,
    cardio_machines: CARDIO_MACHINES,
    sports: SPORTS,
    diet_penalty_per_item: DIET_PENALTY_PER_ITEM,
    food_types: FOOD_TYPES
  });
});

// ── Start ───────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`卷腹 running at http://localhost:${PORT}`));
