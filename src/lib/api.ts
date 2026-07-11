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
  validateAdminPassword: (password: string) => invoke<boolean>("validate_admin_password", { password }),

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
  bulkAdjustInventory: (items: { product_id: number; quantity: number; sale_price: number; cost_price: number }[], reason: string) =>
    invoke<number>("bulk_adjust_inventory", { items, reason }),
  listAdjustments: (productId?: number) =>
    invoke<unknown[]>("list_adjustments", { productId: productId ?? null }),
  validateCsvProducts: (csvContent: string) =>
    invoke<{
      valid_count: number;
      error_count: number;
      warnings: string[];
      errors: { row: number; field: string; message: string }[];
      rows: { row_number: number; barcode: string | null; name: string; sale_price: number; cost_price: number; stock: number; category: string; unit: string; price_type: string; valid: boolean }[];
    }>("validate_csv_products", { csvContent }),
  importCsvProducts: (rows: { row_number: number; barcode: string | null; name: string; sale_price: number; cost_price: number; stock: number; category: string; unit: string; price_type: string; valid: boolean }[]) =>
    invoke<number>("import_csv_products", { rows }),

  // Hardware
  testPrinter: () => invoke<string>("test_printer"),
  printTicket: (saleId: number) => invoke<void>("print_ticket", { saleId }),
  openCashDrawer: () => invoke<void>("open_cash_drawer"),
  startScale: () => invoke<void>("start_scale"),
  stopScale: () => invoke<void>("stop_scale"),
  getScaleWeight: () => invoke<number>("get_scale_weight"),
  configureScale: (port: string, baudRate: number) => invoke<void>("configure_scale", { port, baudRate }),
  configurePrinter: (deviceKey: string) => invoke<void>("configure_printer", { deviceKey }),
  configureBusiness: (name: string, address: string | null) => invoke<void>("configure_business", { name, address }),
  getHardwareConfig: () => invoke<Record<string, string>>("get_hardware_config"),
  listSerialPorts: () => invoke<string[]>("list_serial_ports"),
  listPrinters: () => invoke<{ path: string; label: string }[]>("list_printers"),

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
  getSalesByCategory: (from: string, to: string) => invoke<{
    category_id: number; category_name: string; total_revenue: number; total_quantity: number; total_transactions: number;
  }[]>("get_sales_by_category", { from, to }),
  getCashCutSummary: () => invoke<{
    total_sales: number; cash_sales: number; card_sales: number;
    transfer_sales: number; credit_sales: number; transactions: number;
    last_cut_date: string | null;
    deliveries_total: number; deliveries_count: number;
    supplier_payments_total: number; supplier_payments_count: number;
    supplier_payments: { supplier_name: string; amount: number; created_at: string }[];
    cash_in_register: number;
  }>("get_cash_cut_summary"),
  createCashCut: (actualCash: number, notes: string | null) => invoke<{
    id: number; user_id: number; expected_cash: number; actual_cash: number;
    difference: number; notes: string | null; created_at: string;
    total_sales: number; cash_sales: number; card_sales: number;
    transfer_sales: number; credit_sales: number; transactions: number;
    deliveries_total: number; deliveries_count: number;
    supplier_payments_total: number; supplier_payments_count: number;
  }>("create_cash_cut", { actualCash, notes }),
  getCashCuts: (from: string, to: string) => invoke<{
    id: number; user_id: number; expected_cash: number; actual_cash: number;
    difference: number; notes: string | null; created_at: string;
    total_sales: number; cash_sales: number; card_sales: number;
    transfer_sales: number; credit_sales: number; transactions: number;
    deliveries_total: number; deliveries_count: number;
    supplier_payments_total: number; supplier_payments_count: number;
  }[]>("get_cash_cuts", { from, to }),

  // Cash deliveries & quick cut
  createCashDelivery: (amount: number, supervisorName: string | null, notes: string | null) =>
    invoke<{ id: number; amount: number; supervisor_name: string | null; created_at: string }>("create_cash_delivery", { amount, supervisorName, notes }),
  getTodayDeliveries: () => invoke<{ id: number; amount: number; supervisor_name: string | null; notes: string | null; created_at: string }[]>("get_today_deliveries"),
  createSupplierPayment: (amount: number, supplierName: string, notes: string | null) =>
    invoke<{ id: number; user_id: number; amount: number; supplier_name: string; notes: string | null; created_at: string }>("create_supplier_payment", { amount, supplierName, notes }),
  quickCashCut: () => invoke<{
    total_sales: number; transactions: number; cash_total: number; card_total: number;
    transfer_total: number; credit_total: number; deliveries_total: number;
    deliveries_count: number; supplier_payments_total: number; supplier_payments_count: number;
    supplier_payments: { supplier_name: string; amount: number; created_at: string }[];
    cash_in_register: number; date: string;
  }>("quick_cash_cut"),
  getCashCutByDate: (date: string) => invoke<{
    total_sales: number; transactions: number; cash_total: number; card_total: number;
    transfer_total: number; credit_total: number; deliveries_total: number;
    deliveries_count: number; supplier_payments_total: number; supplier_payments_count: number;
    supplier_payments: { supplier_name: string; amount: number; created_at: string }[];
    cash_in_register: number; date: string;
  }>("get_cash_cut_by_date", { date }),

  // Print receipts
  printDeliveryReceipt: (amount: number, supervisorName: string, deliveryId: number) =>
    invoke<void>("print_delivery_receipt", { amount, supervisorName, deliveryId }),
  printCashCutReceipt: (data: {
    totalSales: number; transactions: number; cashTotal: number; cardTotal: number;
    transferTotal: number; creditTotal: number; deliveriesTotal: number;
    deliveriesCount: number; cashInRegister: number;
  }) => invoke<void>("print_cash_cut_receipt", data),
  printLabel: (lines: { text: string; size: string; alignment: string; bold: boolean }[], copies: number, barcode?: string) =>
    invoke<void>("print_label", { lines, copies, barcode: barcode ?? null }),

  // Label printer (TSPL)
  configureLabelPrinter: (devicePath: string) => invoke<void>("configure_label_printer", { devicePath }),
  testLabelPrinter: () => invoke<string>("test_label_printer"),
  calibrateLabelPrinter: () => invoke<string>("calibrate_label_printer"),
  listLabelPrinters: () => invoke<{ path: string; label: string }[]>("list_label_printers"),

  // Returns
  createReturn: (items: { product_id: number; product_name: string; quantity: number; unit_price: number }[], reason: string | null) =>
    invoke<{ id: number; total: number; items_count: number; created_at: string }>("create_return", { items, reason }),

  // Credit payments (abonos)
  createCreditPayment: (customerId: number, amount: number, paymentMethod: string, reference: string | null) =>
    invoke<{ id: number; customer_name: string; amount: number; new_balance: number; created_at: string }>("create_credit_payment", { customerId, amount, paymentMethod, reference }),

  // Cancel sale
  cancelSale: (saleId: number, reason: string) =>
    invoke<{ sale_id: number; total_restored: number; items_restored: number }>("cancel_sale", { saleId, reason }),

  // Recent sales (cashier history)
  getRecentSales: (limit: number) =>
    invoke<{ id: number; total: number; payment_method: string; items_count: number; cancelled: boolean; created_at: string }[]>("get_recent_sales", { limit }),

  // Updater
  checkForUpdates: () => invoke<{ current_version: string; latest_version: string; has_update: boolean; download_url: string | null }>("check_for_updates"),
  installUpdate: (downloadUrl: string) => invoke<string>("install_update", { downloadUrl }),
  restartApp: () => invoke<void>("restart_app"),

  // Backup
  createBackup: () => invoke<{ filename: string; path: string; size_bytes: number; created_at: string }>("create_backup"),
  listBackups: () => invoke<{ filename: string; path: string; size_bytes: number; created_at: string }[]>("list_backups"),
  getBackupConfig: () => invoke<{ enabled: boolean; interval_hours: number; max_backups: number; backup_path: string }>("get_backup_config"),
  setBackupConfig: (config: { enabled: boolean; interval_hours: number; max_backups: number; backup_path: string }) => invoke<void>("set_backup_config", { config }),
};
