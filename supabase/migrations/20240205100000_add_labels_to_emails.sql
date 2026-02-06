-- Add labels column to emails table
alter table public.emails 
add column if not exists labels text[] default '{}';

-- Create index for labels (using GIN for array containment queries)
create index if not exists emails_labels_idx on public.emails using gin (labels);
