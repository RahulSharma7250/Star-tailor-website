from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient, ReturnDocument
from bson import ObjectId
from datetime import datetime, timedelta
import jwt
import bcrypt
from functools import wraps
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'rahul@123')

# Read frontend URL for CORS from env (default to localhost)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Comprehensive CORS setup
CORS(app, origins=[FRONTEND_URL], 
     supports_credentials=True,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'])

# Handle preflight requests globally
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify()
        response.headers.add('Access-Control-Allow-Origin', FRONTEND_URL)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
        return response, 200

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://algoflicks664:LSVMdAh5klVEB85s@star-tailor-management.yb3aynz.mongodb.net/?retryWrites=true&w=majority&appName=Star-Tailor-Management')
client = MongoClient(MONGO_URI)
db = client.star_tailors

# Collections
users_collection = db.users
customers_collection = db.customers
bills_collection = db.bills
tailors_collection = db.tailors
settings_collection = db.settings
jobs_collection = db.jobs
counters_collection = db.counters

# JWT token decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = users_collection.find_one({'_id': ObjectId(data['user_id'])})
            
            if not current_user:
                return jsonify({'message': 'Token is invalid'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# Initialize default admin user

# Utility: Atomic sequence generator for bill numbers
# Uses a counters collection to maintain sequential numbers
# Stores both integer (bill_no) and zero-padded string (bill_no_str)

def get_next_sequence(name: str) -> int:
    try:
        doc = counters_collection.find_one_and_update(
            {'_id': name},
            {'$inc': {'seq': 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        return int(doc.get('seq', 1))
    except Exception:
        # Fallback in case counters collection isn't available for some reason
        # This will compute next number based on existing bills count
        # Note: This is not perfectly safe for concurrent requests, but avoids crashes
        return bills_collection.count_documents({}) + 1

def format_bill_no(n: int, width: int = 3) -> str:
    try:
        return str(int(n)).zfill(width)
    except Exception:
        return str(n)
def init_default_user():
    # Ensure default users exist: admin, tailor, billing
    defaults = [
        ('admin', 'admin123', 'admin'),
        ('tailor', 'tailor123', 'tailor'),
        ('billing', 'billing123', 'billing'),
    ]
    for username, pwd, role in defaults:
        exists = users_collection.find_one({'username': username})
        if not exists:
            hashed_password = bcrypt.hashpw(pwd.encode('utf-8'), bcrypt.gensalt())
            user_doc = {
                'username': username,
                'password': hashed_password,
                'role': role,
                'created_at': datetime.now()
            }
            users_collection.insert_one(user_doc)
            print(f"Default user created: username={username}, password={pwd}, role={role}")
        else:
            print(f"User already exists: {username}")

# Authentication Routes
@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'message': 'Username and password are required'}), 400
        
        user = users_collection.find_one({'username': username})
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
            token = jwt.encode({
                'user_id': str(user['_id']),
                'username': user['username'],
                'role': user['role'],
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
            
            return jsonify({
                'message': 'Login successful',
                'token': token,
                'user': {
                    'id': str(user['_id']),
                    'username': user['username'],
                    'role': user['role']
                }
            }), 200
        else:
            return jsonify({'message': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'message': 'Login failed', 'error': str(e)}), 500

@app.route('/api/auth/verify', methods=['GET', 'OPTIONS'])
@token_required
def verify_token(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    return jsonify({
        'user': {
            'id': str(current_user['_id']),
            'username': current_user['username'],
            'role': current_user['role']
        }
    }), 200

# Customer Management Routes
@app.route('/api/customers', methods=['GET', 'OPTIONS'])
@token_required
def get_customers(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        skip = (page - 1) * limit
        
        query = {}
        if search:
            query = {
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'phone': {'$regex': search, '$options': 'i'}},
                    {'email': {'$regex': search, '$options': 'i'}}
                ]
            }
        
        customers = list(customers_collection.find(query).skip(skip).limit(limit).sort('_id', -1))
        total_customers = customers_collection.count_documents(query)
        
        for customer in customers:
            customer['_id'] = str(customer['_id'])
            if 'created_at' in customer and customer['created_at']:
                customer['created_at'] = customer['created_at'].isoformat()
            else:
                customer['created_at'] = datetime.now().isoformat()
            
            if 'updated_at' in customer and customer['updated_at']:
                customer['updated_at'] = customer['updated_at'].isoformat()
            else:
                customer['updated_at'] = datetime.now().isoformat()
        
        return jsonify({
            'customers': customers,
            'pagination': {
                'current_page': page,
                'total_pages': (total_customers + limit - 1) // limit,
                'total_customers': total_customers,
                'has_next': skip + limit < total_customers,
                'has_prev': page > 1
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_customers: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Failed to get customers', 'error': str(e)}), 500

@app.route('/api/customers', methods=['POST', 'OPTIONS'])
@token_required
def create_customer(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        email = data.get('email')
        address = data.get('address')
        notes = data.get('notes')
        
        if not name or not phone:
            return jsonify({'message': 'Name and phone are required'}), 400
        
        existing_customer = customers_collection.find_one({'phone': phone})
        if existing_customer:
            return jsonify({'message': 'Customer with this phone number already exists'}), 409
        
        new_customer = {
            'name': name,
            'phone': phone,
            'email': email,
            'address': address,
            'notes': notes,
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        result = customers_collection.insert_one(new_customer)
        new_customer['_id'] = str(result.inserted_id)
        new_customer['created_at'] = new_customer['created_at'].isoformat()
        new_customer['updated_at'] = new_customer['updated_at'].isoformat()
        
        return jsonify({
            'message': 'Customer created successfully',
            'customer': new_customer
        }), 201
        
    except Exception as e:
        return jsonify({'message': 'Failed to create customer', 'error': str(e)}), 500

@app.route('/api/customers/<customer_id>', methods=['GET', 'OPTIONS'])
@token_required
def get_customer_by_id(current_user, customer_id):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        customer = customers_collection.find_one({'_id': ObjectId(customer_id)})
        if not customer:
            return jsonify({'message': 'Customer not found'}), 404
        
        customer['_id'] = str(customer['_id'])
        if 'created_at' in customer and customer['created_at']:
            customer['created_at'] = customer['created_at'].isoformat()
        if 'updated_at' in customer and customer['updated_at']:
            customer['updated_at'] = customer['updated_at'].isoformat()
        
        # Get customer's bills
        bills = list(bills_collection.find({'customer_id': ObjectId(customer_id)}))
        for bill in bills:
            bill['_id'] = str(bill['_id'])
            bill['customer_id'] = str(bill['customer_id'])
            if 'created_at' in bill and bill['created_at']:
                bill['created_at'] = bill['created_at'].isoformat()
            if 'updated_at' in bill and bill['updated_at']:
                bill['updated_at'] = bill['updated_at'].isoformat()
        
        customer['bills'] = bills
        customer['total_orders'] = len(bills)
        customer['total_spent'] = sum(bill.get('total', 0) for bill in bills)
        customer['outstanding_balance'] = sum(bill.get('balance', 0) for bill in bills if bill.get('status') == 'pending')
        
        return jsonify({'customer': customer}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get customer', 'error': str(e)}), 500

@app.route('/api/customers/<customer_id>', methods=['PUT', 'OPTIONS'])
@token_required
def update_customer(current_user, customer_id):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        data = request.get_json()
        
        customer = customers_collection.find_one({'_id': ObjectId(customer_id)})
        if not customer:
            return jsonify({'message': 'Customer not found'}), 404
        
        update_data = {
            'name': data.get('name', customer.get('name')),
            'phone': data.get('phone', customer.get('phone')),
            'email': data.get('email', customer.get('email')),
            'address': data.get('address', customer.get('address')),
            'notes': data.get('notes', customer.get('notes')),
            'updated_at': datetime.now()
        }
        
        result = customers_collection.update_one(
            {'_id': ObjectId(customer_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            return jsonify({'message': 'No changes made'}), 200
        
        updated_customer = customers_collection.find_one({'_id': ObjectId(customer_id)})
        updated_customer['_id'] = str(updated_customer['_id'])
        updated_customer['created_at'] = updated_customer['created_at'].isoformat()
        updated_customer['updated_at'] = updated_customer['updated_at'].isoformat()
        
        return jsonify({
            'message': 'Customer updated successfully',
            'customer': updated_customer
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to update customer', 'error': str(e)}), 500

@app.route('/api/customers/<customer_id>', methods=['DELETE', 'OPTIONS'])
@token_required
def delete_customer(current_user, customer_id):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        result = customers_collection.delete_one({'_id': ObjectId(customer_id)})
        
        if result.deleted_count == 0:
            return jsonify({'message': 'Customer not found'}), 404
        
        # Also delete associated bills
        bills_collection.delete_many({'customer_id': ObjectId(customer_id)})
        
        return jsonify({'message': 'Customer deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to delete customer', 'error': str(e)}), 500

@app.route('/api/customers/stats', methods=['GET', 'OPTIONS'])
@token_required
def get_customer_stats(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        total_customers = customers_collection.count_documents({})
        
        # Count customers with outstanding balances
        pipeline = [
            {
                '$lookup': {
                    'from': 'bills',
                    'localField': '_id',
                    'foreignField': 'customer_id',
                    'as': 'bills'
                }
            },
            {
                '$match': {
                    'bills.balance': {'$gt': 0},
                    'bills.status': 'pending'
                }
            },
            {
                '$count': 'count'
            }
        ]
        
        outstanding_result = list(customers_collection.aggregate(pipeline))
        customers_with_outstanding = outstanding_result[0]['count'] if outstanding_result else 0
        
        # Calculate total outstanding amount
        pipeline = [
            {
                '$match': {
                    'status': 'pending',
                    'balance': {'$gt': 0}
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total_outstanding': {'$sum': '$balance'}
                }
            }
        ]
        
        outstanding_amount_result = list(bills_collection.aggregate(pipeline))
        total_outstanding_amount = outstanding_amount_result[0]['total_outstanding'] if outstanding_amount_result else 0
        
        return jsonify({
            'total_customers': total_customers,
            'customers_with_outstanding': customers_with_outstanding,
            'total_outstanding_amount': total_outstanding_amount
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get customer stats', 'error': str(e)}), 500

# Billing System Routes
@app.route('/api/bills', methods=['GET', 'OPTIONS'])
@token_required
def get_bills(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        customer_id = request.args.get('customer_id', '')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        skip = (page - 1) * limit
        
        query = {}
        
        if search:
            try:
                customers = customers_collection.find({
                    '$or': [
                        {'name': {'$regex': search, '$options': 'i'}},
                        {'phone': {'$regex': search, '$options': 'i'}}
                    ]
                })
                customer_ids = [customer['_id'] for customer in customers]
                if customer_ids:
                    query['customer_id'] = {'$in': customer_ids}
            except Exception as e:
                print(f"Error building search query: {str(e)}")
        
        if status:
            query['status'] = status
        
        if customer_id:
            try:
                query['customer_id'] = ObjectId(customer_id)
            except:
                return jsonify({'message': 'Invalid customer ID format'}), 400
        
        bills = []
        try:
            bills = list(bills_collection.find(query)
                          .skip(skip)
                          .limit(limit)
                          .sort('created_at', -1))
            total_bills = bills_collection.count_documents(query)
        except Exception as e:
            print(f"Error querying bills: {str(e)}")
            return jsonify({'message': 'Database error', 'error': str(e)}), 500
        
        formatted_bills = []
        for bill in bills:
            try:
                bill['_id'] = str(bill['_id'])
                bill['customer_id'] = str(bill['customer_id'])
                bill['created_at'] = bill['created_at'].isoformat()
                bill['updated_at'] = bill['updated_at'].isoformat()
                
                customer = customers_collection.find_one({'_id': ObjectId(bill['customer_id'])})
                if customer:
                    bill['customer'] = {
                        'name': customer['name'],
                        'phone': customer['phone']
                    }
                
                formatted_bills.append(bill)
            except Exception as e:
                print(f"Error formatting bill {bill.get('_id')}: {str(e)}")
                continue
        
        return jsonify({
            'bills': formatted_bills,
            'pagination': {
                'current_page': page,
                'total_pages': (total_bills + limit - 1) // limit,
                'total_bills': total_bills,
                'has_next': skip + limit < total_bills,
                'has_prev': page > 1
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_bills: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'message': 'Failed to get bills', 
            'error': str(e),
            'details': 'Check server logs for more information'
        }), 500
    
@app.route('/api/bills', methods=['POST', 'OPTIONS'])
@token_required
def create_bill(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        data = request.get_json()
        
        required_fields = ['customer_id', 'customer_name', 'items']
        for field in required_fields:
            if field not in data:
                return jsonify({'message': f'Missing required field: {field}'}), 400

        try:
            customer_id = ObjectId(data['customer_id'])
        except:
            return jsonify({'message': 'Invalid customer ID format'}), 400
            
        customer = customers_collection.find_one({'_id': customer_id})
        if not customer:
            return jsonify({'message': 'Customer not found'}), 404

        if not isinstance(data['items'], list) or len(data['items']) == 0:
            return jsonify({'message': 'Items must be a non-empty array'}), 400

        # Generate sequential bill number
        next_no = get_next_sequence('bill_no')

        new_bill = {
            'customer_id': customer_id,
            'customer_name': data.get('customer_name', customer['name']),
            'customer_phone': data.get('customer_phone', customer.get('phone', '')),
            'customer_address': data.get('customer_address', customer.get('address', '')),
            'items': data['items'],
            'subtotal': float(data.get('subtotal', 0)),
            'discount': float(data.get('discount', 0)),
            'total': float(data.get('total', 0)),
            'advance': float(data.get('advance', 0)),
            'balance': float(data.get('balance', 0)),
            'due_date': data.get('due_date', ''),
            'special_instructions': data.get('special_instructions', ''),
            'design_images': data.get('design_images', []),
            'drawings': data.get('drawings', []),
            'signature': data.get('signature', ''),
            'status': data.get('status', 'pending'),
            'created_by': str(current_user['_id']),
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            # New fields for sequential bill number
            'bill_no': int(next_no),
            'bill_no_str': format_bill_no(next_no, 3),
        }

        result = bills_collection.insert_one(new_bill)
        new_bill['_id'] = str(result.inserted_id)
        new_bill['customer_id'] = str(new_bill['customer_id'])
        new_bill['created_at'] = new_bill['created_at'].isoformat()
        new_bill['updated_at'] = new_bill['updated_at'].isoformat()

        return jsonify({
            'message': 'Bill created successfully',
            'bill': new_bill
        }), 201
        
    except Exception as e:
        print(f"Error creating bill: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'message': 'Failed to create bill',
            'error': str(e),
            'received_data': data
        }), 500

# Settings Routes
@app.route('/api/settings/upi', methods=['GET', 'OPTIONS'])
@token_required
def get_upi_settings(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        settings = settings_collection.find_one({'type': 'upi_settings'})
        if not settings:
            return jsonify({
                'upi_id': 'startailors@paytm',
                'business_name': 'Star Tailors'
            }), 200
        
        return jsonify({
            'upi_id': settings.get('upi_id', 'startailors@paytm'),
            'business_name': settings.get('business_name', 'Star Tailors')
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get UPI settings', 'error': str(e)}), 500

@app.route('/api/settings/upi', methods=['PUT', 'OPTIONS'])
@token_required
def update_upi_settings(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        if current_user['role'] != 'admin':
            return jsonify({'message': 'Access denied'}), 403
        
        data = request.get_json()
        upi_id = data.get('upi_id')
        business_name = data.get('business_name')
        
        if not upi_id or not business_name:
            return jsonify({'message': 'UPI ID and business name are required'}), 400
        
        settings_collection.update_one(
            {'type': 'upi_settings'},
            {
                '$set': {
                    'upi_id': upi_id,
                    'business_name': business_name,
                    'updated_at': datetime.now()
                }
            },
            upsert=True
        )
        
        return jsonify({'message': 'UPI settings updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to update UPI settings', 'error': str(e)}), 500

# Business information settings
@app.route('/api/settings/business', methods=['GET', 'OPTIONS'])
@token_required
def get_business_settings(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
    try:
        settings = settings_collection.find_one({'type': 'business_info'})
        if not settings:
            # Defaults
            return jsonify({
                'business_name': 'STAR TAILORS',
                'address': 'Baramati, Maharashtra',
                'phone': '+91 00000 00000',
                'email': 'info@startailors.com'
            }), 200
        return jsonify({
            'business_name': settings.get('business_name', 'STAR TAILORS'),
            'address': settings.get('address', ''),
            'phone': settings.get('phone', ''),
            'email': settings.get('email', '')
        }), 200
    except Exception as e:
        return jsonify({'message': 'Failed to get business settings', 'error': str(e)}), 500

@app.route('/api/settings/business', methods=['PUT', 'OPTIONS'])
@token_required
def update_business_settings(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
    try:
        if current_user['role'] != 'admin':
            return jsonify({'message': 'Access denied'}), 403
        data = request.get_json()
        update_doc = {
            'business_name': data.get('business_name', 'STAR TAILORS'),
            'address': data.get('address', ''),
            'phone': data.get('phone', ''),
            'email': data.get('email', ''),
            'updated_at': datetime.now()
        }
        settings_collection.update_one(
            {'type': 'business_info'},
            {'$set': update_doc},
            upsert=True
        )
        return jsonify({'message': 'Business settings updated successfully'}), 200
    except Exception as e:
        return jsonify({'message': 'Failed to update business settings', 'error': str(e)}), 500

# Tailor Management Routes
@app.route('/api/tailors', methods=['GET', 'OPTIONS'])
@token_required
def get_tailors(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        skip = (page - 1) * limit
        
        query = {}
        if search:
            query = {
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'phone': {'$regex': search, '$options': 'i'}},
                    {'specialization': {'$regex': search, '$options': 'i'}}
                ]
            }
        
        tailors = list(tailors_collection.find(query).skip(skip).limit(limit).sort('created_at', -1))
        total_tailors = tailors_collection.count_documents(query)
        
        for tailor in tailors:
            tailor['_id'] = str(tailor['_id'])
            tailor['created_at'] = tailor['created_at'].isoformat()
            tailor['updated_at'] = tailor['updated_at'].isoformat()
        
        return jsonify({
            'tailors': tailors,
            'pagination': {
                'current_page': page,
                'total_pages': (total_tailors + limit - 1) // limit,
                'total_tailors': total_tailors,
                'has_next': skip + limit < total_tailors,
                'has_prev': page > 1
            }
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get tailors', 'error': str(e)}), 500

@app.route('/api/tailors', methods=['POST', 'OPTIONS'])
@token_required
def create_tailor(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        email = data.get('email')
        specialization = data.get('specialization')
        experience = data.get('experience')
        
        if not name or not phone:
            return jsonify({'message': 'Name and phone are required'}), 400
        
        existing_tailor = tailors_collection.find_one({'phone': phone})
        if existing_tailor:
            return jsonify({'message': 'Tailor with this phone number already exists'}), 409
        
        new_tailor = {
            'name': name,
            'phone': phone,
            'email': email,
            'specialization': specialization,
            'experience': experience,
            'status': 'active',
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        result = tailors_collection.insert_one(new_tailor)
        new_tailor['_id'] = str(result.inserted_id)
        new_tailor['created_at'] = new_tailor['created_at'].isoformat()
        new_tailor['updated_at'] = new_tailor['updated_at'].isoformat()
        
        return jsonify({
            'message': 'Tailor created successfully',
            'tailor': new_tailor
        }), 201
        
    except Exception as e:
        return jsonify({'message': 'Failed to create tailor', 'error': str(e)}), 500

@app.route('/api/tailors/<tailor_id>/jobs', methods=['GET', 'OPTIONS'])
@token_required
def get_tailor_jobs(current_user, tailor_id):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        tailor = tailors_collection.find_one({'_id': ObjectId(tailor_id)})
        
        if not tailor:
            tailor = tailors_collection.find_one({'user_id': tailor_id})
        
        if not tailor and str(current_user['_id']) == tailor_id:
            new_tailor = {
                'name': current_user.get('username', 'Unknown Tailor'),
                'phone': current_user.get('phone', ''),
                'email': current_user.get('email', ''),
                'specialization': 'General Tailoring',
                'experience': '0 years',
                'status': 'active',
                'user_id': str(current_user['_id']),
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            }
            
            result = tailors_collection.insert_one(new_tailor)
            tailor = tailors_collection.find_one({'_id': result.inserted_id})
        
        if not tailor:
            return jsonify({'message': 'Tailor not found'}), 404
        
        status = request.args.get('status', '')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        skip = (page - 1) * limit
        
        query = {'tailor_id': tailor['_id']}
        if status:
            query['status'] = status
        
        jobs = list(jobs_collection.find(query).skip(skip).limit(limit).sort('created_at', -1))
        total_jobs = jobs_collection.count_documents(query)
        
        for job in jobs:
            job['_id'] = str(job['_id'])
            job['tailor_id'] = str(job['tailor_id'])
            job['bill_id'] = str(job['bill_id']) if job.get('bill_id') else None
            job['created_at'] = job['created_at'].isoformat()
            job['updated_at'] = job['updated_at'].isoformat()
            if job.get('due_date'):
                job['due_date'] = job['due_date'].isoformat()
        
        return jsonify({
            'jobs': jobs,
            'tailor': {
                'id': str(tailor['_id']),
                'name': tailor['name'],
                'phone': tailor['phone'],
                'specialization': tailor.get('specialization', '')
            },
            'pagination': {
                'current_page': page,
                'total_pages': (total_jobs + limit - 1) // limit,
                'total_jobs': total_jobs,
                'has_next': skip + limit < total_jobs,
                'has_prev': page > 1
            }
        }), 200
        
    except Exception as e:
        print(f"Error in get_tailor_jobs: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Failed to get tailor jobs', 'error': str(e)}), 500

# Job Management Routes
@app.route('/api/jobs', methods=['GET', 'OPTIONS'])
@token_required
def get_jobs(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        tailor_id = request.args.get('tailor_id', '')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        skip = (page - 1) * limit
        
        query = {}
        if search:
            query['$or'] = [
                {'title': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}}
            ]
        
        if status:
            query['status'] = status
            
        if tailor_id:
            query['tailor_id'] = ObjectId(tailor_id)
        
        jobs = list(jobs_collection.find(query).skip(skip).limit(limit).sort('created_at', -1))
        total_jobs = jobs_collection.count_documents(query)
        
        for job in jobs:
            job['_id'] = str(job['_id'])
            job['tailor_id'] = str(job['tailor_id'])
            job['bill_id'] = str(job['bill_id']) if job.get('bill_id') else None
            job['created_at'] = job['created_at'].isoformat()
            job['updated_at'] = job['updated_at'].isoformat()
            
            tailor = tailors_collection.find_one({'_id': ObjectId(job['tailor_id'])})
            if tailor:
                job['tailor'] = {
                    'name': tailor['name'],
                    'phone': tailor['phone']
                }
        
        return jsonify({
            'jobs': jobs,
            'pagination': {
                'current_page': page,
                'total_pages': (total_jobs + limit - 1) // limit,
                'total_jobs': total_jobs,
                'has_next': skip + limit < total_jobs,
                'has_prev': page > 1
            }
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get jobs', 'error': str(e)}), 500

@app.route('/api/jobs', methods=['POST', 'OPTIONS'])
@token_required
def create_job(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        data = request.get_json()
        title = data.get('title')
        description = data.get('description')
        tailor_id = data.get('tailor_id')
        bill_id = data.get('bill_id')
        priority = data.get('priority', 'medium')
        due_date = data.get('due_date')
        
        if not title or not tailor_id:
            return jsonify({'message': 'Title and tailor ID are required'}), 400
        
        tailor = tailors_collection.find_one({'_id': ObjectId(tailor_id)})
        if not tailor:
            return jsonify({'message': 'Tailor not found'}), 404
        
        new_job = {
            'title': title,
            'description': description,
            'tailor_id': ObjectId(tailor_id),
            'bill_id': ObjectId(bill_id) if bill_id else None,
            'status': 'assigned',
            'priority': priority,
            'due_date': datetime.fromisoformat(due_date) if due_date else None,
            'created_by': str(current_user['_id']),
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        result = jobs_collection.insert_one(new_job)
        new_job['_id'] = str(result.inserted_id)
        new_job['tailor_id'] = str(new_job['tailor_id'])
        new_job['bill_id'] = str(new_job['bill_id']) if new_job['bill_id'] else None
        new_job['created_at'] = new_job['created_at'].isoformat()
        new_job['updated_at'] = new_job['updated_at'].isoformat()
        
        return jsonify({
            'message': 'Job created successfully',
            'job': new_job
        }), 201
        
    except Exception as e:
        return jsonify({'message': 'Failed to create job', 'error': str(e)}), 500

@app.route('/api/jobs/<job_id>/status', methods=['PUT', 'OPTIONS'])
@token_required
def update_job_status(current_user, job_id):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        data = request.get_json()
        status = data.get('status')
        
        if not status:
            return jsonify({'message': 'Status is required'}), 400
        
        valid_statuses = ['assigned', 'in_progress', 'completed', 'delivered', 'cancelled']
        if status not in valid_statuses:
            return jsonify({'message': 'Invalid status'}), 400
        
        result = jobs_collection.update_one(
            {'_id': ObjectId(job_id)},
            {
                '$set': {
                    'status': status,
                    'updated_at': datetime.now()
                }
            }
        )
        
        if result.matched_count == 0:
            return jsonify({'message': 'Job not found'}), 404
        
        return jsonify({'message': 'Job status updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to update job status', 'error': str(e)}), 500

# Dashboard Statistics Route
@app.route('/api/dashboard/stats', methods=['GET', 'OPTIONS'])
@token_required
def get_dashboard_stats(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        total_customers = customers_collection.count_documents({})
        total_bills = bills_collection.count_documents({})
        total_tailors = tailors_collection.count_documents({})
        total_jobs = jobs_collection.count_documents({})
        
        pending_jobs = jobs_collection.count_documents({'status': {'$in': ['assigned', 'in_progress']}})
        
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        today_bills = bills_collection.count_documents({
            'created_at': {'$gte': today, '$lt': tomorrow}
        })
        
        pipeline = [
            {'$group': {'_id': None, 'total_revenue': {'$sum': '$total'}}}
        ]
        revenue_result = list(bills_collection.aggregate(pipeline))
        total_revenue = revenue_result[0]['total_revenue'] if revenue_result else 0
        
        return jsonify({
            'total_customers': total_customers,
            'total_bills': total_bills,
            'total_tailors': total_tailors,
            'total_jobs': total_jobs,
            'pending_jobs': pending_jobs,
            'today_bills': today_bills,
            'total_revenue': total_revenue
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get dashboard stats', 'error': str(e)}), 500

# Health check route
@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    return jsonify({'status': 'healthy', 'message': 'Star Tailors API is running'}), 200

# Reports and Analytics Routes
@app.route('/api/reports/revenue', methods=['GET', 'OPTIONS'])
@token_required
def get_revenue_report(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        
        if not from_date or not to_date:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=180)
        else:
            start_date = datetime.fromisoformat(from_date)
            end_date = datetime.fromisoformat(to_date)
        
        pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': start_date, '$lte': end_date}
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': {'$year': '$created_at'},
                        'month': {'$month': '$created_at'}
                    },
                    'revenue': {'$sum': '$total'},
                    'orders': {'$sum': 1},
                    'avg_order_value': {'$avg': '$total'}
                }
            },
            {
                '$sort': {'_id.year': -1, '_id.month': -1}
            }
        ]
        
        revenue_data = list(bills_collection.aggregate(pipeline))
        
        formatted_data = []
        for item in revenue_data:
            month_names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            period = f"{month_names[item['_id']['month']]} {item['_id']['year']}"
            formatted_data.append({
                'period': period,
                'revenue': round(item['revenue'], 2),
                'orders': item['orders'],
                'avgOrderValue': round(item['avg_order_value'], 2)
            })
        
        return jsonify({'revenue_data': formatted_data}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get revenue report', 'error': str(e)}), 500

@app.route('/api/reports/customers', methods=['GET', 'OPTIONS'])
@token_required
def get_customer_report(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        pipeline = [
            {
                '$lookup': {
                    'from': 'bills',
                    'localField': '_id',
                    'foreignField': 'customer_id',
                    'as': 'bills'
                }
            },
            {
                '$addFields': {
                    'total_orders': {'$size': '$bills'},
                    'total_spent': {'$sum': '$bills.total'},
                    'outstanding_balance': {
                        '$sum': {
                            '$map': {
                                'input': {
                                    '$filter': {
                                        'input': '$bills',
                                        'cond': {'$eq': ['$$this.status', 'pending']}
                                    }
                                },
                                'in': '$$this.balance'
                            }
                        }
                    },
                    'last_order_date': {'$max': '$bills.created_at'}
                }
            },
            {
                '$project': {
                    'name': 1,
                    'phone': 1,
                    'email': 1,
                    'total_orders': 1,
                    'total_spent': 1,
                    'outstanding_balance': 1,
                    'last_order_date': 1,
                    'status': {'$cond': [{'$gt': ['$total_orders', 0]}, 'active', 'inactive']}
                }
            },
            {
                '$sort': {'total_spent': -1}
            }
        ]
        
        customer_reports = list(customers_collection.aggregate(pipeline))
        
        for customer in customer_reports:
            customer['_id'] = str(customer['_id'])
            if customer.get('last_order_date'):
                customer['last_order_date'] = customer['last_order_date'].isoformat()
            customer['outstanding_balance'] = customer.get('outstanding_balance', 0)
        
        return jsonify({'customer_reports': customer_reports}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get customer report', 'error': str(e)}), 500

@app.route('/api/reports/tailors', methods=['GET', 'OPTIONS'])
@token_required
def get_tailor_report(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        pipeline = [
            {
                '$lookup': {
                    'from': 'jobs',
                    'localField': '_id',
                    'foreignField': 'tailor_id',
                    'as': 'jobs'
                }
            },
            {
                '$addFields': {
                    'completed_jobs': {
                        '$size': {
                            '$filter': {
                                'input': '$jobs',
                                'cond': {'$eq': ['$$this.status', 'completed']}
                            }
                        }
                    },
                    'total_jobs': {'$size': '$jobs'},
                    'avg_completion_time': 3.5,
                    'rating': 4.7,
                    'efficiency': {
                        '$multiply': [
                            {
                                '$divide': [
                                    {
                                        '$size': {
                                            '$filter': {
                                                'input': '$jobs',
                                                'cond': {'$eq': ['$$this.status', 'completed']}
                                            }
                                        }
                                    },
                                    {'$max': [{'$size': '$jobs'}, 1]}
                                ]
                            },
                            100
                        ]
                    }
                }
            },
            {
                '$project': {
                    'name': 1,
                    'phone': 1,
                    'specialization': 1,
                    'completed_jobs': 1,
                    'avg_completion_time': 1,
                    'rating': 1,
                    'efficiency': 1,
                    'revenue': {'$multiply': ['$completed_jobs', 800]}
                }
            },
            {
                '$sort': {'completed_jobs': -1}
            }
        ]
        
        tailor_reports = list(tailors_collection.aggregate(pipeline))
        
        for tailor in tailor_reports:
            tailor['_id'] = str(tailor['_id'])
            tailor['efficiency'] = round(tailor.get('efficiency', 0), 0)
        
        return jsonify({'tailor_reports': tailor_reports}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get tailor report', 'error': str(e)}), 500

@app.route('/api/reports/outstanding', methods=['GET', 'OPTIONS'])
@token_required
def get_outstanding_report(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        pipeline = [
            {
                '$match': {
                    'status': 'pending',
                    'balance': {'$gt': 0}
                }
            },
            {
                '$lookup': {
                    'from': 'customers',
                    'localField': 'customer_id',
                    'foreignField': '_id',
                    'as': 'customer'
                }
            },
            {
                '$unwind': '$customer'
            },
            {
                '$group': {
                    '_id': '$customer_id',
                    'customer_name': {'$first': '$customer.name'},
                    'customer_phone': {'$first': '$customer.phone'},
                    'total_outstanding': {'$sum': '$balance'},
                    'oldest_due': {'$min': '$created_at'},
                    'orders': {
                        '$push': {
                            'bill_id': {'$toString': '$_id'},
                            'amount': '$balance',
                            'due_date': '$created_at'
                        }
                    }
                }
            },
            {
                '$sort': {'total_outstanding': -1}
            }
        ]
        
        outstanding_reports = list(bills_collection.aggregate(pipeline))
        
        for report in outstanding_reports:
            report['customer_id'] = str(report['_id'])
            del report['_id']
            report['oldest_due'] = report['oldest_due'].isoformat()
            
            for order in report['orders']:
                order['due_date'] = order['due_date'].isoformat()
                days_diff = (datetime.now() - datetime.fromisoformat(order['due_date'].split('T')[0])).days
                order['days_overdue'] = max(0, days_diff)
        
        return jsonify({'outstanding_reports': outstanding_reports}), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get outstanding report', 'error': str(e)}), 500

@app.route('/api/reports/export', methods=['POST', 'OPTIONS'])
@token_required
def export_report(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        data = request.get_json()
        report_type = data.get('report_type')
        format_type = data.get('format', 'csv')
        
        if not report_type:
            return jsonify({'message': 'Report type is required'}), 400
        
        return jsonify({
            'message': f'{report_type.title()} report export started',
            'download_url': f'/api/downloads/{report_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.{format_type}'
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to export report', 'error': str(e)}), 500

if __name__ == '__main__':
    init_default_user()
    port = int(os.getenv('PORT', '5000'))
    app.run(debug=True, host='0.0.0.0', port=port)
