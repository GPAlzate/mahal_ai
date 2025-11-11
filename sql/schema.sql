-- Create ENUM types
CREATE TYPE "ReceiptLineType" AS ENUM ('PRCH', 'TAX', 'TIP', 'SRVC', 'DSCT');
CREATE TYPE "ReceiptStatus" AS ENUM ('PINP', 'DRFT', 'FLZD', 'DLTD');

-- Create receipts table
CREATE TABLE receipts (
    id BIGSERIAL PRIMARY KEY,
    share_code TEXT UNIQUE,
    status "ReceiptStatus" NOT NULL DEFAULT 'DRFT',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Create participants table
CREATE TABLE participants (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id)
);

-- Create receipt_lines table
CREATE TABLE receipt_lines (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL,
    line_type "ReceiptLineType" NOT NULL DEFAULT 'PRCH',
    item_name TEXT NOT NULL,
    unit_price NUMERIC NOT NULL,
    quantity NUMERIC NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    FOREIGN KEY (receipt_id) REFERENCES receipts(id)
);

-- Create line_participants table (junction table)
CREATE TABLE line_participants (
    receipt_line_id BIGINT NOT NULL,
    participant_id BIGINT NOT NULL,
    share_quantity NUMERIC NOT NULL DEFAULT 1,
    PRIMARY KEY (receipt_line_id, participant_id),
    FOREIGN KEY (receipt_line_id) REFERENCES receipt_lines(id),
    FOREIGN KEY (participant_id) REFERENCES participants(id)
);

-- Create indexes for better query performance
CREATE INDEX idx_participants_receipt_id ON participants(receipt_id);
CREATE INDEX idx_receipt_lines_receipt_id ON receipt_lines(receipt_id);
CREATE INDEX idx_line_participants_receipt_line_id ON line_participants(receipt_line_id);
CREATE INDEX idx_line_participants_participant_id ON line_participants(participant_id);
CREATE INDEX idx_receipts_share_code ON receipts(share_code);
