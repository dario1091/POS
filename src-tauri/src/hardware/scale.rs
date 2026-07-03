use std::io::Read;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::thread;
use std::time::Duration;

/// Scale reader state
pub struct ScaleState {
    pub current_weight: Arc<Mutex<f64>>,
    pub is_running: Arc<AtomicBool>,
    pub port_name: Arc<Mutex<String>>,
    pub baud_rate: Arc<Mutex<u32>>,
}

impl ScaleState {
    pub fn new() -> Self {
        Self {
            current_weight: Arc::new(Mutex::new(0.0)),
            is_running: Arc::new(AtomicBool::new(false)),
            port_name: Arc::new(Mutex::new(String::new())),
            baud_rate: Arc::new(Mutex::new(9600)),
        }
    }

    pub fn get_weight(&self) -> f64 {
        *self.current_weight.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn configure(&self, port: &str, baud: u32) {
        *self.port_name.lock().unwrap() = port.to_string();
        *self.baud_rate.lock().unwrap() = baud;
    }

    /// Start reading from serial port in a background thread
    pub fn start(&self) -> Result<(), String> {
        let port_name = self.port_name.lock().unwrap().clone();
        let baud_rate = *self.baud_rate.lock().unwrap();

        if port_name.is_empty() {
            return Err("Puerto serial no configurado".to_string());
        }

        if self.is_running.load(Ordering::Relaxed) {
            return Ok(()); // Already running
        }

        // Test that port can be opened
        serialport::new(&port_name, baud_rate)
            .timeout(Duration::from_millis(500))
            .open()
            .map_err(|e| format!("No se pudo abrir el puerto {}: {}", port_name, e))?;

        let weight = Arc::clone(&self.current_weight);
        let running = Arc::clone(&self.is_running);
        let port = port_name.clone();
        let baud = baud_rate;

        running.store(true, Ordering::Relaxed);

        thread::spawn(move || {
            loop {
                if !running.load(Ordering::Relaxed) {
                    break;
                }

                match serialport::new(&port, baud)
                    .timeout(Duration::from_millis(1000))
                    .open()
                {
                    Ok(mut serial) => {
                        let mut buf = [0u8; 64];
                        let mut line_buffer = String::new();

                        while running.load(Ordering::Relaxed) {
                            match serial.read(&mut buf) {
                                Ok(n) if n > 0 => {
                                    let chunk = String::from_utf8_lossy(&buf[..n]);
                                    line_buffer.push_str(&chunk);

                                    // Process complete lines
                                    while let Some(pos) = line_buffer.find('\n') {
                                        let line = line_buffer[..pos].trim().to_string();
                                        line_buffer = line_buffer[pos + 1..].to_string();

                                        if let Some(w) = parse_weight(&line) {
                                            if let Ok(mut wt) = weight.lock() {
                                                *wt = w;
                                            }
                                        }
                                    }
                                }
                                Ok(_) => {}
                                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                                    // Normal timeout, continue
                                }
                                Err(_) => {
                                    // Connection lost, wait and retry
                                    thread::sleep(Duration::from_secs(2));
                                    break;
                                }
                            }
                        }
                    }
                    Err(_) => {
                        // Could not open port, retry after delay
                        thread::sleep(Duration::from_secs(3));
                    }
                }
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::Relaxed);
    }
}

/// Parse weight from common scale protocols
/// Most scales send weight as a numeric string, e.g.:
/// "  1.234 kg\r\n" or "ST,GS,  0.500,kg\r\n" or "+  1.234\n"
fn parse_weight(line: &str) -> Option<f64> {
    // Try to extract a floating point number from the line
    let cleaned: String = line
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
        .collect();

    cleaned.parse::<f64>().ok().filter(|w| *w >= 0.0 && *w < 1000.0)
}

/// List available serial ports
pub fn list_serial_ports() -> Vec<String> {
    serialport::available_ports()
        .unwrap_or_default()
        .iter()
        .map(|p| p.port_name.clone())
        .collect()
}
