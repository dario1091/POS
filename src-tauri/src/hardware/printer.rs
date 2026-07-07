use std::fs::OpenOptions;
use std::io::Write;

/// ESC/POS command constants
const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;
const LF: u8 = 0x0A;

/// ESC/POS Printer driver
/// Writes raw bytes to a USB device file (e.g., /dev/usb/lp0)
pub struct Printer {
    device_path: String,
}

impl Printer {
    pub fn new(device_path: &str) -> Self {
        Self {
            device_path: device_path.to_string(),
        }
    }

    /// Open device and write buffer
    fn write_to_device(&self, data: &[u8]) -> Result<(), String> {
        let mut file = OpenOptions::new()
            .write(true)
            .open(&self.device_path)
            .map_err(|e| format!("No se pudo abrir la impresora ({}): {}", self.device_path, e))?;

        file.write_all(data)
            .map_err(|e| format!("Error escribiendo a la impresora: {}", e))?;

        file.flush()
            .map_err(|e| format!("Error flush impresora: {}", e))?;

        Ok(())
    }

    /// Build and send a complete ticket
    pub fn print_ticket(&self, ticket: &TicketData) -> Result<(), String> {
        let mut buffer = Vec::new();

        // Initialize printer
        buffer.extend_from_slice(&[ESC, b'@']);

        // Center alignment
        buffer.extend_from_slice(&[ESC, b'a', 1]);

        // Bold ON + Double height for business name
        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(&[GS, b'!', 0x11]); // Double width + height
        buffer.extend_from_slice(ticket.business_name.as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x00]); // Normal size
        buffer.extend_from_slice(&[ESC, b'E', 0]);    // Bold OFF

        // Address (if any)
        if let Some(ref address) = ticket.business_address {
            buffer.extend_from_slice(address.as_bytes());
            buffer.push(LF);
        }

        // Date
        buffer.extend_from_slice(ticket.date.as_bytes());
        buffer.push(LF);

        // Ticket number
        buffer.extend_from_slice(format!("Ticket #{}", ticket.sale_id).as_bytes());
        buffer.push(LF);

        if let Some(ref cashier) = ticket.cashier_name {
            buffer.extend_from_slice(format!("Cajero: {}", cashier).as_bytes());
            buffer.push(LF);
        }

        // Separator
        buffer.extend_from_slice(&[ESC, b'a', 0]); // Left align
        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        // Items
        for item in &ticket.items {
            // Product name - full width (48 chars for 80mm)
            let name = if item.name.len() > 48 {
                &item.name[..48]
            } else {
                &item.name
            };
            buffer.extend_from_slice(name.as_bytes());
            buffer.push(LF);

            // Quantity x Price = Subtotal (right-aligned on 48 chars)
            let left = format!("  {} x ${:.2}", format_qty(item.quantity), item.unit_price);
            let right = format!("${:.2}", item.subtotal);
            let spaces = if left.len() + right.len() < 48 {
                48 - left.len() - right.len()
            } else {
                2
            };
            let detail = format!("{}{}{}", left, " ".repeat(spaces), right);
            buffer.extend_from_slice(detail.as_bytes());
            buffer.push(LF);
        }

        // Separator
        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        // Totals - right aligned
        buffer.extend_from_slice(&[ESC, b'a', 2]); // Right align

        if ticket.discount > 0.0 {
            buffer.extend_from_slice(format!("Subtotal: ${:.2}", ticket.subtotal).as_bytes());
            buffer.push(LF);
            buffer.extend_from_slice(format!("Descuento: -${:.2}", ticket.discount).as_bytes());
            buffer.push(LF);
        }

