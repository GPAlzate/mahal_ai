/**
 * SCHEMA MIGRATION TRACKER
 *
 * This file is being deprecated. All schemas are being moved to lib/schemas/
 * organized by domain and purpose. Once all schemas are migrated, DELETE THIS FILE.
 *
 * DO NOT import from this file - it should not be used anywhere in the codebase.
 */

// ========================================
// ✅ COMPLETED - Schemas moved to lib/schemas/
// ========================================

// Receipt Domain - Public (Database Entities):
// ✅ Receipt → lib/schemas/receipt/public/Receipt.ts
// ✅ ReceiptLine → lib/schemas/receipt/public/ReceiptLine.ts
// ✅ ReceiptLineType → lib/schemas/receipt/public/ReceiptLineType.ts
// ✅ ParsedReceipt (OpenAI output) → lib/schemas/receipt/public/ParsedReceipt.ts

// Receipt Domain - Request Schemas:
// ✅ CreateReceiptRequest → lib/schemas/receipt/request/CreateReceiptRequest.ts
// ✅ CreateReceiptLineRequest → lib/schemas/receipt/request/CreateReceiptLineRequest.ts
// ✅ UpdateReceiptLineRequest → lib/schemas/receipt/request/UpdateReceiptLineRequest.ts
// ✅ ParseReceiptRequest → lib/schemas/receipt/request/ParseReceiptRequest.ts

// ========================================
// ⏳ TODO - Schemas to be migrated
// ========================================

// Participant Domain - Public (Database Entities):
// ⏳ Participant → needs lib/schemas/participant/public/Participant.ts
// ⏳ LineParticipant → needs lib/schemas/participant/public/LineParticipant.ts

// Participant Domain - Request Schemas:
// ⏳ CreateParticipantRequest → needs lib/schemas/participant/request/CreateParticipantRequest.ts
// ⏳ AssignLineParticipantRequest → needs lib/schemas/participant/request/AssignLineParticipantRequest.ts

// Receipt Summary - Response Schemas:
// ⏳ ParticipantSummary → needs lib/schemas/receipt/response/ParticipantSummary.ts
// ⏳ ReceiptSummary → needs lib/schemas/receipt/response/ReceiptSummary.ts

// ========================================
// 📝 Notes
// ========================================
// - Old schema used snake_case (receipt_id, display_name)
// - New schemas use camelCase (receiptId, displayName) for consistency
// - When migrating, ensure field names match database schema transformation
// - Delete this file once all TODOs are completed
