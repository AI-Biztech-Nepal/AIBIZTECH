-- Catch-up: what the legacy project gained after the 2026-10-30 snapshot. Additive and re-runnable.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION attendance.admin_force_delete_employee(p_employee_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
begin
  if not is_admin() then
    raise exception 'Only admins can permanently delete an employee';
  end if;

  if not exists (select 1 from employees where id = p_employee_id and company_id = my_company_id()) then
    raise exception 'Employee not found';
  end if;

  delete from task_time_logs where employee_id = p_employee_id;
  delete from tasks where assigned_to = p_employee_id;
  delete from point_redemptions where employee_id = p_employee_id;
  delete from employee_education where employee_id = p_employee_id;
  delete from employee_work_experience where employee_id = p_employee_id;
  delete from attendance_gps_requests where employee_id = p_employee_id;
  delete from attendance_correction_requests where employee_id = p_employee_id;
  delete from leave_requests where employee_id = p_employee_id;
  delete from payroll_summaries where employee_id = p_employee_id;
  delete from attendance_logs where employee_id = p_employee_id;
  -- Added: their roster, weekly shift pattern and notification phones.
  delete from employee_daily_shifts where employee_id = p_employee_id;
  delete from employee_weekly_pattern where employee_id = p_employee_id;
  delete from push_tokens where employee_id = p_employee_id;
  delete from shifts where employee_id = p_employee_id;
  update profiles set employee_id = null where employee_id = p_employee_id;
  delete from employees where id = p_employee_id;
end;
$$;

CREATE OR REPLACE FUNCTION attendance.log_employee_history() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
declare
  changes jsonb := '{}'::jsonb;
  old_text text;
  new_text text;
  old_name text;
  new_name text;
begin
  old_text := nullif(btrim(old.designation), '');
  new_text := nullif(btrim(new.designation), '');
  if old_text is not null and new_text is distinct from old_text then
    changes := changes || jsonb_build_object('designation', jsonb_build_object('from', old_text, 'to', new_text));
  end if;

  old_text := nullif(btrim(old.department), '');
  new_text := nullif(btrim(new.department), '');
  if old_text is not null and new_text is distinct from old_text then
    changes := changes || jsonb_build_object('department', jsonb_build_object('from', old_text, 'to', new_text));
  end if;

  if old.branch_id is not null and new.branch_id is distinct from old.branch_id then
    select name into old_name from branches where id = old.branch_id;
    select name into new_name from branches where id = new.branch_id;
    changes := changes || jsonb_build_object(
      'branch', jsonb_build_object('from', coalesce(old_name, 'Unknown branch'), 'to', new_name)
    );
  end if;

  if old.reporting_to is not null and new.reporting_to is distinct from old.reporting_to then
    select name into old_name from employees where id = old.reporting_to;
    select name into new_name from employees where id = new.reporting_to;
    changes := changes || jsonb_build_object(
      'reports_to', jsonb_build_object('from', coalesce(old_name, 'Unknown'), 'to', new_name)
    );
  end if;

  if coalesce(old.salary, 0) > 0 and new.salary is distinct from old.salary then
    changes := changes || jsonb_build_object('salary', jsonb_build_object('from', old.salary, 'to', new.salary));
  end if;

  if old.allowance is not null and new.allowance is distinct from old.allowance then
    changes := changes || jsonb_build_object('allowance', jsonb_build_object('from', old.allowance, 'to', new.allowance));
  end if;

  if changes <> '{}'::jsonb then
    insert into employee_history (employee_id, company_id, changes)
    values (new.id, new.company_id, changes);
  end if;
  return null;
end;
$$;

CREATE OR REPLACE FUNCTION attendance.mark_my_notifications_read() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
  update employee_notifications
  set read_at = now()
  where read_at is null
    and employee_id = (select employee_id from profiles where id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION attendance.my_reporting_manager() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
  select m.name
  from employees e
  join employees m on m.id = e.reporting_to
  where e.id = (select employee_id from profiles where id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION attendance.notify_employee_of_exit_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
declare
  actor_employee uuid;
  changes jsonb := '[]'::jsonb;
begin
  -- Only an admin or HR login counts. The employee's own hand-in and withdrawal run as the employee, and a
  -- script with no login (the SQL editor) is not HR "doing" something to someone.
  if not is_admin_or_hr() then
    return new;
  end if;
  -- An HR person ending their own employment is not news to them either.
  select employee_id into actor_employee from profiles where id = auth.uid();
  if actor_employee is not distinct from new.employee_id then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into employee_notifications (employee_id, kind) values (new.employee_id, 'exit_started');
    return new;
  end if;

  if new.separation_type is distinct from old.separation_type then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'separation_type', 'v', new.separation_type));
  end if;
  if new.last_working_on is distinct from old.last_working_on and new.last_working_on is not null then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'last_working_on', 'v', new.last_working_on));
  end if;
  if new.notice_required_days is distinct from old.notice_required_days and new.notice_required_days is not null then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'notice_required_days', 'v', new.notice_required_days));
  end if;
  if new.exit_interview_status is distinct from old.exit_interview_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'exit_interview', 'v', new.exit_interview_status));
  end if;
  if new.clearance_status is distinct from old.clearance_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'clearance', 'v', new.clearance_status));
  end if;
  if new.uniform_id_status is distinct from old.uniform_id_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'uniform_id', 'v', new.uniform_id_status));
  end if;
  if new.asset_keys_status is distinct from old.asset_keys_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'asset_keys', 'v', new.asset_keys_status));
  end if;
  if new.asset_equipment_status is distinct from old.asset_equipment_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'asset_equipment', 'v', new.asset_equipment_status));
  end if;
  if new.asset_device_status is distinct from old.asset_device_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'asset_device', 'v', new.asset_device_status));
  end if;
  if new.asset_other_status is distinct from old.asset_other_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'asset_other', 'v', new.asset_other_status));
  end if;
  if new.experience_letter_status is distinct from old.experience_letter_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'experience_letter', 'v', new.experience_letter_status));
  end if;
  if new.settlement_status is distinct from old.settlement_status then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'settlement', 'v', new.settlement_status));
  end if;
  -- The figures are on their Exit tab; the notice only says they moved, not by how much.
  if new.final_salary is distinct from old.final_salary
     or new.leave_encashment is distinct from old.leave_encashment
     or new.incentive_settlement is distinct from old.incentive_settlement
     or new.other_payments is distinct from old.other_payments
     or new.outstanding_advances is distinct from old.outstanding_advances
     or new.other_deductions is distinct from old.other_deductions then
    changes := changes || jsonb_build_array(jsonb_build_object('k', 'amounts'));
  end if;

  -- Notes and other internal edits change nothing the employee needs to hear about.
  if jsonb_array_length(changes) > 0 then
    insert into employee_notifications (employee_id, kind, payload)
    values (new.employee_id, 'exit_updated', jsonb_build_object('changes', changes));
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION attendance.register_push_token(p_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
declare
  me profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid();
  if not found then
    raise exception 'Not signed in';
  end if;
  if coalesce(btrim(p_token), '') = '' then
    raise exception 'Empty push token';
  end if;

  delete from push_tokens
  where expo_push_token = p_token
     or user_id = me.id
     or (me.employee_id is not null and employee_id = me.employee_id);

  insert into push_tokens (user_id, employee_id, expo_push_token)
  values (me.id, me.employee_id, p_token);
end;
$$;

CREATE TABLE IF NOT EXISTS attendance.employee_separations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    separation_type text DEFAULT 'resignation'::text NOT NULL,
    resignation_submitted_on date,
    resignation_effective_on date,
    last_working_on date,
    notice_required_days integer,
    notice_served_days integer,
    separation_reason text,
    exit_interview_status text DEFAULT 'pending'::text NOT NULL,
    exit_interview_on date,
    clearance_status text DEFAULT 'pending'::text NOT NULL,
    clearance_note text,
    uniform_id_status text DEFAULT 'pending'::text NOT NULL,
    asset_keys_status text DEFAULT 'pending'::text NOT NULL,
    asset_equipment_status text DEFAULT 'pending'::text NOT NULL,
    asset_device_status text DEFAULT 'pending'::text NOT NULL,
    asset_other_status text DEFAULT 'pending'::text NOT NULL,
    asset_other_note text,
    experience_letter_status text DEFAULT 'pending'::text NOT NULL,
    experience_letter_on date,
    final_salary numeric DEFAULT 0 NOT NULL,
    leave_encashment numeric DEFAULT 0 NOT NULL,
    incentive_settlement numeric DEFAULT 0 NOT NULL,
    other_payments numeric DEFAULT 0 NOT NULL,
    outstanding_advances numeric DEFAULT 0 NOT NULL,
    other_deductions numeric DEFAULT 0 NOT NULL,
    other_dues_note text,
    settlement_status text DEFAULT 'pending'::text NOT NULL,
    settlement_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid DEFAULT auth.uid(),
    requested_by_employee boolean DEFAULT false NOT NULL,
    CONSTRAINT employee_separations_amounts_check CHECK (((final_salary >= (0)::numeric) AND (leave_encashment >= (0)::numeric) AND (incentive_settlement >= (0)::numeric) AND (other_payments >= (0)::numeric) AND (outstanding_advances >= (0)::numeric) AND (other_deductions >= (0)::numeric))),
    CONSTRAINT employee_separations_clearance_check CHECK ((clearance_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'cleared'::text]))),
    CONSTRAINT employee_separations_dates_check CHECK (((resignation_submitted_on IS NULL) OR (resignation_effective_on IS NULL) OR (resignation_effective_on >= resignation_submitted_on))),
    CONSTRAINT employee_separations_device_check CHECK ((asset_device_status = ANY (ARRAY['pending'::text, 'returned'::text, 'not_applicable'::text]))),
    CONSTRAINT employee_separations_equipment_check CHECK ((asset_equipment_status = ANY (ARRAY['pending'::text, 'returned'::text, 'not_applicable'::text]))),
    CONSTRAINT employee_separations_exit_interview_check CHECK ((exit_interview_status = ANY (ARRAY['pending'::text, 'completed'::text]))),
    CONSTRAINT employee_separations_keys_check CHECK ((asset_keys_status = ANY (ARRAY['pending'::text, 'returned'::text, 'not_applicable'::text]))),
    CONSTRAINT employee_separations_letter_check CHECK ((experience_letter_status = ANY (ARRAY['pending'::text, 'issued'::text]))),
    CONSTRAINT employee_separations_notice_check CHECK ((((notice_required_days IS NULL) OR (notice_required_days >= 0)) AND ((notice_served_days IS NULL) OR (notice_served_days >= 0)))),
    CONSTRAINT employee_separations_other_assets_check CHECK ((asset_other_status = ANY (ARRAY['pending'::text, 'returned'::text, 'not_applicable'::text]))),
    CONSTRAINT employee_separations_settlement_check CHECK ((settlement_status = ANY (ARRAY['pending'::text, 'processed'::text, 'completed'::text]))),
    CONSTRAINT employee_separations_type_check CHECK ((separation_type = ANY (ARRAY['resignation'::text, 'termination'::text, 'retirement'::text, 'other'::text]))),
    CONSTRAINT employee_separations_uniform_check CHECK ((uniform_id_status = ANY (ARRAY['pending'::text, 'returned'::text, 'not_applicable'::text])))
);

