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
import ssl
import time
from cachetools import TTLCache
import threading
from concurrent.futures import ThreadPoolExecutor

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'rahul@123')

# Read frontend URL for CORS from env (default to localhost)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://star-tailor-website.vercel.app')

# Comprehensive CORS setup
CORS(app, origins=[FRONTEND_URL], 
     supports_credentials=True,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'])

# Simple caching for frequently accessed data
cache = TTLCache(maxsize=100, ttl=300)  # 5 minute TTL

# Handle preflight requests globally
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify()
        response.headers.add('Access-Control-Allow-Origin', FRONTEND_URL)
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
        return response, 200

# MongoDB connection with SSL fix
MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://algoflicks664:LSVMdAh5klVEB85s@star-tailor-management.yb3aynz.mongodb.net/star_tailor_db?retryWrites=true&w=majority&tls=true&appName=Star-Tailor-Management')

# Initialize collections as None initially
users_collection = None
customers_collection = None
bills_collection = None
tailors_collection = None
settings_collection = None
jobs_collection = None
counters_collection = None

# Connect to MongoDB with SSL options
try:
    client = MongoClient(
        MONGO_URI,
        tls=True,
        tlsAllowInvalidCertificates=True,
        retryWrites=True,
        w='majority',
        connectTimeoutMS=5000,  # 5 second connection timeout
        socketTimeoutMS=10000,  # 10 second socket timeout
        serverSelectionTimeoutMS=5000,  # 5 second server selection timeout
        maxPoolSize=50,  # Increased connection pool size
        minPoolSize=10
    )
    
    # Test the connection
    client.admin.command('ping')
    print("✅ MongoDB connection successful!")
    
    # Only set up collections if connection is successful
    db = client.star_tailors
    users_collection = db.users
    customers_collection = db.customers
    bills_collection = db.bills
    tailors_collection = db.tailors
    settings_collection = db.settings
    jobs_collection = db.jobs
    counters_collection = db.counters
    
    # Create indexes for better performance
    def create_indexes():
        try:
            # Customer indexes
            customers_collection.create_index([("phone", 1)], unique=True)
            customers_collection.create_index([("name", "text"), ("phone", "text"), ("email", "text")])
            customers_collection.create_index([("created_at", -1)])
            
            # Bill indexes
            bills_collection.create_index([("customer_id", 1)])
            bills_collection.create_index([("status", 1)])
            bills_collection.create_index([("created_at", -1)])
            bills_collection.create_index([("bill_no", 1)], unique=True)
            
            # Tailor indexes
            tailors_collection.create_index([("phone", 1)], unique=True)
            tailors_collection.create_index([("name", "text"), ("phone", "text"), ("specialization", "text")])
            
            # Job indexes
            jobs_collection.create_index([("tailor_id", 1)])
            jobs_collection.create_index([("status", 1)])
            jobs_collection.create_index([("created_at", -1)])
            
            # User indexes
            users_collection.create_index([("username", 1)], unique=True)
            
            print("✅ Database indexes created successfully!")
        except Exception as e:
            print(f"⚠️  Index creation error: {str(e)}")
    
    # Run index creation in background
    index_thread = threading.Thread(target=create_indexes)
    index_thread.daemon = True
    index_thread.start()
    
except Exception as e:
    print(f"❌ MongoDB connection failed: {str(e)}")
    # Create a dummy client to prevent crashes (for development only)
    client = None

db = client.star_tailors if client else None

# Collections (with fallbacks to prevent crashes)
if client is not None:
    users_collection = db.users
    customers_collection = db.customers
    bills_collection = db.bills
    tailors_collection = db.tailors
    settings_collection = db.settings
    jobs_collection = db.jobs
    counters_collection = db.counters
else:
    # Create dummy collections to prevent crashes during development
    users_collection = customers_collection = bills_collection = None
    tailors_collection = settings_collection = jobs_collection = counters_collection = None
    print("⚠️  Running in dummy mode without database connection")

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
            
            # Use cache for user lookup
            cache_key = f"user_{data['user_id']}"
            current_user = cache.get(cache_key)
            
            if current_user is None:
                if users_collection is None:
                    # Dummy user for development when DB is not available
                    current_user = {
                        '_id': ObjectId(),
                        'username': 'admin',
                        'role': 'admin'
                    }
                else:
                    current_user = users_collection.find_one({'_id': ObjectId(data['user_id'])}, 
                                                           {'password': 0})  # Exclude password
                
                if current_user is not None:
                    cache[cache_key] = current_user
                else:
                    return jsonify({'message': 'Token is invalid'}), 401
                    
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

# Utility: Atomic sequence generator for bill numbers
def get_next_sequence(name: str) -> int:
    if counters_collection is None:
        # Fallback for when DB is not available
        return 1
    
    try:
        doc = counters_collection.find_one_and_update(
            {'_id': name},
            {'$inc': {'seq': 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        return int(doc.get('seq', 1))
    except Exception:
        # Fallback in case counters collection isn't available
        return bills_collection.count_documents({}) + 1 if bills_collection is not None else 1

def format_bill_no(n: int, width: int = 3) -> str:
    try:
        return str(int(n)).zfill(width)
    except Exception:
        return str(n)

# Initialize default admin user
def init_default_user():
    if users_collection is None:
        print("⚠️  Skipping default user creation - no database connection")
        return
        
    # Ensure default users exist: admin, tailor, billing
    defaults = [
        ('admin', 'admin123', 'admin'),
        ('tailor', 'tailor123', 'tailor'),
        ('billing', 'billing123', 'billing'),
    ]
    for username, pwd, role in defaults:
        exists = users_collection.find_one({'username': username})
        if exists is None:
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
        
        # For development when DB is not available
        if users_collection is None:
            print("Using demo mode login")
            if username == 'admin' and password == 'admin123':
                token = jwt.encode({
                    'user_id': str(ObjectId()),
                    'username': 'admin',
                    'role': 'admin',
                    'exp': datetime.utcnow() + timedelta(hours=24)
                }, app.config['SECRET_KEY'], algorithm='HS256')
                
                return jsonify({
                    'message': 'Login successful (demo mode)',
                    'token': token,
                    'user': {
                        'id': str(ObjectId()),
                        'username': 'admin',
                        'role': 'admin'
                    }
                }), 200
            else:
                return jsonify({'message': 'Invalid credentials'}), 401
        
        # Use projection to exclude password from initial query
        user = users_collection.find_one({'username': username}, {'password': 1, 'username': 1, 'role': 1})
        
        if user is not None and bcrypt.checkpw(password.encode('utf-8'), user['password']):
            # Create token without password
            token = jwt.encode({
                'user_id': str(user['_id']),
                'username': user['username'],
                'role': user['role'],
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, app.config['SECRET_KEY'], algorithm='HS256')
            
            # Cache user data
            cache_key = f"user_{user['_id']}"
            cache[cache_key] = {
                '_id': user['_id'],
                'username': user['username'],
                'role': user['role']
            }
            
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
        print(f"Login error: {str(e)}")
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

# Customer Management Routes - Optimized
@app.route('/api/customers', methods=['GET', 'OPTIONS'])
@token_required
def get_customers(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        # For development when DB is not available
        if customers_collection is None:
            return jsonify({
                'customers': [],
                'pagination': {
                    'current_page': 1,
                    'total_pages': 1,
                    'total_customers': 0,
                    'has_next': False,
                    'has_prev': False
                }
            }), 200
            
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 10)), 50)  # Limit max results to 50
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
        
        # Use projection to only fetch necessary fields
        projection = {
            'name': 1,
            'phone': 1,
            'email': 1,
            'address': 1,
            'created_at': 1,
            'updated_at': 1
        }
        
        customers = list(customers_collection.find(query, projection)
                          .skip(skip)
                          .limit(limit)
                          .sort('_id', -1))
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
        return jsonify({'message': 'Failed to get customers', 'error': str(e)}), 500

@app.route('/api/customers', methods=['POST', 'OPTIONS'])
@token_required
def create_customer(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        # For development when DB is not available
        if customers_collection is None:
            data = request.get_json()
            return jsonify({
                'message': 'Customer created successfully (demo mode)',
                'customer': {
                    '_id': str(ObjectId()),
                    'name': data.get('name', ''),
                    'phone': data.get('phone', ''),
                    'email': data.get('email', ''),
                    'address': data.get('address', ''),
                    'notes': data.get('notes', ''),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
            }), 201
            
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        email = data.get('email')
        address = data.get('address')
        notes = data.get('notes')
        
        if not name or not phone:
            return jsonify({'message': 'Name and phone are required'}), 400
        
        existing_customer = customers_collection.find_one({'phone': phone})
        if existing_customer is not None:
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
        # For development when DB is not available
        if customers_collection is None:
            return jsonify({
                'customer': {
                    '_id': customer_id,
                    'name': 'Demo Customer',
                    'phone': '1234567890',
                    'email': 'demo@example.com',
                    'address': 'Demo Address',
                    'notes': 'Demo notes',
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat(),
                    'bills': [],
                    'total_orders': 0,
                    'total_spent': 0,
                    'outstanding_balance': 0
                }
            }), 200
            
        customer = customers_collection.find_one({'_id': ObjectId(customer_id)})
        if customer is None:
            return jsonify({'message': 'Customer not found'}), 404
        
        customer['_id'] = str(customer['_id'])
        if 'created_at' in customer and customer['created_at']:
            customer['created_at'] = customer['created_at'].isoformat()
        if 'updated_at' in customer and customer['updated_at']:
            customer['updated_at'] = customer['updated_at'].isoformat()
        
        # Get customer's bills with projection for performance
        bills = []
        if bills_collection is not None:
            bills = list(bills_collection.find(
                {'customer_id': ObjectId(customer_id)},
                {'total': 1, 'balance': 1, 'status': 1, 'created_at': 1, 'bill_no_str': 1}
            ))
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
        # For development when DB is not available
        if customers_collection is None:
            data = request.get_json()
            return jsonify({
                'message': 'Customer updated successfully (demo mode)',
                'customer': {
                    '_id': customer_id,
                    'name': data.get('name', 'Demo Customer'),
                    'phone': data.get('phone', '1234567890'),
                    'email': data.get('email', 'demo@example.com'),
                    'address': data.get('address', 'Demo Address'),
                    'notes': data.get('notes', 'Demo notes'),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
            }), 200
            
        data = request.get_json()
        
        customer = customers_collection.find_one({'_id': ObjectId(customer_id)})
        if customer is None:
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
        # For development when DB is not available
        if customers_collection is None:
            return jsonify({'message': 'Customer deleted successfully (demo mode)'}), 200
            
        result = customers_collection.delete_one({'_id': ObjectId(customer_id)})
        
        if result.deleted_count == 0:
            return jsonify({'message': 'Customer not found'}), 404
        
        # Also delete associated bills
        if bills_collection is not None:
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
        # For development when DB is not available
        if customers_collection is None:
            return jsonify({
                'total_customers': 0,
                'customers_with_outstanding': 0,
                'total_outstanding_amount': 0
            }), 200
            
        total_customers = customers_collection.count_documents({})
        
        # Count customers with outstanding balances using aggregation for better performance
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
                    'bills.status': 'pending',
                    'bills.balance': {'$gt': 0}
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
        
        outstanding_amount_result = list(bills_collection.aggregate(pipeline)) if bills_collection is not None else []
        total_outstanding_amount = outstanding_amount_result[0]['total_outstanding'] if outstanding_amount_result else 0
        
        return jsonify({
            'total_customers': total_customers,
            'customers_with_outstanding': customers_with_outstanding,
            'total_outstanding_amount': total_outstanding_amount
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get customer stats', 'error': str(e)}), 500

# Billing System Routes - Optimized
@app.route('/api/bills', methods=['GET', 'OPTIONS'])
@token_required
def get_bills(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        # For development when DB is not available
        if bills_collection is None:
            return jsonify({
                'bills': [],
                'pagination': {
                    'current_page': 1,
                    'total_pages': 1,
                    'total_bills': 0,
                    'has_next': False,
                    'has_prev': False
                }
            }), 200
            
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        customer_id = request.args.get('customer_id', '')
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 10)), 50)  # Limit max results
        skip = (page - 1) * limit
        
        query = {}
        
        if search:
            # Use text search if indexes are available, otherwise use regex
            try:
                # First try to find customer by ID for exact matches
                if ObjectId.is_valid(search):
                    query['customer_id'] = ObjectId(search)
                else:
                    # Use text search or fallback to regex
                    customers = customers_collection.find({
                        '$or': [
                            {'name': {'$regex': search, '$options': 'i'}},
                            {'phone': {'$regex': search, '$options': 'i'}}
                        ]
                    }, {'_id': 1}).limit(10)
                    customer_ids = [customer['_id'] for customer in customers]
                    if customer_ids:
                        query['customer_id'] = {'$in': customer_ids}
            except Exception as e:
                print(f"Search optimization error: {str(e)}")
        
        if status:
            query['status'] = status
        
        if customer_id:
            try:
                query['customer_id'] = ObjectId(customer_id)
            except:
                return jsonify({'message': 'Invalid customer ID format'}), 400
        
        # Use projection to only fetch necessary fields
        projection = {
            'customer_id': 1,
            'customer_name': 1,
            'customer_phone': 1,
            'total': 1,
            'balance': 1,
            'status': 1,
            'created_at': 1,
            'bill_no_str': 1
        }
        
        bills = list(bills_collection.find(query, projection)
                      .skip(skip)
                      .limit(limit)
                      .sort('created_at', -1))
        total_bills = bills_collection.count_documents(query)
        
        formatted_bills = []
        customer_cache = {}
        
        for bill in bills:
            try:
                bill['_id'] = str(bill['_id'])
                bill['customer_id'] = str(bill['customer_id'])
                bill['created_at'] = bill['created_at'].isoformat()
                
                # Cache customer data to avoid multiple lookups
                customer_key = bill['customer_id']
                if customer_key not in customer_cache:
                    customer = customers_collection.find_one(
                        {'_id': ObjectId(bill['customer_id'])},
                        {'name': 1, 'phone': 1}
                    )
                    customer_cache[customer_key] = customer if customer else {
                        'name': 'Unknown',
                        'phone': 'N/A'
                    }
                
                bill['customer'] = customer_cache[customer_key]
                formatted_bills.append(bill)
            except Exception as e:
                print(f"Error formatting bill: {str(e)}")
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
        return jsonify({
            'message': 'Failed to get bills', 
            'error': str(e)
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

        # For development when DB is not available
        if bills_collection is None:
            next_no = 1
            bill_no_str = format_bill_no(next_no, 3)
            
            new_bill = {
                '_id': str(ObjectId()),
                'customer_id': data['customer_id'],
                'customer_name': data.get('customer_name', 'Demo Customer'),
                'customer_phone': data.get('customer_phone', '1234567890'),
                'customer_address': data.get('customer_address', 'Demo Address'),
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
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'bill_no': int(next_no),
                'bill_no_str': bill_no_str,
            }

            return jsonify({
                'message': 'Bill created successfully (demo mode)',
                'bill': new_bill
            }), 201

        try:
            customer_id = ObjectId(data['customer_id'])
        except:
            return jsonify({'message': 'Invalid customer ID format'}), 400
            
        customer = customers_collection.find_one({'_id': customer_id})
        if customer is None:
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
        cache_key = "upi_settings"
        cached_settings = cache.get(cache_key)
        
        if cached_settings:
            return jsonify(cached_settings), 200
            
        settings = None
        if settings_collection is not None:
            settings = settings_collection.find_one({'type': 'upi_settings'})
            
        if settings is None:
            result = {
                'upi_id': 'startailors@paytm',
                'business_name': 'Star Tailors'
            }
            cache[cache_key] = result
            return jsonify(result), 200
        
        result = {
            'upi_id': settings.get('upi_id', 'startailors@paytm'),
            'business_name': settings.get('business_name', 'Star Tailors')
        }
        cache[cache_key] = result
        return jsonify(result), 200
        
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
        
        # For development when DB is not available
        if settings_collection is None:
            return jsonify({'message': 'UPI settings updated successfully (demo mode)'}), 200
            
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
        
        # Clear cache
        cache.pop("upi_settings", None)
        
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
        cache_key = "business_settings"
        cached_settings = cache.get(cache_key)
        
        if cached_settings:
            return jsonify(cached_settings), 200
            
        settings = None
        if settings_collection is not None:
            settings = settings_collection.find_one({'type': 'business_info'})
            
        if settings is None:
            # Defaults
            result = {
                'business_name': 'STAR TAILORS',
                'address': 'Baramati, Maharashtra',
                'phone': '+91 00000 00000',
                'email': 'info@startailors.com'
            }
            cache[cache_key] = result
            return jsonify(result), 200
        
        result = {
            'business_name': settings.get('business_name', 'STAR TAILORS'),
            'address': settings.get('address', ''),
            'phone': settings.get('phone', ''),
            'email': settings.get('email', '')
        }
        cache[cache_key] = result
        return jsonify(result), 200
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
            
        # For development when DB is not available
        if settings_collection is None:
            return jsonify({'message': 'Business settings updated successfully (demo mode)'}), 200
            
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
        
        # Clear cache
        cache.pop("business_settings", None)
        
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
        # For development when DB is not available
        if tailors_collection is None:
            return jsonify({
                'tailors': [],
                'pagination': {
                    'current_page': 1,
                    'total_pages': 1,
                    'total_tailors': 0,
                    'has_next': False,
                    'has_prev': False
                }
            }), 200
            
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 10)), 50)
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
        
        # Use projection for better performance
        projection = {
            'name': 1,
            'phone': 1,
            'email': 1,
            'specialization': 1,
            'experience': 1,
            'status': 1,
            'created_at': 1
        }
        
        tailors = list(tailors_collection.find(query, projection).skip(skip).limit(limit).sort('created_at', -1))
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
        # For development when DB is not available
        if tailors_collection is None:
            data = request.get_json()
            return jsonify({
                'message': 'Tailor created successfully (demo mode)',
                'tailor': {
                    '_id': str(ObjectId()),
                    'name': data.get('name', 'Demo Tailor'),
                    'phone': data.get('phone', '1234567890'),
                    'email': data.get('email', 'demo@example.com'),
                    'specialization': data.get('specialization', 'General Tailoring'),
                    'experience': data.get('experience', '1 year'),
                    'status': 'active',
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
            }), 201
            
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        email = data.get('email')
        specialization = data.get('specialization')
        experience = data.get('experience')
        
        if not name or not phone:
            return jsonify({'message': 'Name and phone are required'}), 400
        
        existing_tailor = tailors_collection.find_one({'phone': phone})
        if existing_tailor is not None:
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
        # For development when DB is not available
        if tailors_collection is None or jobs_collection is None:
            return jsonify({
                'jobs': [],
                'tailor': {
                    'id': tailor_id,
                    'name': 'Demo Tailor',
                    'phone': '1234567890',
                    'specialization': 'General Tailoring'
                },
                'pagination': {
                    'current_page': 1,
                    'total_pages': 1,
                    'total_jobs': 0,
                    'has_next': False,
                    'has_prev': False
                }
            }), 200
            
        tailor = tailors_collection.find_one({'_id': ObjectId(tailor_id)})
        
        if tailor is None:
            tailor = tailors_collection.find_one({'user_id': tailor_id})
        
        if tailor is None and str(current_user['_id']) == tailor_id:
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
        
        if tailor is None:
            return jsonify({'message': 'Tailor not found'}), 404
        
        status = request.args.get('status', '')
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 10)), 50)
        skip = (page - 1) * limit
        
        query = {'tailor_id': tailor['_id']}
        if status:
            query['status'] = status
        
        # Use projection for better performance
        projection = {
            'title': 1,
            'description': 1,
            'status': 1,
            'priority': 1,
            'due_date': 1,
            'created_at': 1,
            'bill_id': 1
        }
        
        jobs = list(jobs_collection.find(query, projection).skip(skip).limit(limit).sort('created_at', -1))
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
        return jsonify({'message': 'Failed to get tailor jobs', 'error': str(e)}), 500

# Job Management Routes
@app.route('/api/jobs', methods=['GET', 'OPTIONS'])
@token_required
def get_jobs(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        # For development when DB is not available
        if jobs_collection is None:
            return jsonify({
                'jobs': [],
                'pagination': {
                    'current_page': 1,
                    'total_pages': 1,
                    'total_jobs': 0,
                    'has_next': False,
                    'has_prev': False
                }
            }), 200
            
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        tailor_id = request.args.get('tailor_id', '')
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 10)), 50)
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
        
        # Use projection for better performance
        projection = {
            'title': 1,
            'description': 1,
            'tailor_id': 1,
            'status': 1,
            'priority': 1,
            'due_date': 1,
            'created_at': 1,
            'bill_id': 1
        }
        
        jobs = list(jobs_collection.find(query, projection).skip(skip).limit(limit).sort('created_at', -1))
        total_jobs = jobs_collection.count_documents(query)
        
        for job in jobs:
            job['_id'] = str(job['_id'])
            job['tailor_id'] = str(job['tailor_id'])
            job['bill_id'] = str(job['bill_id']) if job.get('bill_id') else None
            job['created_at'] = job['created_at'].isoformat()
            job['updated_at'] = job['updated_at'].isoformat()
            
            tailor = tailors_collection.find_one({'_id': ObjectId(job['tailor_id'])}, {'name': 1, 'phone': 1})
            if tailor is not None:
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
        # For development when DB is not available
        if jobs_collection is None:
            data = request.get_json()
            return jsonify({
                'message': 'Job created successfully (demo mode)',
                'job': {
                    '_id': str(ObjectId()),
                    'title': data.get('title', 'Demo Job'),
                    'description': data.get('description', 'Demo description'),
                    'tailor_id': data.get('tailor_id', str(ObjectId())),
                    'bill_id': data.get('bill_id', str(ObjectId())),
                    'status': 'assigned',
                    'priority': data.get('priority', 'medium'),
                    'due_date': data.get('due_date', datetime.now().isoformat()),
                    'created_by': str(current_user['_id']),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
            }), 201
            
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
        if tailor is None:
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
        # For development when DB is not available
        if jobs_collection is None:
            return jsonify({'message': 'Job status updated successfully (demo mode)'}), 200
            
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

# Dashboard Statistics Route - Optimized with caching
@app.route('/api/dashboard/stats', methods=['GET', 'OPTIONS'])
@token_required
def get_dashboard_stats(current_user):
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    try:
        cache_key = "dashboard_stats"
        cached_stats = cache.get(cache_key)
        
        if cached_stats:
            return jsonify(cached_stats), 200
        
        # For development when DB is not available
        if (customers_collection is None or bills_collection is None or 
            tailors_collection is None or jobs_collection is None):
            stats = {
                'total_customers': 0,
                'total_bills': 0,
                'total_tailors': 0,
                'total_jobs': 0,
                'pending_jobs': 0,
                'today_bills': 0,
                'total_revenue': 0
            }
            cache[cache_key] = stats
            return jsonify(stats), 200
            
        # Use parallel execution for better performance
        def get_count(collection, query=None):
            try:
                return collection.count_documents(query if query else {})
            except:
                return 0
        
        with ThreadPoolExecutor() as executor:
            # Submit all count operations in parallel
            future_total_customers = executor.submit(get_count, customers_collection)
            future_total_bills = executor.submit(get_count, bills_collection)
            future_total_tailors = executor.submit(get_count, tailors_collection)
            future_total_jobs = executor.submit(get_count, jobs_collection)
            future_pending_jobs = executor.submit(get_count, jobs_collection, {'status': {'$in': ['assigned', 'in_progress']}})
            
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            tomorrow = today + timedelta(days=1)
            future_today_bills = executor.submit(get_count, bills_collection, {
                'created_at': {'$gte': today, '$lt': tomorrow}
            })
            
            # Get revenue in separate thread
            def get_revenue():
                try:
                    pipeline = [{'$group': {'_id': None, 'total_revenue': {'$sum': '$total'}}}]
                    revenue_result = list(bills_collection.aggregate(pipeline))
                    return revenue_result[0]['total_revenue'] if revenue_result else 0
                except:
                    return 0
            
            future_total_revenue = executor.submit(get_revenue)
            
            # Wait for all results
            stats = {
                'total_customers': future_total_customers.result(),
                'total_bills': future_total_bills.result(),
                'total_tailors': future_total_tailors.result(),
                'total_jobs': future_total_jobs.result(),
                'pending_jobs': future_pending_jobs.result(),
                'today_bills': future_today_bills.result(),
                'total_revenue': future_total_revenue.result()
            }
        
        cache[cache_key] = stats
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({'message': 'Failed to get dashboard stats', 'error': str(e)}), 500

# Health check route
@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    if request.method == 'OPTIONS':
        return jsonify(), 200
        
    db_status = "connected" if client is not None and client.admin.command('ping') else "disconnected"
    return jsonify({
        'status': 'healthy', 
        'message': 'Star Tailors API is running',
        'database': db_status
    }), 200

# Add performance monitoring middleware
@app.after_request
def after_request(response):
    # Add performance headers
    if hasattr(request, 'start_time'):
        response.headers['X-Response-Time'] = f"{time.time() - request.start_time:.3f}s"
    return response

@app.before_request
def before_request():
    request.start_time = time.time()

# Initialize default user in background
def init_default_user_async():
    time.sleep(2)  # Wait for app to start
    init_default_user()

# Start initialization in background
init_thread = threading.Thread(target=init_default_user_async)
init_thread.daemon = True
init_thread.start()

if __name__ == '__main__':
    port = int(os.getenv('PORT', '5000'))
    # Use production server for better performance
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)