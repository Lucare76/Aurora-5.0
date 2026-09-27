alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'negative_projected_balance', 'budget_threshold', 'overdue_recurrence',
  'upcoming_recurrence', 'upcoming_loan_payment', 'overdue_loan_payment',
  'loan_due_soon', 'goal_behind_schedule', 'automation_failure',
  'automation_conflict', 'possible_duplicate', 'timeline_reminder'
));

alter table public.notification_preferences drop constraint if exists notification_preferences_type_check;
-- Existing installations may use the constraint from migration 00021.
alter table public.notification_preferences add constraint notification_preferences_type_check check (notification_type in (
  'negative_projected_balance', 'budget_threshold', 'overdue_recurrence',
  'upcoming_recurrence', 'upcoming_loan_payment', 'overdue_loan_payment',
  'loan_due_soon', 'goal_behind_schedule', 'automation_failure',
  'automation_conflict', 'possible_duplicate', 'timeline_reminder'
));

alter table public.notification_source_mutes drop constraint if exists notification_source_mutes_type_check;
alter table public.notification_source_mutes add constraint notification_source_mutes_type_check check (notification_type in (
  'negative_projected_balance', 'budget_threshold', 'overdue_recurrence',
  'upcoming_recurrence', 'upcoming_loan_payment', 'overdue_loan_payment',
  'loan_due_soon', 'goal_behind_schedule', 'automation_failure',
  'automation_conflict', 'possible_duplicate', 'timeline_reminder'
));
