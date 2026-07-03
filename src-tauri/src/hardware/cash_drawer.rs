use super::printer::Printer;

/// Opens the cash drawer connected to the thermal printer
/// Most cash drawers connect via RJ11 to the printer's DK port
pub fn open_drawer(printer_device: &str) -> Result<(), String> {
    let printer = Printer::new(printer_device);
    printer.open_cash_drawer()
}
