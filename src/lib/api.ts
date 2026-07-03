import { invoke } from "@tauri-apps/api/core";
import type {
  User,
  LoginRequest,
  CreateUser,
  UpdateUser,
  Product,
  CreateProduct,
  UpdateProduct,
  Category,
  Customer,
  CreateCustomer,
  UpdateCustomer,
  Sale,
  SaleItem,
  CreateSale,
} from "./types";

// Auth
export const api = {
  // Auth
  login: (request: LoginRequest) => invoke<User>("login", { request }),
  logout: () => invoke<void>("logout"),
  getCurrentUser: () => invoke<User | null>("get_current_user"),

  // Users
  createUser: (user: CreateUser) => invoke<User>("create_user", { user }),
  updateUser: (user: UpdateUser) => invoke<User>("update_user", { user }),
  listUsers: () => invoke<User[]>("list_users"),
  toggleUserActive: (id: number) => invoke<void>("toggle_user_active", { id }),

  // Products
  createProduct: (product: CreateProduct) => invoke<Product>("create_product", { product }),
  updateProduct: (product: UpdateProduct) => invoke<Product>("update_product", { product }),
  listProducts: () => invoke<Product[]>("list_products"),
  searchProductByCode: (code: string) => invoke<Product | null>("search_product_by_code", { code }),
  searchProductsByName: (name: string) => invoke<Product[]>("search_products_by_name", { name }),
  getProductBarcodes: (productId: number) => invoke<{ id: number; product_id: number; barcode: string; label: string | null }[]>("get_product_barcodes", { productId }),
  addProductBarcode: (data: { product_id: number; barcode: string; label: string | null }) => invoke<{ id: number; product_id: number; barcode: string; label: string | null }>("add_product_barcode", { data }),
  removeProductBarcode: (barcodeId: number) => invoke<void>("remove_product_barcode", { barcodeId }),

  // Categories
  createCategory: (category: { name: string; description: string | null }) =>
    invoke<Category>("create_category", { category }),
  updateCategory: (id: number, name: string, description: string | null) =>
    invoke<Category>("update_category", { id, name, description }),
  listCategories: () => invoke<Category[]>("list_categories"),

  // Customers
  createCustomer: (customer: CreateCustomer) => invoke<Customer>("create_customer", { customer }),
  updateCustomer: (customer: UpdateCustomer) => invoke<Customer>("update_customer", { customer }),
  listCustomers: () => invoke<Customer[]>("list_customers"),
  searchCustomers: (query: string) => invoke<Customer[]>("search_customers", { query }),

  // Sales
  createSale: (sale: CreateSale) => invoke<Sale>("create_sale", { sale }),
  getSaleItems: (saleId: number) => invoke<SaleItem[]>("get_sale_items", { saleId }),
  getDailySales: (date: string) => invoke<Sale[]>("get_daily_sales", { date }),

  // Inventory
  adjustInventory: (adjustment: {
    product_id: number;
    adjustment_type: string;
    quantity: number;
    reason: string;
  }) => invoke<void>("adjust_inventory", { adjustment }),
  listAdjustments: (productId?: number) =>
    invoke<unknown[]>("list_adjustments", { productId: productId ?? null }),

  // Hardware
  testPrinter: () => invoke<string>("test_printer"),
  printTicket: (saleId: number) => invoke<void>("print_ticket", { saleId }),
  openCashDrawer: () => invoke<void>("open_cash_drawer"),
  startScale: () => invoke<void>("start_scale"),
  stopScale: () => invoke<void>("stop_scale"),
  getScaleWeight: () => invoke<number>("get_scale_weight"),
  configureScale: (port: string, baudRate: number) => invoke<void>("configure_scale", { port, baudRate }),
  configurePrinter: (devicePath: string) => invoke<void>("configure_printer", { devicePath }),
  configureBusiness: (name: string, address: string | null) => invoke<void>("configure_business", { name, address }),
  getHardwareConfig: () => invoke<Record<string, string>>("get_hardware_config"),
  listSerialPorts: () => invoke<string[]>("list_serial_ports"),

  // Network
  getNetworkConfig: () => invoke<{ role: string; port: number; server_ip: string | null }>("get_network_config"),
  setNetworkConfig: (role: string, port: number, serverIp: string | null) =>
    invoke<void>("set_network_config", { role, port, serverIp }),
  checkServerConnection: () => invoke<boolean>("check_server_connection"),
  isConfigured: () => invoke<boolean>("is_configured"),

  // Reports
  getDailySummary: (date: string) => invoke<{
    total_sales: number; total_transactions: number; total_cash: number;
    total_card: number; total_transfer: number; total_items_sold: number;
  }>("get_daily_summary", { date }),
  getSalesByRange: (from: string, to: string) => invoke<{ date: string; total: number; transactions: number }[]>("get_sales_by_range", { from, to }),
  getTopProducts: (from: string, to: string, limit: number) => invoke<{
    product_id: number; product_name: string; total_quantity: number; total_revenue: number; times_sold: number;
  }[]>("get_top_products", { from, to, limit }),
  getCashCutSummary: () => invoke<{
    total_sales: number; cash_sales: number; card_sales: number;
    transfer_sales: number; transactions: number; last_cut_date: string | null;
  }>("get_cash_cut_summary"),
  createCashCut: (actualCash: number, notes: string | null) => invoke<{
    id: number; user_id: number; expected_cash: number; actual_cash: number;
    difference: number; notes: string | null; created_at: string;
  }>("create_cash_cut", { actualCash, notes }),
  getCashCuts: (from: string, to: string) => invoke<{
    id: number; user_id: number; expected_cash: number; actual_cash: number;
    difference: number; notes: string | null; created_at: string;
  }[]>("get_cash_cuts", { from, to }),

  // Cash deliveries & quick cut
  createCashDelivery: (amount: number, supervisorName: string | null, notes: string | null) =>
    invoke<{ id: number; amount: number; supervisor_name: string | null; created_at: string }>("create_cash_delivery", { amount, supervisorName, notes }),
  getTodayDeliveries: () => invoke<{ id: number; amount: number; supervisor_name: string | null; notes: string | null; created_at: string }[]>("get_today_deliveries"),
  quickCashCut: () => invoke<{
    total_sales: number; transactions: number; cash_total: number; card_total: number;
    transfer_total: number; credit_total: number; deliveries_total: number;
    deliveries_count: number; cash_in_register: number; date: string;
  }>("quick_cash_cut"),

  // Print receipts
  printDeliveryReceipt: (amount: number, supervisorName: string, deliveryId: number) =>
    invoke<void>("print_delivery_receipt", { amount, supervisorName, deliveryId }),
  printCashCutReceipt: (data: {
    totalSales: number; transactions: number; cashTotal: number; cardTotal: number;
    transferTotal: number; creditTotal: number; deliveriesTotal: number;
    deliveriesCount: number; cashInRegister: number;
  }) => invoke<void>("print_cash_cut_receipt", data),

  // Returns
  createReturn: (items: { product_id: number; product_name: string; quantity: number; unit_price: number }[], reason: string | null) =>
    invoke<{ id: number; total: number; items_count: number; created_at: string }>("create_return", { items, reason }),
};
