import os
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_caching import Cache
from flask_mail import Mail

from config import config
from models import db, User, Department, Doctor, DoctorAvailability, Patient

cache = Cache()
mail = Mail()
jwt = JWTManager()


def create_app(config_name="default"):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Ensure export directory exists
    os.makedirs(app.config.get("EXPORT_DIR", "exports"), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(__file__), "instance"), exist_ok=True)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    CORS(app, supports_credentials=True)

    # Cache init — fallback to SimpleCache if Redis unavailable
    try:
        cache.init_app(app)
    except Exception:
        app.config["CACHE_TYPE"] = "SimpleCache"
        cache.init_app(app)

    # Register blueprints
    from routes.auth_routes import auth_bp
    from routes.admin_routes import admin_bp
    from routes.doctor_routes import doctor_bp
    from routes.patient_routes import patient_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(doctor_bp, url_prefix="/api/doctor")
    app.register_blueprint(patient_bp, url_prefix="/api/patient")

    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "Token has expired", "code": "token_expired"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"error": "Invalid token", "code": "invalid_token"}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({"error": "Authorization token missing", "code": "authorization_required"}), 401

    with app.app_context():
        db.create_all()
        _seed_initial_data(app)

    return app


def _seed_initial_data(app):
    """Create admin user and default departments if they don't exist."""
    # Admin
    admin = User.query.filter_by(role="admin").first()
    if not admin:
        admin = User(
            username=app.config["ADMIN_USERNAME"],
            email=app.config["ADMIN_EMAIL"],
            role="admin",
            is_active=True,
        )
        admin.set_password(app.config["ADMIN_PASSWORD"])
        db.session.add(admin)
        db.session.commit()
        print(f"[SEED] Admin created: {admin.username} / {app.config['ADMIN_PASSWORD']}")

    # Default departments
    default_departments = [
        {"name": "Cardiology", "description": "Heart and cardiovascular diseases"},
        {"name": "Neurology", "description": "Nervous system disorders"},
        {"name": "Orthopedics", "description": "Bones, joints and muscles"},
        {"name": "Pediatrics", "description": "Children's health"},
        {"name": "Dermatology", "description": "Skin conditions"},
        {"name": "General Medicine", "description": "General healthcare"},
        {"name": "Ophthalmology", "description": "Eye diseases"},
        {"name": "ENT", "description": "Ear, Nose and Throat"},
        {"name": "Gynecology", "description": "Women's reproductive health"},
        {"name": "Psychiatry", "description": "Mental health disorders"},
    ]
    for dept_data in default_departments:
        if not Department.query.filter_by(name=dept_data["name"]).first():
            dept = Department(**dept_data)
            db.session.add(dept)
    db.session.commit()
    print("[SEED] Default departments created.")


if __name__ == "__main__":
    app = create_app("development")
    app.run(debug=True, host="0.0.0.0", port=5001)
