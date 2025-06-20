import frappe
from frappe import _
from frappe.utils import getdate, nowdate
from frappe.model.document import Document

class MarketRate(Document):
    def validate(self):
        self.validate_dates()
        self.validate_active_status()
        self.fetch_item_details()
        
    def validate_dates(self):
        """Validate date ranges"""
        if self.valid_from and self.valid_to:
            if getdate(self.valid_from) > getdate(self.valid_to):
                frappe.throw(_("Valid From date cannot be after Valid To date"))
                
        if self.valid_from and getdate(self.valid_from) < getdate(nowdate()):
            frappe.msgprint(_("Valid From date is in the past"))
            
    def validate_active_status(self):
        """Ensure only one active rate per item"""
        if self.is_active:
            # Deactivate other active rates for the same item
            frappe.db.sql("""
                UPDATE `tabMarket Rate`
                SET is_active = 0
                WHERE item_code = %s
                AND name != %s
                AND is_active = 1
            """, (self.item_code, self.name))
            
    def fetch_item_details(self):
        """Fetch item details from Item master"""
        if self.item_code:
            item = frappe.get_doc("Item", self.item_code)
            self.item_name = item.item_name
            if not self.unit:
                self.unit = item.stock_uom
                
    def on_submit(self):
        """Actions to perform when market rate is submitted"""
        if self.is_active:
            self.validate_active_status()
            
    def on_cancel(self):
        """Actions to perform when market rate is cancelled"""
        if self.is_active:
            frappe.throw(_("Cannot cancel an active market rate. Please deactivate it first."))
            
    @staticmethod
    def get_current_rate(item_code, location=None):
        """Get current market rate for an item"""
        filters = {
            "item_code": item_code,
            "is_active": 1,
            "valid_from": ("<=", nowdate())
        }
        
        if location:
            filters["location"] = location
            
        rate = frappe.get_value("Market Rate", filters, "rate")
        return rate
        
    @staticmethod
    def get_rate_history(item_code, location=None, from_date=None, to_date=None):
        """Get historical rates for an item"""
        filters = {
            "item_code": item_code,
            "docstatus": 1
        }
        
        if location:
            filters["location"] = location
            
        if from_date:
            filters["valid_from"] = (">=", from_date)
            
        if to_date:
            filters["valid_to"] = ("<=", to_date)
            
        return frappe.get_all(
            "Market Rate",
            filters=filters,
            fields=["rate", "valid_from", "valid_to", "supplier", "location"],
            order_by="valid_from desc"
        )
        
    @staticmethod
    def update_rates_from_supplier_quotation(quotation):
        """Update market rates from supplier quotation"""
        if quotation.doctype != "Supplier Quotation":
            return
            
        for item in quotation.items:
            market_rate = frappe.new_doc("Market Rate")
            market_rate.item_code = item.item_code
            market_rate.rate = item.rate
            market_rate.unit = item.uom
            market_rate.valid_from = quotation.valid_from
            market_rate.valid_to = quotation.valid_till
            market_rate.supplier = quotation.supplier
            market_rate.is_active = 1
            market_rate.insert()
            
    @staticmethod
    def get_rate_trend(item_code, location=None, period="monthly"):
        """Get rate trend analysis for an item"""
        import pandas as pd
        from datetime import datetime, timedelta
        
        # Get historical rates
        rates = MarketRate.get_rate_history(item_code, location)
        if not rates:
            return None
            
        # Convert to pandas DataFrame
        df = pd.DataFrame(rates)
        df['valid_from'] = pd.to_datetime(df['valid_from'])
        
        # Group by period
        if period == "monthly":
            df['period'] = df['valid_from'].dt.to_period('M')
        elif period == "quarterly":
            df['period'] = df['valid_from'].dt.to_period('Q')
        else:
            df['period'] = df['valid_from'].dt.to_period('Y')
            
        # Calculate statistics
        trend = df.groupby('period')['rate'].agg(['mean', 'min', 'max']).reset_index()
        trend['period'] = trend['period'].astype(str)
        
        return trend.to_dict('records') 