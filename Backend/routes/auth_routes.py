from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User, Doctor, Patient, Department

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user.is_active:
        return jsonify({"error": "Account has been deactivated. Contact admin."}), 403

    token = create_access_token(identity=str(user.id))

    profile = None
    if user.role == "doctor" and user.doctor_profile:
        profile = user.doctor_profile.to_dict()
    elif user.role == "patient" and user.patient_profile:
        profile = user.patient_profile.to_dict()

    return jsonify({
        "token": token,
        "user": user.to_dict(),
        "profile": profile,
    }), 200


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["username", "email", "password", "name"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already taken"}), 409

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        username=data["username"].strip(),
        email=data["email"].strip().lower(),
        role="patient",
        is_active=True,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()

    import datetime
    dob = None
    if data.get("date_of_birth"):
        try:
            dob = datetime.date.fromisoformat(data["date_of_birth"])
        except ValueError:
            pass

    patient = Patient(
        user_id=user.id,
        name=data["name"].strip(),
        date_of_birth=dob,
        gender=data.get("gender", ""),
        phone=data.get("phone", ""),
        address=data.get("address", ""),
        blood_group=data.get("blood_group", ""),
        emergency_contact=data.get("emergency_contact", ""),
    )
    db.session.add(patient)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({
        "token": token,
        "user": user.to_dict(),
        "profile": patient.to_dict(),
    }), 201


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    profile = None
    if user.role == "doctor" and user.doctor_profile:
        profile = user.doctor_profile.to_dict()
    elif user.role == "patient" and user.patient_profile:
        profile = user.patient_profile.to_dict()

    return jsonify({"user": user.to_dict(), "profile": profile}), 200


@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json()
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    if not user.check_password(old_password):
        return jsonify({"error": "Current password is incorrect"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": "Password updated successfully"}), 200
