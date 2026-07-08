use rusb::{Context, DeviceHandle, UsbContext};
use std::time::Duration;

/// Represents a detected USB printer
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UsbPrinterInfo {
    pub vendor_id: u16,
    pub product_id: u16,
    pub manufacturer: String,
    pub product: String,
    pub serial: Option<String>,
    /// Human-readable display label
    pub label: String,
    /// Unique key used to identify this printer in config
    pub device_key: String,
}

/// List all USB printers currently connected
pub fn list_usb_printers() -> Vec<UsbPrinterInfo> {
    let mut result = Vec::new();

    let context = match Context::new() {
        Ok(c) => c,
        Err(_) => return result,
    };

    let devices = match context.devices() {
        Ok(d) => d,
        Err(_) => return result,
    };

    for device in devices.iter() {
        let descriptor = match device.device_descriptor() {
            Ok(d) => d,
            Err(_) => continue,
        };

        // Check if device has a printer interface (class 7)
        let is_printer = is_printer_device(&device);
        if !is_printer {
            continue;
        }

        let handle = match device.open() {
            Ok(h) => h,
            Err(_) => {
                // Can't open but still list it with VID:PID
                let vid = descriptor.vendor_id();
                let pid = descriptor.product_id();
                let label = format!("Impresora USB {:04x}:{:04x}", vid, pid);
                let device_key = format!("{:04x}:{:04x}", vid, pid);
                result.push(UsbPrinterInfo {
                    vendor_id: vid,
                    product_id: pid,
                    manufacturer: String::new(),
                    product: String::new(),
                    serial: None,
                    label,
                    device_key,
                });
                continue;
            }
        };

        let timeout = Duration::from_millis(500);
        let lang = handle.read_languages(timeout).ok()
            .and_then(|langs| langs.into_iter().next());

        let manufacturer = lang.and_then(|l| {
            handle.read_manufacturer_string(l, &descriptor, timeout).ok()
        }).unwrap_or_default();

        let product = lang.and_then(|l| {
            handle.read_product_string(l, &descriptor, timeout).ok()
        }).unwrap_or_default();

        let serial = lang.and_then(|l| {
            handle.read_serial_number_string(l, &descriptor, timeout).ok()
        });

        let vid = descriptor.vendor_id();
        let pid = descriptor.product_id();

        let label = match (manufacturer.is_empty(), product.is_empty()) {
            (false, false) => format!("{} {} ({:04x}:{:04x})", manufacturer, product, vid, pid),
            (false, true)  => format!("{} ({:04x}:{:04x})", manufacturer, vid, pid),
            (true, false)  => format!("{} ({:04x}:{:04x})", product, vid, pid),
            _              => format!("Impresora USB {:04x}:{:04x}", vid, pid),
        };

        let device_key = format!("{:04x}:{:04x}", vid, pid);

        result.push(UsbPrinterInfo {
            vendor_id: vid,
            product_id: pid,
            manufacturer,
            product,
            serial,
            label,
            device_key,
        });
    }

    result
}

/// Check if a USB device has a printer interface (class 0x07)
fn is_printer_device(device: &rusb::Device<Context>) -> bool {
    let config = match device.active_config_descriptor() {
        Ok(c) => c,
        Err(_) => return false,
    };
    for interface in config.interfaces() {
        for desc in interface.descriptors() {
            if desc.class_code() == 0x07 {
                return true;
            }
        }
    }
    false
}

/// Write raw bytes to a USB printer identified by VID:PID
/// Handles kernel driver detachment automatically
pub fn write_to_usb_printer(vendor_id: u16, product_id: u16, data: &[u8]) -> Result<(), String> {
    let context = Context::new().map_err(|e| format!("Error iniciando USB: {}", e))?;

    let device = context
        .devices()
        .map_err(|e| format!("Error listando dispositivos USB: {}", e))?
        .iter()
        .find(|d| {
            d.device_descriptor()
                .map(|desc| desc.vendor_id() == vendor_id && desc.product_id() == product_id)
                .unwrap_or(false)
        })
        .ok_or_else(|| format!(
            "Impresora {:04x}:{:04x} no encontrada. Verifica que esté conectada.",
            vendor_id, product_id
        ))?;

    let mut handle = device.open()
        .map_err(|e| format!("No se pudo abrir la impresora: {}", e))?;

    // Find the bulk OUT endpoint
    let (interface_num, out_endpoint) = find_bulk_out_endpoint(&device)
        .ok_or("No se encontró endpoint de salida en la impresora")?;

    // Detach kernel driver if active (usblp)
    if handle.kernel_driver_active(interface_num).unwrap_or(false) {
        handle.detach_kernel_driver(interface_num)
            .map_err(|e| format!("No se pudo desconectar driver del kernel: {}", e))?;
    }

    handle.claim_interface(interface_num)
        .map_err(|e| format!("No se pudo reclamar interfaz USB: {}", e))?;

    // Write in chunks of 64 bytes (max packet size)
    let timeout = Duration::from_secs(5);
    let chunk_size = 64;
    let mut offset = 0;

    while offset < data.len() {
        let end = (offset + chunk_size).min(data.len());
        let chunk = &data[offset..end];
        handle.write_bulk(out_endpoint, chunk, timeout)
            .map_err(|e| format!("Error escribiendo a la impresora: {}", e))?;
        offset = end;
    }

    // Release interface and re-attach kernel driver
    let _ = handle.release_interface(interface_num);
    let _ = handle.attach_kernel_driver(interface_num);

    Ok(())
}

/// Find the bulk OUT endpoint and interface number for a printer device
fn find_bulk_out_endpoint(device: &rusb::Device<Context>) -> Option<(u8, u8)> {
    let config = device.active_config_descriptor().ok()?;
    for interface in config.interfaces() {
        for desc in interface.descriptors() {
            if desc.class_code() != 0x07 {
                continue;
            }
            for endpoint in desc.endpoint_descriptors() {
                use rusb::{Direction, TransferType};
                if endpoint.direction() == Direction::Out
                    && endpoint.transfer_type() == TransferType::Bulk
                {
                    return Some((desc.interface_number(), endpoint.address()));
                }
            }
        }
    }
    None
}
