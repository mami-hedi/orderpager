CREATE TABLE IF NOT EXISTS shops (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  expires_at DATE NULL DEFAULT NULL, -- NULL = abonnement sans limite ; sinon dernier jour d'accès inclus
  owner_name VARCHAR(120) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(160) NULL,
  monthly_price DECIMAL(10,3) NULL,  -- prix mensuel convenu (DT), sert à pré-remplir les paiements
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  shop_id INT UNSIGNED NOT NULL,
  order_number VARCHAR(20) NOT NULL,
  business_date DATE NOT NULL,
  status ENUM('pending','ready','picked') NOT NULL DEFAULT 'pending',
  client_connected TINYINT(1) NOT NULL DEFAULT 0,
  push_subscription JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ready_at TIMESTAMP NULL DEFAULT NULL,
  picked_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_shop_number_day (shop_id, order_number, business_date),
  KEY idx_shop_day_status (shop_id, business_date, status),
  CONSTRAINT fk_orders_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Registre des paiements d'abonnement (saisis à la main par l'administrateur)
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shop_id INT UNSIGNED NOT NULL,
  amount DECIMAL(10,3) NOT NULL,
  method ENUM('cash','virement','d17','flouci','autre') NOT NULL DEFAULT 'cash',
  paid_at DATE NOT NULL,
  months TINYINT UNSIGNED NOT NULL DEFAULT 0, -- mois ajoutés à l'abonnement par ce paiement
  period_start DATE NULL DEFAULT NULL,
  period_end DATE NULL DEFAULT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payments_shop (shop_id, paid_at),
  KEY idx_payments_date (paid_at),
  CONSTRAINT fk_payments_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
