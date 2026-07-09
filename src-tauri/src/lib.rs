use std::sync::Mutex;
use std::path::PathBuf;
use tauri::Manager;

mod commands;
mod db;
mod hardware;
mod network;

use db::connection::{create_pool, DbPool};
use db::models::User;
use hardware::scale::ScaleState;
use network::config::NetworkConfig;

pub struct AppState {
    pub db: DbPool,
    pub current_user: Mutex<Option<User>>,
    pub scale: ScaleState,
    pub network_config: Mutex<NetworkConfig>,
    pub config_path: PathBuf,
}

fn seed_database(pool: &DbPool) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    // Check if admin user exists
    let user_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if user_count == 0 {
        // Create default admin user (password: admin123)
        let password_hash = commands::auth::hash_password("admin123")?;
        conn.execute(
            "INSERT INTO users (username, password_hash, full_name, role) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params!["admin", password_hash, "Administrador", "admin"],
        )
        .map_err(|e| e.to_string())?;
        println!("Created default admin user (admin / admin123)");
    }

    // Check if default customer exists
    let cust_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM customers", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if cust_count == 0 {
        conn.execute(
            "INSERT INTO customers (name, phone) VALUES (?1, ?2)",
            rusqlite::params!["Público en general", ""],
        )
        .map_err(|e| e.to_string())?;
        println!("Created default customer: Público en general");
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Get app data directory for SQLite
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            let db_path = app_data_dir.join("pos.db");
            println!("Database path: {:?}", db_path);

            // Create connection pool
            let pool = create_pool(&db_path)
                .expect("Failed to create database pool");

            // Run migrations
            {
                let conn = pool.get().expect("Failed to get connection for migrations");
                db::migrations::run_migrations(&conn)
                    .expect("Failed to run migrations");
            }

            // Seed initial data
            seed_database(&pool).expect("Failed to seed database");

            // Load network config
            let config_path = app_data_dir.join("network.json");
            let net_config = NetworkConfig::load(&config_path);
            println!("Network role: {}", net_config.role);

            // Start LAN server if role is server
            if net_config.is_server() {
                let server_pool = pool.clone();
                let port = net_config.port;
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = network::server::start_server(server_pool, port).await {
                        eprintln!("LAN Server error: {}", e);
                    }
                });
            }

            // Start automatic backup thread
            let backup_config = db::backup::BackupConfig::load(&app_data_dir);
            let backup_dir = if backup_config.backup_path.is_empty() {
                app_data_dir.join("backups")
            } else {
                std::path::PathBuf::from(&backup_config.backup_path)
            };
            db::backup::start_auto_backup(pool.clone(), backup_dir, backup_config);

            // Manage state
            app.manage(AppState {
                db: pool,
                current_user: Mutex::new(None),
                scale: ScaleState::new(),
                network_config: Mutex::new(net_config),
                config_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::login,
            commands::auth::logout,
            commands::auth::get_current_user,
            commands::auth::validate_admin_password,
            // Users
            commands::users::create_user,
            commands::users::update_user,
            commands::users::list_users,
            commands::users::toggle_user_active,
            // Products
            commands::products::create_product,
            commands::products::update_product,
            commands::products::list_products,
            commands::products::search_product_by_code,
            commands::products::search_products_by_name,
            commands::products::get_product_barcodes,
            commands::products::add_product_barcode,
            commands::products::remove_product_barcode,
            // Categories
            commands::categories::create_category,
            commands::categories::update_category,
            commands::categories::list_categories,
            // Customers
            commands::customers::create_customer,
            commands::customers::update_customer,
            commands::customers::list_customers,
            commands::customers::search_customers,
            // Sales
            commands::sales::create_sale,
            commands::sales::get_sale_items,
            commands::sales::get_daily_sales,
            // Inventory
            commands::inventory::adjust_inventory,
            commands::inventory::list_adjustments,
            commands::inventory::bulk_adjust_inventory,
            commands::inventory::validate_csv_products,
            commands::inventory::import_csv_products,
            // Hardware
            commands::hardware::test_printer,
            commands::hardware::print_ticket,
            commands::hardware::open_cash_drawer,
            commands::hardware::start_scale,
            commands::hardware::stop_scale,
            commands::hardware::get_scale_weight,
            commands::hardware::configure_scale,
            commands::hardware::configure_printer,
            commands::hardware::configure_business,
            commands::hardware::get_hardware_config,
            commands::hardware::list_serial_ports,
            commands::hardware::list_printers,
            commands::hardware::print_delivery_receipt,
            commands::hardware::print_cash_cut_receipt,
            commands::hardware::print_label,
            commands::hardware::configure_label_printer,
            commands::hardware::test_label_printer,
            commands::hardware::calibrate_label_printer,
            commands::hardware::list_label_printers,
            // Network
            commands::network::get_network_config,
            commands::network::set_network_config,
            commands::network::check_server_connection,
            commands::network::is_configured,
            // Reports
            commands::reports::get_daily_summary,
            commands::reports::get_sales_by_range,
            commands::reports::get_top_products,
            commands::reports::get_cash_cut_summary,
            commands::reports::create_cash_cut,
            commands::reports::get_cash_cuts,
            commands::reports::create_cash_delivery,
            commands::reports::get_today_deliveries,
            commands::reports::create_supplier_payment,
            commands::reports::quick_cash_cut,
            commands::reports::create_return,
            commands::reports::create_credit_payment,
            commands::reports::cancel_sale,
            commands::reports::get_recent_sales,
            commands::reports::get_sales_by_category,
            // Updater
            commands::updater::check_for_updates,
            commands::updater::install_update,
            commands::updater::restart_app,
            // Backup
            commands::backup::create_backup,
            commands::backup::list_backups,
            commands::backup::get_backup_config,
            commands::backup::set_backup_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