CREATE OR REPLACE FUNCTION attendance.separation_is_untouched(s attendance.employee_separations) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select s.exit_interview_status = 'pending'
     and s.clearance_status = 'pending'
     and s.uniform_id_status = 'pending'
     and s.asset_keys_status = 'pending'
     and s.asset_equipment_status = 'pending'
     and s.asset_device_status = 'pending'
     and s.asset_other_status = 'pending'
     and s.experience_letter_status = 'pending'
     and s.settlement_status = 'pending'
     and s.notice_required_days is null
     and s.final_salary = 0 and s.leave_encashment = 0 and s.incentive_settlement = 0
     and s.other_payments = 0 and s.outstanding_advances = 0 and s.other_deductions = 0;
$$;

CREATE OR REPLACE FUNCTION attendance.stamp_push_token_company() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
begin
  new.company_id := coalesce(
    (select company_id from employees where id = new.employee_id),
    (select company_id from profiles where id = new.user_id)
  );
  if new.company_id is null then
    raise exception 'No company for this push token';
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION attendance.submit_my_resignation(p_submitted_on date, p_last_working_on date, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
declare
  emp_id uuid;
  existing employee_separations%rowtype;
begin
  select employee_id into emp_id from profiles where id = auth.uid();
  if emp_id is null then
    raise exception 'No employee linked to this account';
  end if;
  if p_submitted_on is null or p_last_working_on is null then
    raise exception 'Give the date you are handing it in and your last working day';
  end if;
  if p_last_working_on < p_submitted_on then
    raise exception 'Your last working day cannot be before the day you hand it in';
  end if;

  select * into existing from employee_separations where employee_id = emp_id;
  if found then
    if not existing.requested_by_employee then
      raise exception 'HR has already started your exit. Contact HR to change it.';
    end if;
    if not separation_is_untouched(existing) then
      raise exception 'HR has started processing your resignation. Contact HR to change it.';
    end if;
    update employee_separations
    set resignation_submitted_on = p_submitted_on,
        resignation_effective_on = p_last_working_on,
        last_working_on = p_last_working_on,
        separation_reason = nullif(btrim(p_reason), '')
    where employee_id = emp_id;
  else
    insert into employee_separations
      (employee_id, separation_type, resignation_submitted_on, resignation_effective_on, last_working_on, separation_reason, requested_by_employee)
    values
      (emp_id, 'resignation', p_submitted_on, p_last_working_on, p_last_working_on, nullif(btrim(p_reason), ''), true);
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION attendance.touch_employee_separation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION attendance.touch_record_updated() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION attendance.unregister_push_token(p_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
begin
  delete from push_tokens
  where expo_push_token = p_token
    and (
      user_id = auth.uid()
      or employee_id = (select employee_id from profiles where id = auth.uid())
    );
end;
$$;

CREATE OR REPLACE FUNCTION attendance.update_my_hr_profile(p_values jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
declare
  emp_id uuid;
begin
  select employee_id into emp_id from profiles where id = auth.uid();
  if emp_id is null then
    raise exception 'No employee linked to this account';
  end if;

  update employees set
    gender                      = case when p_values ? 'gender'                      then nullif(btrim(p_values->>'gender'), '')                      else gender end,
    date_of_birth               = case when p_values ? 'date_of_birth'               then nullif(btrim(p_values->>'date_of_birth'), '')::date         else date_of_birth end,
    nationality                 = case when p_values ? 'nationality'                 then nullif(btrim(p_values->>'nationality'), '')                 else nationality end,
    marital_status              = case when p_values ? 'marital_status'              then nullif(btrim(p_values->>'marital_status'), '')              else marital_status end,
    blood_group                 = case when p_values ? 'blood_group'                 then nullif(btrim(p_values->>'blood_group'), '')                 else blood_group end,
    citizenship_no              = case when p_values ? 'citizenship_no'              then nullif(btrim(p_values->>'citizenship_no'), '')              else citizenship_no end,
    citizenship_issued_district = case when p_values ? 'citizenship_issued_district' then nullif(btrim(p_values->>'citizenship_issued_district'), '') else citizenship_issued_district end,
    citizenship_issue_date      = case when p_values ? 'citizenship_issue_date'      then nullif(btrim(p_values->>'citizenship_issue_date'), '')::date else citizenship_issue_date end,
    personal_email              = case when p_values ? 'personal_email'              then nullif(btrim(p_values->>'personal_email'), '')              else personal_email end,
    permanent_province          = case when p_values ? 'permanent_province'          then nullif(btrim(p_values->>'permanent_province'), '')          else permanent_province end,
    permanent_district          = case when p_values ? 'permanent_district'          then nullif(btrim(p_values->>'permanent_district'), '')          else permanent_district end,
    permanent_municipality      = case when p_values ? 'permanent_municipality'      then nullif(btrim(p_values->>'permanent_municipality'), '')      else permanent_municipality end,
    permanent_ward              = case when p_values ? 'permanent_ward'              then nullif(btrim(p_values->>'permanent_ward'), '')              else permanent_ward end,
    permanent_tole              = case when p_values ? 'permanent_tole'              then nullif(btrim(p_values->>'permanent_tole'), '')              else permanent_tole end,
    temporary_province          = case when p_values ? 'temporary_province'          then nullif(btrim(p_values->>'temporary_province'), '')          else temporary_province end,
    temporary_district          = case when p_values ? 'temporary_district'          then nullif(btrim(p_values->>'temporary_district'), '')          else temporary_district end,
    temporary_municipality      = case when p_values ? 'temporary_municipality'      then nullif(btrim(p_values->>'temporary_municipality'), '')      else temporary_municipality end,
    temporary_ward              = case when p_values ? 'temporary_ward'              then nullif(btrim(p_values->>'temporary_ward'), '')              else temporary_ward end,
    temporary_tole              = case when p_values ? 'temporary_tole'              then nullif(btrim(p_values->>'temporary_tole'), '')              else temporary_tole end,
    emergency_contact_address   = case when p_values ? 'emergency_contact_address'   then nullif(btrim(p_values->>'emergency_contact_address'), '')   else emergency_contact_address end,
    father_name                 = case when p_values ? 'father_name'                 then nullif(btrim(p_values->>'father_name'), '')                 else father_name end,
    mother_name                 = case when p_values ? 'mother_name'                 then nullif(btrim(p_values->>'mother_name'), '')                 else mother_name end,
    grandfather_name            = case when p_values ? 'grandfather_name'            then nullif(btrim(p_values->>'grandfather_name'), '')            else grandfather_name end,
    spouse_name                 = case when p_values ? 'spouse_name'                 then nullif(btrim(p_values->>'spouse_name'), '')                 else spouse_name end
  where id = emp_id;
end;
$$;

CREATE OR REPLACE FUNCTION attendance.withdraw_my_resignation() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'attendance'
    AS $$
declare
  emp_id uuid;
  removed integer;
begin
  select employee_id into emp_id from profiles where id = auth.uid();
  if emp_id is null then
    raise exception 'No employee linked to this account';
  end if;
  delete from employee_separations
  where employee_id = emp_id
    and requested_by_employee
    and separation_is_untouched(employee_separations);
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'There is nothing to withdraw, or HR has already started processing it. Contact HR.';
  end if;
end;
$$;

CREATE TABLE IF NOT EXISTS attendance.employee_appraisals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    appraisal_date date NOT NULL,
    period_type text NOT NULL,
    period_start date,
    period_end date,
    rating numeric NOT NULL,
    remarks text,
    evaluated_by text,
    skills_assessment text,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid DEFAULT auth.uid(),
    CONSTRAINT employee_appraisals_period_check CHECK (((period_start IS NULL) OR (period_end IS NULL) OR (period_end >= period_start))),
    CONSTRAINT employee_appraisals_period_type_check CHECK ((period_type = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annual'::text]))),
    CONSTRAINT employee_appraisals_rating_check CHECK (((rating >= (1)::numeric) AND (rating <= (5)::numeric) AND ((rating * (2)::numeric) = floor((rating * (2)::numeric)))))
);

CREATE TABLE IF NOT EXISTS attendance.employee_awards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    title text NOT NULL,
    awarded_on date NOT NULL,
    description text,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid DEFAULT auth.uid(),
    CONSTRAINT employee_awards_title_check CHECK ((btrim(title) <> ''::text))
);

CREATE TABLE IF NOT EXISTS attendance.employee_conduct_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    kind text NOT NULL,
    record_date date NOT NULL,
    title text NOT NULL,
    details text,
    warning_level text,
    status text DEFAULT 'open'::text NOT NULL,
    final_decision text,
    decided_on date,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid DEFAULT auth.uid(),
    CONSTRAINT employee_conduct_kind_check CHECK ((kind = ANY (ARRAY['warning'::text, 'disciplinary'::text, 'grievance'::text]))),
    CONSTRAINT employee_conduct_level_check CHECK (((warning_level IS NULL) OR (warning_level = ANY (ARRAY['verbal'::text, 'written'::text, 'show_cause'::text, 'final_warning'::text])))),
    CONSTRAINT employee_conduct_level_only_warnings CHECK (((warning_level IS NULL) OR (kind = 'warning'::text))),
    CONSTRAINT employee_conduct_status_check CHECK ((status = ANY (ARRAY['open'::text, 'under_review'::text, 'closed'::text]))),
    CONSTRAINT employee_conduct_title_check CHECK ((btrim(title) <> ''::text))
);

CREATE TABLE IF NOT EXISTS attendance.employee_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    doc_type text NOT NULL,
    title text,
    file_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes bigint,
    uploaded_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_by_employee boolean DEFAULT false NOT NULL,
    CONSTRAINT employee_documents_doc_type_check CHECK ((doc_type = ANY (ARRAY['cv'::text, 'application_form'::text, 'citizenship'::text, 'photograph'::text, 'education_certificate'::text, 'training_certificate'::text, 'experience_certificate'::text, 'employment_agreement'::text, 'probation_evaluation'::text, 'promotion_letter'::text, 'transfer_letter'::text, 'salary_revision_letter'::text, 'warning_letter'::text, 'performance_appraisal'::text, 'resignation_letter'::text, 'final_settlement'::text, 'relieving_letter'::text])))
);

alter table attendance.employee_education add column if not exists board_university text;

alter table attendance.employee_education add column if not exists year_calendar text DEFAULT 'AD'::text NOT NULL;

CREATE TABLE IF NOT EXISTS attendance.employee_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    effective_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kathmandu'::text))::date NOT NULL,
    changes jsonb NOT NULL,
    reason text,
    remark text,
    source text DEFAULT 'auto'::text NOT NULL,
    changed_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_history_changes_check CHECK (((jsonb_typeof(changes) = 'object'::text) AND (changes <> '{}'::jsonb))),
    CONSTRAINT employee_history_source_check CHECK ((source = ANY (ARRAY['auto'::text, 'manual'::text])))
);

