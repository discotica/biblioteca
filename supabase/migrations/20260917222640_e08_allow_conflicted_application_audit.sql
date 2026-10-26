-- Preserve the original E06 change set when an applied row later conflicts
-- during a compensating batch rollback. Conflict is an audited terminal state,
-- not evidence that the prior fact mutation never happened.
alter table private.credit_inference_applications
  drop constraint credit_inference_applications_check;
alter table private.credit_inference_applications
  add constraint credit_inference_application_applied_audit_check
  check (status <> 'applied' or catalog_change_set_id is not null);
alter table private.credit_inference_applications
  drop constraint credit_inference_applications_check1;
alter table private.credit_inference_applications
  add constraint credit_inference_application_reverted_audit_check
  check (status <> 'reverted' or revert_change_set_id is not null);
