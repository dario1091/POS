// Database models
export interface User {
  id: number;
  username: string;
  full_name: string;
  role: "admin" | "cajero";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

export interface Product {
  id: number;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: number | null;
  sale_price: number;
  cost_price: number;
  stock: number;
  unit: "pieza" | "kg";
  min_stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  credit_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: number;
  customer_id: number | null;
  user_id: number;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "efectivo" | "tarjeta" | "transferencia" | "mixto" | "credito";
  amount_paid: number;
  change_amount: number;
  machine_id: string;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

// DTOs
export interface CreateUser {
  username: string;
  password: string;
  full_name: string;
  role: "admin" | "cajero";
}

export interface UpdateUser {
  id: number;
  username?: string;
  password?: string;
  full_name?: string;
  role?: string;
  active?: boolean;
}

export interface CreateProduct {
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: number | null;
  sale_price: number;
  cost_price: number;
  stock: number;
  unit: "pieza" | "kg";
  min_stock: number;
}

export interface UpdateProduct {
  id: number;
  barcode?: string;
  name?: string;
  description?: string;
  category_id?: number;
  sale_price?: number;
  cost_price?: number;
  stock?: number;
  unit?: string;
  min_stock?: number;
  active?: boolean;
}

export interface CreateCustomer {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit?: number;
}

export interface UpdateCustomer {
  id: number;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit?: number;
}

export interface SaleItemInput {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface PaymentInput {
  method: "efectivo" | "tarjeta" | "transferencia" | "credito";
  amount: number;
  reference?: string | null;
}

export interface CreateSale {
  customer_id: number | null;
  items: SaleItemInput[];
  payments: PaymentInput[];
  discount: number;
}

export interface ProductBarcode {
  id: number;
  product_id: number;
  barcode: string;
  label: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}
