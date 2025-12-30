create table public.labor_rates (
  id uuid not null default extensions.uuid_generate_v4 (),
  company_id uuid null,
  category text not null,
  hourly_rate numeric not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  year_1_rate numeric null,
  year_2_rate numeric null,
  year_3_rate numeric null,
  year_4_rate numeric null,
  year_5_rate numeric null,
  escalation_rate numeric null,
  basis_of_rates text null,
  rate_justification text null,
  gsa_schedule_number text null,
  constraint labor_rates_pkey primary key (id),
  constraint labor_rates_company_id_fkey foreign KEY (company_id) references companies (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_labor_rates_company on public.labor_rates using btree (company_id) TABLESPACE pg_default;

create index IF not exists idx_labor_rates_category on public.labor_rates using btree (category) TABLESPACE pg_default;

create index IF not exists idx_labor_rates_company_id on public.labor_rates using btree (company_id) TABLESPACE pg_default;

create trigger update_labor_rates_updated_at BEFORE
update on labor_rates for EACH row
execute FUNCTION update_updated_at_column ();