        // Total in bold + double size
        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(&[GS, b'!', 0x11]);
        buffer.extend_from_slice(format!("TOTAL: ${:.2}", ticket.total).as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x00]);
        buffer.extend_from_slice(&[ESC, b'E', 0]);

        // Payment info
        buffer.extend_from_slice(&[ESC, b'a', 0]); // Left align
        buffer.push(LF);

        for payment in &ticket.payments {
            buffer.extend_from_slice(format!("Pago ({}): ${:.2}", payment.method, payment.amount).as_bytes());
            buffer.push(LF);
        }

        if ticket.change > 0.0 {
            buffer.extend_from_slice(&[ESC, b'E', 1]);
            buffer.extend_from_slice(format!("CAMBIO: ${:.2}", ticket.change).as_bytes());
            buffer.extend_from_slice(&[ESC, b'E', 0]);
            buffer.push(LF);
        }

        // Customer
        if let Some(ref customer) = ticket.customer_name {
            buffer.push(LF);
            buffer.extend_from_slice(format!("Cliente: {}", customer).as_bytes());
            buffer.push(LF);
        }

        // Footer
        buffer.push(LF);
        buffer.extend_from_slice(&[ESC, b'a', 1]); // Center
        buffer.extend_from_slice(b"Gracias por su compra!");
        buffer.push(LF);
        buffer.push(LF);

        // Feed and cut
        buffer.extend_from_slice(&[LF, LF, LF]);
        buffer.extend_from_slice(&[GS, b'V', 0x00]); // Full cut

        self.write_to_device(&buffer)
    }

    /// Print a test ticket
    pub fn print_test(&self) -> Result<(), String> {
        let mut buffer = Vec::new();

        // Initialize
        buffer.extend_from_slice(&[ESC, b'@']);

        // Center
        buffer.extend_from_slice(&[ESC, b'a', 1]);

        // Title
        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(&[GS, b'!', 0x11]);
        buffer.extend_from_slice(b"PRUEBA DE IMPRESORA");
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x00]);
        buffer.extend_from_slice(&[ESC, b'E', 0]);

        buffer.push(LF);
        buffer.extend_from_slice(b"POS System v0.1.0");
        buffer.push(LF);
        buffer.extend_from_slice(b"Impresora configurada OK");
        buffer.push(LF);
        buffer.push(LF);

        // Separator
        buffer.extend_from_slice(&[ESC, b'a', 0]);
        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        buffer.extend_from_slice(b"Texto normal");
        buffer.push(LF);

        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(b"Texto en negrita");
        buffer.extend_from_slice(&[ESC, b'E', 0]);
        buffer.push(LF);

        buffer.extend_from_slice(&[GS, b'!', 0x10]);
        buffer.extend_from_slice(b"Texto doble ancho");
        buffer.extend_from_slice(&[GS, b'!', 0x00]);
        buffer.push(LF);

        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        buffer.extend_from_slice(&[ESC, b'a', 1]);
        buffer.extend_from_slice(b"Si puedes leer esto,");
        buffer.push(LF);
        buffer.extend_from_slice(b"la impresora funciona!");
        buffer.push(LF);

        // Feed and cut
        buffer.extend_from_slice(&[LF, LF, LF]);
        buffer.extend_from_slice(&[GS, b'V', 0x00]);

        self.write_to_device(&buffer)
    }

    /// Open cash drawer via printer port
    pub fn open_cash_drawer(&self) -> Result<(), String> {
        // Standard ESC/POS cash drawer kick command
        // Pin 2: ESC p 0 25 250
        let cmd: [u8; 5] = [ESC, b'p', 0x00, 0x19, 0xFA];
        self.write_to_device(&cmd)
    }

    /// Print a custom label with configurable lines
    pub fn print_label(&self, lines: &[LabelLine], copies: u32) -> Result<(), String> {
        let mut buffer = Vec::new();

        for _ in 0..copies {
            // Initialize printer
            buffer.extend_from_slice(&[ESC, b'@']);

            for line in lines {
                // Set alignment
                let align_byte = match line.alignment.as_str() {
                    "center" => 1,
                    "right" => 2,
                    _ => 0, // left
                };
                buffer.extend_from_slice(&[ESC, b'a', align_byte]);

                // Set bold
                if line.bold {
                    buffer.extend_from_slice(&[ESC, b'E', 1]);
                }

                // Set size
                let size_byte = match line.size.as_str() {
                    "small" => 0x00,        // Normal
                    "normal" => 0x00,       // Normal
                    "large" => 0x11,        // Double width + height
                    "extra_large" => 0x22,  // Triple width + height (if supported)
                    _ => 0x00,
                };
                buffer.extend_from_slice(&[GS, b'!', size_byte]);

                // Print text
                buffer.extend_from_slice(line.text.as_bytes());
                buffer.push(LF);

                // Reset size and bold
                buffer.extend_from_slice(&[GS, b'!', 0x00]);
                if line.bold {
                    buffer.extend_from_slice(&[ESC, b'E', 0]);
                }
            }

            // Feed and cut
            buffer.extend_from_slice(&[LF, LF]);
            buffer.extend_from_slice(&[GS, b'V', 0x00]);
        }

        self.write_to_device(&buffer)
    }
}

