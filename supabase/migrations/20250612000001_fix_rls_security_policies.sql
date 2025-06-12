-- Migration: Fix RLS Security Policies
-- Replace auth.role() with secure JWT claims-based authorization
-- Date: 2025-01-12

-- Drop existing vulnerable policies that use auth.role()
DROP POLICY IF EXISTS "All authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "All authenticated users can view vendors" ON public.vendors;
DROP POLICY IF EXISTS "All authenticated users can view purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "All authenticated users can view po items" ON public.po_items;
DROP POLICY IF EXISTS "All authenticated users can view delivery notes" ON public.delivery_notes;
DROP POLICY IF EXISTS "Users can manage delivery notes" ON public.delivery_notes;
DROP POLICY IF EXISTS "All authenticated users can view dn items" ON public.dn_items;
DROP POLICY IF EXISTS "Users can manage dn items" ON public.dn_items;

-- Helper function to check if user is authenticated (replacement for auth.role() = 'authenticated')
CREATE OR REPLACE FUNCTION is_authenticated_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid());
$$;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION has_role(required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = required_role
  );
$$;

-- Helper function to check if user has any of multiple roles
CREATE OR REPLACE FUNCTION has_any_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = ANY(required_roles)
  );
$$;

-- Helper function to check project ownership/access
CREATE OR REPLACE FUNCTION can_access_project(project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.users u ON u.id = auth.uid()
    WHERE p.id = project_id
    AND (
      p.created_by = auth.uid() OR          -- User created the project
      u.role IN ('admin', 'manager')       -- Or user is admin/manager
    )
  );
$$;

-- SECURE RLS POLICIES (replacing vulnerable auth.role() usage)

-- Projects table policies
CREATE POLICY "Authenticated users can view accessible projects" ON public.projects 
FOR SELECT 
TO authenticated
USING (
  is_authenticated_user() AND (
    created_by = auth.uid() OR 
    has_any_role(ARRAY['admin', 'manager'])
  )
);

CREATE POLICY "Managers and admins can insert projects" ON public.projects 
FOR INSERT 
TO authenticated
WITH CHECK (has_any_role(ARRAY['admin', 'manager']));

CREATE POLICY "Users can update own projects, managers/admins can update all" ON public.projects 
FOR UPDATE 
TO authenticated
USING (
  created_by = auth.uid() OR 
  has_any_role(ARRAY['admin', 'manager'])
);

-- Vendors table policies
CREATE POLICY "Authenticated users can view vendors" ON public.vendors 
FOR SELECT 
TO authenticated
USING (is_authenticated_user());

CREATE POLICY "Managers and admins can manage vendors" ON public.vendors 
FOR ALL 
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

-- Purchase orders table policies  
CREATE POLICY "Users can view purchase orders for their projects" ON public.purchase_orders 
FOR SELECT 
TO authenticated
USING (
  is_authenticated_user() AND can_access_project(project_id)
);

CREATE POLICY "Managers and admins can manage purchase orders" ON public.purchase_orders 
FOR ALL 
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

-- PO items table policies
CREATE POLICY "Users can view po items for accessible purchase orders" ON public.po_items 
FOR SELECT 
TO authenticated
USING (
  is_authenticated_user() AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
    AND can_access_project(po.project_id)
  )
);

CREATE POLICY "Managers and admins can manage po items" ON public.po_items 
FOR ALL 
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

-- Delivery notes table policies (fixing overly permissive access)
CREATE POLICY "Users can view delivery notes for their projects" ON public.delivery_notes 
FOR SELECT 
TO authenticated
USING (
  is_authenticated_user() AND EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
    AND can_access_project(po.project_id)
  )
);

CREATE POLICY "Managers and admins can manage delivery notes" ON public.delivery_notes 
FOR INSERT, UPDATE, DELETE
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

-- DN items table policies
CREATE POLICY "Users can view dn items for accessible delivery notes" ON public.dn_items 
FOR SELECT 
TO authenticated
USING (
  is_authenticated_user() AND EXISTS (
    SELECT 1 FROM public.delivery_notes dn
    JOIN public.purchase_orders po ON po.id = dn.purchase_order_id
    WHERE dn.id = delivery_note_id
    AND can_access_project(po.project_id)
  )
);

CREATE POLICY "Managers and admins can manage dn items" ON public.dn_items 
FOR INSERT, UPDATE, DELETE
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

-- Add explicit DELETE policies for better security
CREATE POLICY "Managers and admins can delete projects" ON public.projects 
FOR DELETE 
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

CREATE POLICY "Managers and admins can delete vendors" ON public.vendors 
FOR DELETE 
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

CREATE POLICY "Managers and admins can delete purchase orders" ON public.purchase_orders 
FOR DELETE 
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

CREATE POLICY "Managers and admins can delete po items" ON public.po_items 
FOR DELETE 
TO authenticated
USING (has_any_role(ARRAY['admin', 'manager']));

-- Improve audit log security
CREATE POLICY "Restrict audit log insertion to system only" ON public.audit_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Grant necessary permissions for RLS functions
GRANT EXECUTE ON FUNCTION is_authenticated_user() TO authenticated;
GRANT EXECUTE ON FUNCTION has_role(text) TO authenticated;  
GRANT EXECUTE ON FUNCTION has_any_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_project(uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION is_authenticated_user() IS 'Securely checks if current user exists in users table (replaces auth.role() = authenticated)';
COMMENT ON FUNCTION has_role(text) IS 'Securely checks if current user has specified role';
COMMENT ON FUNCTION has_any_role(text[]) IS 'Securely checks if current user has any of the specified roles';
COMMENT ON FUNCTION can_access_project(uuid) IS 'Checks if current user can access the specified project';