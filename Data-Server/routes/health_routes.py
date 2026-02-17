"""Health check endpoint."""

from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health", methods=["GET"])
def health_check():
    """Server health check
    ---
    tags:
      - System
    responses:
      200:
        description: Server is running
        schema:
          type: object
          properties:
            status:
              type: string
              example: ok
            service:
              type: string
              example: stocklearn-data-server
    """
    return jsonify({"status": "ok", "service": "stocklearn-data-server"})
