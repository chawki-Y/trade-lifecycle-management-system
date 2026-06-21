const { pool } = require("../config/db");

async function createAuditLog(eventType, entityType, entityId, description) {
  try {
    await pool.query(
      `
        INSERT INTO audit_logs (
          event_type,
          entity_type,
          entity_id,
          description
        )
        VALUES ($1, $2, $3, $4)
      `,
      [eventType, entityType, entityId || null, description]
    );
  } catch (error) {
    console.warn(`Audit log skipped: ${error.message}`);
  }
}

module.exports = {
  createAuditLog
};