CREATE TABLE IF NOT EXISTS attendance.employee_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    employee_id uuid NOT NULL,
    kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT employee_notifications_kind_check CHECK ((kind = ANY (ARRAY['exit_started'::text, 'exit_updated'::text])))
);

CREATE TABLE IF NOT EXISTS attendance.employee_training (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    title text NOT NULL,
    provider text,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_training_check CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (end_date >= start_date)))
);

alter table attendance.employees add column if not exists employment_type text;

alter table attendance.employees add column if not exists employment_status text DEFAULT 'active'::text NOT NULL;

alter table attendance.employees add column if not exists contract_start date;

alter table attendance.employees add column if not exists contract_end date;

alter table attendance.employees add column if not exists reporting_to uuid;

alter table attendance.employees add column if not exists official_phone text;

alter table attendance.employees add column if not exists personal_email text;

alter table attendance.employees add column if not exists date_of_birth date;

alter table attendance.employees add column if not exists nationality text;

alter table attendance.employees add column if not exists marital_status text;

alter table attendance.employees add column if not exists blood_group text;

alter table attendance.employees add column if not exists citizenship_no text;

alter table attendance.employees add column if not exists citizenship_issued_district text;

alter table attendance.employees add column if not exists citizenship_issue_date date;

alter table attendance.employees add column if not exists permanent_province text;

