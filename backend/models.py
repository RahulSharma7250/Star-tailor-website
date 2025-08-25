from datetime import datetime
from bson import ObjectId
from typing import List, Optional

class User:
    def __init__(self, username: str, password: str, role: str = 'user'):
        self.username = username
        self.password = password
        self.role = role
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self):
        return {
            'username': self.username,
            'password': self.password,
            'role': self.role,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

class Customer:
    def __init__(self, name: str, phone: str, 
                 email: Optional[str] = None, 
                 address: Optional[str] = None, 
                 notes: Optional[str] = None):
        self.name = name
        self.phone = phone
        self.email = email
        self.address = address
        self.notes = notes
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self):
        return {
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'notes': self.notes,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

class BillItem:
    def __init__(self, name: str, price: float, quantity: int = 1, description: Optional[str] = None):
        self.name = name
        self.description = description
        self.quantity = quantity
        self.price = price
    
    def to_dict(self):
        return {
            'name': self.name,
            'description': self.description,
            'quantity': self.quantity,
            'price': self.price
        }

class Bill:
    def __init__(self, customer_id: str, items: List[BillItem], 
                 discount: float = 0, advance: float = 0, 
                 status: str = 'pending', notes: Optional[str] = None):
        self.customer_id = ObjectId(customer_id)
        self.items = [item.to_dict() for item in items]
        self.subtotal = sum(item.price * item.quantity for item in items)
        self.discount = discount
        self.advance = advance
        self.balance = self.subtotal - discount - advance
        self.status = status
        self.notes = notes
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self):
        return {
            'customer_id': self.customer_id,
            'items': self.items,
            'subtotal': self.subtotal,
            'discount': self.discount,
            'advance': self.advance,
            'balance': self.balance,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

class Tailor:
    def __init__(self, name: str, phone: str, 
                 email: Optional[str] = None, 
                 specialization: Optional[str] = None, 
                 status: str = 'active'):
        self.name = name
        self.phone = phone
        self.email = email
        self.specialization = specialization
        self.status = status
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self):
        return {
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'specialization': self.specialization,
            'status': self.status,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

class SystemSettings:
    def __init__(self, upi_id: str, business_name: str, 
                 business_address: Optional[str] = None, 
                 business_phone: Optional[str] = None):
        self.upi_id = upi_id
        self.business_name = business_name
        self.business_address = business_address
        self.business_phone = business_phone
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self):
        return {
            'type': 'system_settings',
            'upi_id': self.upi_id,
            'business_name': self.business_name,
            'business_address': self.business_address,
            'business_phone': self.business_phone,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }