-- 卷腹 App · Supabase 数据库建表脚本
-- 在 Supabase SQL Editor 中粘贴执行（一次性）

-- 用户表：用昵称作为主键，app_state 存整个应用状态
CREATE TABLE IF NOT EXISTS users (
  nick TEXT PRIMARY KEY,
  app_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 开启行级安全
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 原型阶段：允许匿名读写（anon key 即可操作）
CREATE POLICY "public_access" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 确认表已创建
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