/// Label line configuration
#[derive(Debug, serde::Deserialize)]
pub struct LabelLine {
    pub text: String,
    pub size: String,       // "small", "normal", "large", "extra_large"
    pub alignment: String,  // "left", "center", "right"
    pub bold: bool,
}

/// Ticket data structure
pub struct TicketData {
    pub business_name: String,
    pub business_address: Option<String>,
    pub date: String,
    pub sale_id: i64,
    pub cashier_name: Option<String>,
    pub customer_name: Option<String>,
    pub items: Vec<TicketItem>,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub payments: Vec<TicketPayment>,
    pub change: f64,
}

pub struct TicketItem {
    pub name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub subtotal: f64,
}

pub struct TicketPayment {
    pub method: String,
    pub amount: f64,
}

fn format_qty(qty: f64) -> String {
    if qty == qty.floor() {
        format!("{:.0}", qty)
    } else {
        format!("{:.3}", qty)
    }
}

/// Data for delivery receipt
pub struct DeliveryData {
    pub business_name: String,
    pub date: String,
    pub amount: f64,
    pub supervisor_name: String,
    pub cashier_name: String,
    pub delivery_number: i64,
}

/// Data for cash cut receipt
pub struct CashCutPrintData {
    pub business_name: String,
    pub date: String,
    pub cashier_name: String,
    pub total_sales: f64,
    pub transactions: i64,
    pub cash_total: f64,
    pub card_total: f64,
    pub transfer_total: f64,
    pub credit_total: f64,
    pub deliveries_total: f64,
    pub deliveries_count: i64,
    pub cash_in_register: f64,
}

