-- Default system products (IDs 1-6 reserved)
-- These are always available for quick access by ID number

-- Bolsas: precio fijo
INSERT OR IGNORE INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (1, 'Bolsa pequeña', 200, 100, 9999, 'pieza', 0, 'fijo', 1);

INSERT OR IGNORE INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (2, 'Bolsa grande', 400, 200, 9999, 'pieza', 0, 'fijo', 1);

-- Productos pesados: precio manual (monto) — se pide al momento de la venta
INSERT OR IGNORE INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (3, 'Frutas y Verduras', 0, 0, 9999, 'kg', 0, 'monto', 1);

INSERT OR IGNORE INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (4, 'Carnes', 0, 0, 9999, 'kg', 0, 'monto', 1);

INSERT OR IGNORE INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (5, 'Pollo', 0, 0, 9999, 'kg', 0, 'monto', 1);

INSERT OR IGNORE INTO products (id, name, sale_price, cost_price, stock, unit, min_stock, price_type, active)
VALUES (6, 'Pescados', 0, 0, 9999, 'kg', 0, 'monto', 1);