alter table attendance.employees add column if not exists permanent_district text;

alter table attendance.employees add column if not exists permanent_municipality text;

alter table attendance.employees add column if not exists permanent_ward text;

alter table attendance.employees add column if not exists permanent_tole text;

alter table attendance.employees add column if not exists temporary_province text;

alter table attendance.employees add column if not exists temporary_district text;

alter table attendance.employees add column if not exists temporary_municipality text;

alter table attendance.employees add column if not exists temporary_ward text;

alter table attendance.employees add column if not exists temporary_tole text;

alter table attendance.employees add column if not exists father_name text;

alter table attendance.employees add column if not exists mother_name text;

alter table attendance.employees add column if not exists grandfather_name text;

alter table attendance.employees add column if not exists spouse_name text;

alter table attendance.employees add column if not exists emergency_contact_address text;

CREATE TABLE IF NOT EXISTS attendance.hr_alert_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    kind text NOT NULL,
    ref_date date NOT NULL,
    milestone text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_alert_log_milestone_check CHECK ((milestone = ANY (ARRAY['month'::text, 'week'::text, 'today'::text, 'ended'::text])))
);

alter table attendance.push_tokens add column if not exists user_id uuid;

ALTER TABLE ONLY attendance.employee_appraisals
    ADD CONSTRAINT employee_appraisals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.employee_awards
    ADD CONSTRAINT employee_awards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.employee_conduct_records
    ADD CONSTRAINT employee_conduct_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.employee_documents
    ADD CONSTRAINT employee_documents_file_path_key UNIQUE (file_path);

