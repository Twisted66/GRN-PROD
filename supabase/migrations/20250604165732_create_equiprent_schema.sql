-- Enable RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user');
CREATE TYPE project_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE po_status AS ENUM ('draft', 'sent', 'confirmed', 'completed', 'cancelled');
CREATE TYPE dn_item_status AS ENUM ('delivered', 'partial_return', 'fully_returned');

-- Users table (extends auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'user',
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Projects table
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status project_status DEFAULT 'active' NOT NULL,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES public.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Vendors table
CREATE TABLE public.vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Purchase Orders table
CREATE TABLE public.purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES public.projects(id) NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  status po_status DEFAULT 'draft' NOT NULL,
  total_amount DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  po_date DATE,
  document_url TEXT,
  created_by UUID REFERENCES public.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- PO Items table
CREATE TABLE public.po_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(8,2),
  line_total DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Delivery Notes table
CREATE TABLE public.delivery_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dn_number TEXT UNIQUE NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) NOT NULL,
  delivery_date DATE NOT NULL,
  received_by TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- DN Items table (Critical for tracking)
CREATE TABLE public.dn_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE CASCADE NOT NULL,
  po_item_id UUID REFERENCES public.po_items(id) NOT NULL,
  delivered_quantity INTEGER NOT NULL,
  returned_quantity INTEGER DEFAULT 0,
  returned_at TIMESTAMPTZ,
  status dn_item_status DEFAULT 'delivered' NOT NULL,
  daily_rate DECIMAL(8,2),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Audit Logs table
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_po_project_id ON public.purchase_orders(project_id);
CREATE INDEX idx_po_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX idx_po_items_po_id ON public.po_items(purchase_order_id);
CREATE INDEX idx_dn_po_id ON public.delivery_notes(purchase_order_id);
CREATE INDEX idx_dn_items_delivery_note_id ON public.dn_items(delivery_note_id);
CREATE INDEX idx_dn_items_po_item_id ON public.dn_items(po_item_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for projects table
CREATE POLICY "All authenticated users can view projects" ON public.projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Managers and admins can insert projects" ON public.projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);
CREATE POLICY "Managers and admins can update projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- RLS Policies for vendors table
CREATE POLICY "All authenticated users can view vendors" ON public.vendors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Managers and admins can manage vendors" ON public.vendors FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- RLS Policies for purchase_orders table
CREATE POLICY "All authenticated users can view purchase orders" ON public.purchase_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Managers and admins can manage purchase orders" ON public.purchase_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- RLS Policies for po_items table
CREATE POLICY "All authenticated users can view po items" ON public.po_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Managers and admins can manage po items" ON public.po_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- RLS Policies for delivery_notes table
CREATE POLICY "All authenticated users can view delivery notes" ON public.delivery_notes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage delivery notes" ON public.delivery_notes FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for dn_items table
CREATE POLICY "All authenticated users can view dn items" ON public.dn_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage dn items" ON public.dn_items FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for audit_logs table
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
