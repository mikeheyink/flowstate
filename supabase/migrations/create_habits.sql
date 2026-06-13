-- Habits table
CREATE TABLE IF NOT EXISTS habits (
  id VARCHAR(9) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('do', 'dont-do')),
  created_at BIGINT NOT NULL,
  archived_at BIGINT,
  applies_from_week VARCHAR(8) NOT NULL, -- ISO week format: YYYY-W##
  applies_until_week VARCHAR(8), -- NULL means all future weeks
  days_of_week INTEGER[] NOT NULL, -- Array of day indices (0=Monday, 6=Sunday)
  created_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Habit logs table (one entry per habit per day)
CREATE TABLE IF NOT EXISTS habit_logs (
  id VARCHAR(9) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id VARCHAR(9) NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- YYYY-MM-DD format
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at BIGINT NOT NULL,
  created_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(habit_id, date) -- One log per habit per day
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS habits_user_id_idx ON habits(user_id);
CREATE INDEX IF NOT EXISTS habits_archived_at_idx ON habits(archived_at);
CREATE INDEX IF NOT EXISTS habit_logs_habit_id_idx ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS habit_logs_date_idx ON habit_logs(date);
CREATE INDEX IF NOT EXISTS habit_logs_user_id_date_idx ON habit_logs(user_id, date);

-- RLS Policies
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

-- Habits: Users can only see their own habits
CREATE POLICY "Users can view their own habits" ON habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own habits" ON habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits" ON habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits" ON habits
  FOR DELETE USING (auth.uid() = user_id);

-- Habit logs: Users can only see their own logs
CREATE POLICY "Users can view their own habit logs" ON habit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own habit logs" ON habit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habit logs" ON habit_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habit logs" ON habit_logs
  FOR DELETE USING (auth.uid() = user_id);