ALTER TABLE ONLY attendance.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.employee_history
    ADD CONSTRAINT employee_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.employee_notifications
    ADD CONSTRAINT employee_notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.employee_separations
    ADD CONSTRAINT employee_separations_employee_id_key UNIQUE (employee_id);

ALTER TABLE ONLY attendance.employee_separations
    ADD CONSTRAINT employee_separations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.employee_training
    ADD CONSTRAINT employee_training_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.hr_alert_log
    ADD CONSTRAINT hr_alert_log_employee_id_kind_ref_date_milestone_key UNIQUE (employee_id, kind, ref_date, milestone);

ALTER TABLE ONLY attendance.hr_alert_log
    ADD CONSTRAINT hr_alert_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance.push_tokens
    ADD CONSTRAINT push_tokens_user_id_key UNIQUE (user_id);

CREATE INDEX IF NOT EXISTS idx_employee_appraisals_employee ON attendance.employee_appraisals USING btree (employee_id, appraisal_date DESC);

CREATE INDEX IF NOT EXISTS idx_employee_awards_employee ON attendance.employee_awards USING btree (employee_id, awarded_on DESC);

CREATE INDEX IF NOT EXISTS idx_employee_conduct_employee ON attendance.employee_conduct_records USING btree (employee_id, record_date DESC);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON attendance.employee_documents USING btree (employee_id, doc_type);

