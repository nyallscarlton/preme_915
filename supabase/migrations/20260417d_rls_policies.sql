-- ============================================================================
--  RLS policies for MISMO child tables
--  Date      : 2026-04-17
--  Depends on: 20260417 (child tables), 20260417c (borrower_profiles)
--
--  Pattern: child tables inherit ownership from their parent loan_applications row.
--  A user can see/update a child row iff they can see/update the parent.
--
--  pii_access_log has no policies by design — only service_role can read it
--  (other roles bypass because no policy matches = no rows visible under RLS).
-- ============================================================================

BEGIN;

-- Helper: "can the current auth context access this loan_application_id?"
-- Inlined as EXISTS subqueries below; no function needed.

-- ---------------------------------------------------------------------------
-- preme.loan_borrowers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS lb_select_via_app        ON preme.loan_borrowers;
DROP POLICY IF EXISTS lb_insert_via_app        ON preme.loan_borrowers;
DROP POLICY IF EXISTS lb_update_via_app        ON preme.loan_borrowers;
DROP POLICY IF EXISTS lb_delete_via_app        ON preme.loan_borrowers;

CREATE POLICY lb_select_via_app ON preme.loan_borrowers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM preme.loan_applications la
      WHERE la.id = loan_borrowers.loan_application_id
        AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())
  ));

CREATE POLICY lb_insert_via_app ON preme.loan_borrowers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM preme.loan_applications la
      WHERE la.id = loan_application_id
        AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())
  ));

CREATE POLICY lb_update_via_app ON preme.loan_borrowers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM preme.loan_applications la
      WHERE la.id = loan_borrowers.loan_application_id
        AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())
  ));

CREATE POLICY lb_delete_via_app ON preme.loan_borrowers
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM preme.loan_applications la
      WHERE la.id = loan_borrowers.loan_application_id
        AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())
  ));

-- ---------------------------------------------------------------------------
-- preme.loan_liabilities
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS ll_select_via_app ON preme.loan_liabilities;
DROP POLICY IF EXISTS ll_insert_via_app ON preme.loan_liabilities;
DROP POLICY IF EXISTS ll_update_via_app ON preme.loan_liabilities;
DROP POLICY IF EXISTS ll_delete_via_app ON preme.loan_liabilities;

CREATE POLICY ll_select_via_app ON preme.loan_liabilities
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_liabilities.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY ll_insert_via_app ON preme.loan_liabilities
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY ll_update_via_app ON preme.loan_liabilities
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_liabilities.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY ll_delete_via_app ON preme.loan_liabilities
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_liabilities.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

-- ---------------------------------------------------------------------------
-- preme.loan_assets
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS las_select_via_app ON preme.loan_assets;
DROP POLICY IF EXISTS las_insert_via_app ON preme.loan_assets;
DROP POLICY IF EXISTS las_update_via_app ON preme.loan_assets;
DROP POLICY IF EXISTS las_delete_via_app ON preme.loan_assets;

CREATE POLICY las_select_via_app ON preme.loan_assets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_assets.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY las_insert_via_app ON preme.loan_assets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY las_update_via_app ON preme.loan_assets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_assets.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY las_delete_via_app ON preme.loan_assets
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_assets.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

-- ---------------------------------------------------------------------------
-- preme.loan_reo_properties
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS lr_select_via_app ON preme.loan_reo_properties;
DROP POLICY IF EXISTS lr_insert_via_app ON preme.loan_reo_properties;
DROP POLICY IF EXISTS lr_update_via_app ON preme.loan_reo_properties;
DROP POLICY IF EXISTS lr_delete_via_app ON preme.loan_reo_properties;

CREATE POLICY lr_select_via_app ON preme.loan_reo_properties
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_reo_properties.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY lr_insert_via_app ON preme.loan_reo_properties
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY lr_update_via_app ON preme.loan_reo_properties
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_reo_properties.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY lr_delete_via_app ON preme.loan_reo_properties
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_reo_properties.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

-- ---------------------------------------------------------------------------
-- preme.loan_declarations
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS ld_select_via_app ON preme.loan_declarations;
DROP POLICY IF EXISTS ld_insert_via_app ON preme.loan_declarations;
DROP POLICY IF EXISTS ld_update_via_app ON preme.loan_declarations;
DROP POLICY IF EXISTS ld_delete_via_app ON preme.loan_declarations;

CREATE POLICY ld_select_via_app ON preme.loan_declarations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_declarations.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY ld_insert_via_app ON preme.loan_declarations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY ld_update_via_app ON preme.loan_declarations
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_declarations.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

CREATE POLICY ld_delete_via_app ON preme.loan_declarations
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM preme.loan_applications la
    WHERE la.id = loan_declarations.loan_application_id
      AND (la.user_id = (select auth.uid()) OR la.applicant_email = get_user_email())));

-- ---------------------------------------------------------------------------
-- preme.pii_access_log — intentionally NO policies. service_role only.
-- ---------------------------------------------------------------------------
-- Superusers and service_role bypass RLS; authenticated/anon see zero rows.

COMMIT;