impl Printer {
    /// Print cash delivery receipt
    pub fn print_delivery(&self, data: &DeliveryData) -> Result<(), String> {
        let mut buffer = Vec::new();

        // Initialize
        buffer.extend_from_slice(&[ESC, b'@']);

        // Center
        buffer.extend_from_slice(&[ESC, b'a', 1]);

        // Business name
        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(data.business_name.as_bytes());
        buffer.extend_from_slice(&[ESC, b'E', 0]);
        buffer.push(LF);

        // Title
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x11]);
        buffer.extend_from_slice(b"ENTREGA PARCIAL");
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x00]);
        buffer.push(LF);

        // Left align for details
        buffer.extend_from_slice(&[ESC, b'a', 0]);

        buffer.extend_from_slice(format!("Fecha: {}", data.date).as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(format!("Entrega #: {}", data.delivery_number).as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(format!("Cajero: {}", data.cashier_name).as_bytes());
        buffer.push(LF);

        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        // Amount - big and bold
        buffer.extend_from_slice(&[ESC, b'a', 1]); // Center
        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(&[GS, b'!', 0x11]);
        buffer.extend_from_slice(format!("${:.2}", data.amount).as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x00]);
        buffer.extend_from_slice(&[ESC, b'E', 0]);

        buffer.extend_from_slice(&[ESC, b'a', 0]); // Left
        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        buffer.push(LF);
        buffer.extend_from_slice(format!("Recibe: {}", data.supervisor_name).as_bytes());
        buffer.push(LF);
        buffer.push(LF);
        buffer.push(LF);
        buffer.extend_from_slice(b"Firma: ________________________");
        buffer.push(LF);
        buffer.push(LF);

        // Feed and cut
        buffer.extend_from_slice(&[LF, LF, LF]);
        buffer.extend_from_slice(&[GS, b'V', 0x00]);

        self.write_to_device(&buffer)
    }

    /// Print cash cut summary
    pub fn print_cash_cut(&self, data: &CashCutPrintData) -> Result<(), String> {
        let mut buffer = Vec::new();

        // Initialize
        buffer.extend_from_slice(&[ESC, b'@']);

        // Center
        buffer.extend_from_slice(&[ESC, b'a', 1]);

        // Business name
        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(data.business_name.as_bytes());
        buffer.extend_from_slice(&[ESC, b'E', 0]);
        buffer.push(LF);

        // Title
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x11]);
        buffer.extend_from_slice(b"CIERRE DE CAJA");
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x00]);
        buffer.push(LF);

        // Left align
        buffer.extend_from_slice(&[ESC, b'a', 0]);

        buffer.extend_from_slice(format!("Fecha: {}", data.date).as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(format!("Cajero: {}", data.cashier_name).as_bytes());
        buffer.push(LF);

        buffer.extend_from_slice(b"================================");
        buffer.push(LF);

        buffer.extend_from_slice(format!("Transacciones:       {}", data.transactions).as_bytes());
        buffer.push(LF);

        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(format!("VENTAS TOTAL: ${:.2}", data.total_sales).as_bytes());
        buffer.extend_from_slice(&[ESC, b'E', 0]);
        buffer.push(LF);

        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        buffer.extend_from_slice(format!("Efectivo:     ${:.2}", data.cash_total).as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(format!("Tarjeta:      ${:.2}", data.card_total).as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(format!("Transferencia:${:.2}", data.transfer_total).as_bytes());
        buffer.push(LF);

        if data.credit_total > 0.0 {
            buffer.extend_from_slice(format!("Credito:      ${:.2}", data.credit_total).as_bytes());
            buffer.push(LF);
        }

        buffer.extend_from_slice(b"------------------------------------------------");
        buffer.push(LF);

        if data.deliveries_count > 0 {
            buffer.extend_from_slice(format!("Entregas ({}): -${:.2}", data.deliveries_count, data.deliveries_total).as_bytes());
            buffer.push(LF);
            buffer.extend_from_slice(b"------------------------------------------------");
            buffer.push(LF);
        }

        // Cash in register - big
        buffer.extend_from_slice(&[ESC, b'a', 1]); // Center
        buffer.push(LF);
        buffer.extend_from_slice(b"EFECTIVO EN CAJA:");
        buffer.push(LF);
        buffer.extend_from_slice(&[ESC, b'E', 1]);
        buffer.extend_from_slice(&[GS, b'!', 0x11]);
        buffer.extend_from_slice(format!("${:.2}", data.cash_in_register).as_bytes());
        buffer.push(LF);
        buffer.extend_from_slice(&[GS, b'!', 0x00]);
        buffer.extend_from_slice(&[ESC, b'E', 0]);

        buffer.push(LF);
        buffer.extend_from_slice(&[ESC, b'a', 0]); // Left
        buffer.extend_from_slice(b"================================");
        buffer.push(LF);
        buffer.push(LF);
        buffer.extend_from_slice(b"Firma cajero: _________________");
        buffer.push(LF);
        buffer.push(LF);
        buffer.extend_from_slice(b"Firma supervisor: ______________");
        buffer.push(LF);

        // Feed and cut
        buffer.extend_from_slice(&[LF, LF, LF]);
        buffer.extend_from_slice(&[GS, b'V', 0x00]);

        self.write_to_device(&buffer)
    }
}