CREATE INDEX IF NOT EXISTS idx_employee_history_employee ON attendance.employee_history USING btree (employee_id, effective_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_notifications_employee ON attendance.employee_notifications USING btree (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_training_employee ON attendance.employee_training USING btree (employee_id);

CREATE INDEX IF NOT EXISTS idx_employees_reporting_to ON attendance.employees USING btree (reporting_to);

CREATE INDEX IF NOT EXISTS idx_hr_alert_log_company ON attendance.hr_alert_log USING btree (company_id);

DROP TRIGGER IF EXISTS trg_log_employee_history ON attendance.employees;
CREATE TRIGGER trg_log_employee_history AFTER UPDATE OF branch_id, designation, department, reporting_to, salary, allowance ON attendance.employees FOR EACH ROW WHEN (((old.branch_id IS DISTINCT FROM new.branch_id) OR (old.designation IS DISTINCT FROM new.designation) OR (old.department IS DISTINCT FROM new.department) OR (old.reporting_to IS DISTINCT FROM new.reporting_to) OR (old.salary IS DISTINCT FROM new.salary) OR (old.allowance IS DISTINCT FROM new.allowance))) EXECUTE FUNCTION attendance.log_employee_history();

DROP TRIGGER IF EXISTS trg_notify_employee_exit ON attendance.employee_separations;
CREATE TRIGGER trg_notify_employee_exit AFTER INSERT OR UPDATE ON attendance.employee_separations FOR EACH ROW EXECUTE FUNCTION attendance.notify_employee_of_exit_change();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.employee_appraisals;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.employee_appraisals FOR EACH ROW EXECUTE FUNCTION attendance.stamp_company_id_from_employee();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.employee_awards;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.employee_awards FOR EACH ROW EXECUTE FUNCTION attendance.stamp_company_id_from_employee();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.employee_conduct_records;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.employee_conduct_records FOR EACH ROW EXECUTE FUNCTION attendance.stamp_company_id_from_employee();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.employee_documents;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.employee_documents FOR EACH ROW EXECUTE FUNCTION attendance.stamp_company_id_from_employee();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.employee_history;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.employee_history FOR EACH ROW EXECUTE FUNCTION attendance.stamp_company_id_from_employee();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.employee_notifications;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.employee_notifications FOR EACH ROW EXECUTE FUNCTION attendance.stamp_company_id_from_employee();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.employee_separations;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.employee_separations FOR EACH ROW EXECUTE FUNCTION attendance.stamp_company_id_from_employee();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.employee_training;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.employee_training FOR EACH ROW EXECUTE FUNCTION attendance.stamp_company_id_from_employee();

DROP TRIGGER IF EXISTS trg_stamp_company_id ON attendance.push_tokens;
CREATE TRIGGER trg_stamp_company_id BEFORE INSERT ON attendance.push_tokens FOR EACH ROW EXECUTE FUNCTION attendance.stamp_push_token_company();

DROP TRIGGER IF EXISTS trg_touch_employee_separation ON attendance.employee_separations;
CREATE TRIGGER trg_touch_employee_separation BEFORE UPDATE ON attendance.employee_separations FOR EACH ROW EXECUTE FUNCTION attendance.touch_employee_separation();

DROP TRIGGER IF EXISTS trg_touch_record_updated ON attendance.employee_appraisals;
CREATE TRIGGER trg_touch_record_updated BEFORE UPDATE ON attendance.employee_appraisals FOR EACH ROW EXECUTE FUNCTION attendance.touch_record_updated();

DROP TRIGGER IF EXISTS trg_touch_record_updated ON attendance.employee_awards;
CREATE TRIGGER trg_touch_record_updated BEFORE UPDATE ON attendance.employee_awards FOR EACH ROW EXECUTE FUNCTION attendance.touch_record_updated();

DROP TRIGGER IF EXISTS trg_touch_record_updated ON attendance.employee_conduct_records;
CREATE TRIGGER trg_touch_record_updated BEFORE UPDATE ON attendance.employee_conduct_records FOR EACH ROW EXECUTE FUNCTION attendance.touch_record_updated();

ALTER TABLE ONLY attendance.employee_appraisals
    ADD CONSTRAINT employee_appraisals_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id);

ALTER TABLE ONLY attendance.employee_appraisals
    ADD CONSTRAINT employee_appraisals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employee_awards
    ADD CONSTRAINT employee_awards_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id);

