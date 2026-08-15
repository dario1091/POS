use crate::hardware::usb_printer::write_to_usb_printer;

/// TSPL (TSC Printer Language) driver for label printers
/// Compatible with 4BARCODE 4B-2054TG and similar TSC-based printers
pub struct LabelPrinter {
    vendor_id: u16,
    product_id: u16,
}

/// Label line for TSPL printing
#[derive(Debug, serde::Deserialize, Clone)]
pub struct TsplLabelLine {
    pub text: String,
    pub size: String,       // "small", "normal", "large", "extra_large"
    pub alignment: String,  // "left", "center", "right"
    pub bold: bool,
}

/// Calculate the rendered dot height of a line given its size string
fn line_dot_height(size: &str) -> u32 {
    let (base_h, scale): (u32, u32) = match size {
        "small"       => (20, 1),
        "normal"      => (24, 1),
        "large"       => (24, 2),
        "extra_large" => (32, 2),
        _             => (24, 1),
    };
    base_h * scale + 8  // height + inter-line padding
}

impl LabelPrinter {
    /// Create from a device_key string like "2d84:4cfb"
    pub fn new(device_key: &str) -> Self {
        let parts: Vec<&str> = device_key.split(':').collect();
        let vendor_id = u16::from_str_radix(parts.get(0).unwrap_or(&"0"), 16).unwrap_or(0);
        let product_id = u16::from_str_radix(parts.get(1).unwrap_or(&"0"), 16).unwrap_or(0);
        Self { vendor_id, product_id }
    }

    /// Write raw bytes directly via libusb
    fn write_to_device(&self, data: &[u8]) -> Result<(), String> {
        write_to_usb_printer(self.vendor_id, self.product_id, data)
    }

    /// Print label using TSPL protocol
    pub fn print_label(&self, lines: &[TsplLabelLine], copies: u32, barcode: Option<&str>, label_width_mm: u32, label_height_mm: u32, barcode_width: u32, sensor_type: &str) -> Result<(), String> {
        let label_width_dots: u32 = label_width_mm * 8;
        let margin_x: u32 = 5;

        let mut cmd = String::new();
        cmd.push_str(&format!("SIZE {} mm, {} mm\r\n", label_width_mm, label_height_mm));
        if sensor_type == "gap" {
            cmd.push_str("GAP 2 mm, 0 mm\r\n");
        } else {
            cmd.push_str("BLINE 2 mm, 0 mm\r\n");
        }
        cmd.push_str("DIRECTION 1\r\n");
        cmd.push_str("CLS\r\n");

        let non_empty: Vec<&TsplLabelLine> = lines.iter()
            .filter(|l| !l.text.trim().is_empty())
            .collect();

        let has_barcode = barcode.map(|b| !b.trim().is_empty()).unwrap_or(false);
        let text_start_y: u32 = 21; // ~2mm top margin (16 dots) + 5 base

        // Print text lines — Y position accumulates actual line heights
        let mut current_y = text_start_y;
        for line in non_empty.iter() {
            let y_pos = current_y;

            // Font and initial scale
            let (font, mut x_scale, mut y_scale): (&str, u32, u32) = match line.size.as_str() {
                "small"       => ("2", 1, 1),
                "normal"      => ("3", 1, 1),
                "large"       => ("3", 2, 2),
                "extra_large" => ("4", 2, 2),
                _             => ("3", 1, 1),
            };

            // Base font width per char (unscaled)
            let base_char_w: u32 = match font { "2" => 12, "3" => 16, "4" => 24, _ => 16 };
            let usable_w = label_width_dots.saturating_sub(margin_x * 2);

            // Auto-reduce scale if text overflows width
            while x_scale > 1 && line.text.len() as u32 * base_char_w * x_scale > usable_w {
                x_scale -= 1;
                y_scale = y_scale.saturating_sub(1).max(1);
            }

            let text_w = line.text.len() as u32 * base_char_w * x_scale;
            let x_pos: u32 = match line.alignment.as_str() {
                "center" => if text_w < usable_w { (label_width_dots - text_w) / 2 } else { margin_x },
                "right"  => if text_w + margin_x < label_width_dots { label_width_dots - text_w - margin_x } else { margin_x },
                _        => margin_x,
            };

            let escaped = line.text.replace('"', "\\\"");
            cmd.push_str(&format!(
                "TEXT {},{},\"{}\",0,{},{},\"{}\"\r\n",
                x_pos, y_pos, font, x_scale, y_scale, escaped
            ));

            // Advance Y by actual rendered height of this line
            // When scale was reduced, use the actual scale for height too
            let (base_h, _): (u32, u32) = match line.size.as_str() {
                "small"       => (20, 1),
                "normal"      => (24, 1),
                "large"       => (24, 2),
                "extra_large" => (32, 2),
                _             => (24, 1),
            };
            current_y += base_h * y_scale + 8;
        }

        // Barcode placed just below all text lines
        if has_barcode {
            if let Some(bc) = barcode {
                let bc = bc.trim();
                let bc_y = current_y + 5;
                let bc_height: u32 = 60;

                // Center barcode horizontally
                let bc_width_est = bc.len() as u32 * 4 + 60;
                let bc_x = if bc_width_est < label_width_dots {
                    (label_width_dots - bc_width_est) / 2
                } else {
                    margin_x
                };

                cmd.push_str(&format!(
                    "BARCODE {},{},\"128\",{},1,0,{},{},\"{}\"\r\n",
                    bc_x, bc_y, bc_height, barcode_width, barcode_width, bc
                ));
            }
        }

        cmd.push_str(&format!("PRINT {}, 1\r\n", copies));
        self.write_to_device(cmd.as_bytes())
    }

    /// Print a test label
    pub fn print_test(&self) -> Result<(), String> {
        let test_lines = vec![
            TsplLabelLine {
                text: "PRUEBA".to_string(),
                size: "large".to_string(),
                alignment: "center".to_string(),
                bold: true,
            },
            TsplLabelLine {
                text: "Impresora OK".to_string(),
                size: "normal".to_string(),
                alignment: "center".to_string(),
                bold: false,
            },
        ];
        self.print_label(&test_lines, 1, Some("1234567890"), 55, 33, 3, "bline")
    }
}
