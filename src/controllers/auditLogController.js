const { pool } = require("../config/db");

async function getAuditLogs(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        event_type AS "eventType",
        entity_type AS "entityType",
        entity_id AS "entityId",
        description,
        created_at AS "createdAt"
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve audit logs",
      error: error.message
    });
  }
}

module.exports = {
  getAuditLogs
};