ALTER TABLE ONLY attendance.employee_awards
    ADD CONSTRAINT employee_awards_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employee_conduct_records
    ADD CONSTRAINT employee_conduct_records_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id);

ALTER TABLE ONLY attendance.employee_conduct_records
    ADD CONSTRAINT employee_conduct_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employee_documents
    ADD CONSTRAINT employee_documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id);

ALTER TABLE ONLY attendance.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employee_history
    ADD CONSTRAINT employee_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id);

ALTER TABLE ONLY attendance.employee_history
    ADD CONSTRAINT employee_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employee_notifications
    ADD CONSTRAINT employee_notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employee_notifications
    ADD CONSTRAINT employee_notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employee_separations
    ADD CONSTRAINT employee_separations_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id);

ALTER TABLE ONLY attendance.employee_separations
    ADD CONSTRAINT employee_separations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employee_training
    ADD CONSTRAINT employee_training_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id);

ALTER TABLE ONLY attendance.employee_training
    ADD CONSTRAINT employee_training_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.employees
    ADD CONSTRAINT employees_reporting_to_fkey FOREIGN KEY (reporting_to) REFERENCES attendance.employees(id) ON DELETE SET NULL;

ALTER TABLE ONLY attendance.hr_alert_log
    ADD CONSTRAINT hr_alert_log_company_id_fkey FOREIGN KEY (company_id) REFERENCES attendance.companies(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.hr_alert_log
    ADD CONSTRAINT hr_alert_log_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES attendance.employees(id) ON DELETE CASCADE;

ALTER TABLE ONLY attendance.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE attendance.employee_appraisals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_appraisals: admin or hr full access" ON attendance.employee_appraisals;
CREATE POLICY "employee_appraisals: admin or hr full access" ON attendance.employee_appraisals USING ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id()))) WITH CHECK ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id())));

DROP POLICY IF EXISTS "employee_appraisals: employee read own" ON attendance.employee_appraisals;
CREATE POLICY "employee_appraisals: employee read own" ON attendance.employee_appraisals FOR SELECT USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

ALTER TABLE attendance.employee_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_awards: admin or hr full access" ON attendance.employee_awards;
CREATE POLICY "employee_awards: admin or hr full access" ON attendance.employee_awards USING ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id()))) WITH CHECK ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id())));

DROP POLICY IF EXISTS "employee_awards: employee read own" ON attendance.employee_awards;
CREATE POLICY "employee_awards: employee read own" ON attendance.employee_awards FOR SELECT USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

ALTER TABLE attendance.employee_conduct_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_conduct_records: admin or hr full access" ON attendance.employee_conduct_records;
CREATE POLICY "employee_conduct_records: admin or hr full access" ON attendance.employee_conduct_records USING ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id()))) WITH CHECK ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id())));

DROP POLICY IF EXISTS "employee_conduct_records: employee read own" ON attendance.employee_conduct_records;
CREATE POLICY "employee_conduct_records: employee read own" ON attendance.employee_conduct_records FOR SELECT USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

ALTER TABLE attendance.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_documents: admin or hr full access" ON attendance.employee_documents;
CREATE POLICY "employee_documents: admin or hr full access" ON attendance.employee_documents USING ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id()))) WITH CHECK ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id())));

DROP POLICY IF EXISTS "employee_documents: employee add own" ON attendance.employee_documents;
CREATE POLICY "employee_documents: employee add own" ON attendance.employee_documents FOR INSERT WITH CHECK (((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))) AND uploaded_by_employee));

DROP POLICY IF EXISTS "employee_documents: employee read own" ON attendance.employee_documents;
CREATE POLICY "employee_documents: employee read own" ON attendance.employee_documents FOR SELECT USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

DROP POLICY IF EXISTS "employee_documents: employee remove own upload" ON attendance.employee_documents;
CREATE POLICY "employee_documents: employee remove own upload" ON attendance.employee_documents FOR DELETE USING (((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))) AND uploaded_by_employee));

ALTER TABLE attendance.employee_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_history: admin or hr full access" ON attendance.employee_history;
CREATE POLICY "employee_history: admin or hr full access" ON attendance.employee_history USING ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id()))) WITH CHECK ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id())));

DROP POLICY IF EXISTS "employee_history: employee read own" ON attendance.employee_history;
CREATE POLICY "employee_history: employee read own" ON attendance.employee_history FOR SELECT USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

ALTER TABLE attendance.employee_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_notifications: employee read own" ON attendance.employee_notifications;
CREATE POLICY "employee_notifications: employee read own" ON attendance.employee_notifications FOR SELECT USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

ALTER TABLE attendance.employee_separations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_separations: admin or hr full access" ON attendance.employee_separations;
CREATE POLICY "employee_separations: admin or hr full access" ON attendance.employee_separations USING ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id()))) WITH CHECK ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id())));

DROP POLICY IF EXISTS "employee_separations: employee read own" ON attendance.employee_separations;
CREATE POLICY "employee_separations: employee read own" ON attendance.employee_separations FOR SELECT USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

ALTER TABLE attendance.employee_training ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_training: admin or hr full access" ON attendance.employee_training;
CREATE POLICY "employee_training: admin or hr full access" ON attendance.employee_training USING ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id()))) WITH CHECK ((attendance.is_admin_or_hr() AND (company_id = attendance.my_company_id())));

DROP POLICY IF EXISTS "employee_training: employee manage own" ON attendance.employee_training;
CREATE POLICY "employee_training: employee manage own" ON attendance.employee_training USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid())))) WITH CHECK ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

DROP POLICY IF EXISTS "employee_training: employee read own" ON attendance.employee_training;
CREATE POLICY "employee_training: employee read own" ON attendance.employee_training FOR SELECT USING ((employee_id = ( SELECT profiles.employee_id
   FROM attendance.profiles
  WHERE (profiles.id = auth.uid()))));

ALTER TABLE attendance.hr_alert_log ENABLE ROW LEVEL SECURITY;
