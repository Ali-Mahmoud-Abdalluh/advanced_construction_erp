import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate, today

class HistoricalRateDatabase(Document):
    def validate(self):
        self.validate_rate_history()
        self.update_current_rate()
        
    def validate_rate_history(self):
        """Validate that rate history entries are in chronological order"""
        if not self.rate_history:
            return
            
        # Sort rate history by date
        self.rate_history.sort(key=lambda x: getdate(x.rate_date))
        
        # Check for duplicate dates
        dates = {}
        for i, record in enumerate(self.rate_history):
            if record.rate_date in dates:
                frappe.throw(_("Duplicate rate date at rows {0} and {1}").format(
                    dates[record.rate_date] + 1, i + 1))
            else:
                dates[record.rate_date] = i
    
    def update_current_rate(self):
        """Update current rate based on the latest rate in history"""
        if not self.rate_history:
            return
            
        # Get the latest rate from history
        latest_record = self.rate_history[-1]  # Already sorted in validate_rate_history
        
        # Update current rate if the latest record is newer
        if not self.current_rate_date or getdate(latest_record.rate_date) > getdate(self.current_rate_date):
            self.current_rate = latest_record.rate
            self.current_rate_date = latest_record.rate_date
            
            # Update index if available
            if latest_record.index_value:
                self.current_index = latest_record.index_value
                self.current_index_date = latest_record.rate_date
    
    def add_rate_history(self, rate, rate_date, index_value=None, source=None, notes=None):
        """Add a new rate history entry"""
        # Check if rate already exists for this date
        for record in self.rate_history:
            if getdate(record.rate_date) == getdate(rate_date):
                record.rate = rate
                record.index_value = index_value
                record.source = source
                record.notes = notes
                self.validate()
                self.save()
                return
        
        # Add new rate history record
        self.append("rate_history", {
            "rate_date": rate_date,
            "rate": rate,
            "index_value": index_value,
            "source": source,
            "notes": notes
        })
        
        self.validate()
        self.save()
    
    def add_project_reference(self, project, rate_used=None, usage_date=None, location=None, notes=None):
        """Add a project reference"""
        # Check if project already exists
        for ref in self.projects:
            if ref.project == project:
                if rate_used:
                    ref.rate_used = rate_used
                if usage_date:
                    ref.usage_date = usage_date
                if location:
                    ref.location = location
                if notes:
                    ref.notes = notes
                self.save()
                return
        
        # Add new project reference
        self.append("projects", {
            "project": project,
            "rate_used": rate_used or self.current_rate,
            "usage_date": usage_date or today(),
            "location": location,
            "notes": notes
        })
        
        self.save()
    
    def calculate_indexed_rate(self, target_index=None, target_date=None):
        """Calculate indexed rate based on target index or current index"""
        if not self.base_index or not self.base_index_date:
            frappe.throw(_("Base index and date must be set for indexation"))
        
        # If target index not provided, use current index
        if not target_index:
            if not self.current_index or not self.current_index_date:
                frappe.throw(_("Current index and date must be set for indexation"))
            target_index = self.current_index
            target_date = self.current_index_date
        
        # Calculate indexed rate
        indexed_rate = self.current_rate * (flt(target_index) / flt(self.base_index))
        
        return {
            "original_rate": self.current_rate,
            "original_date": self.current_rate_date,
            "indexed_rate": indexed_rate,
            "indexed_date": target_date,
            "base_index": self.base_index,
            "base_index_date": self.base_index_date,
            "target_index": target_index,
            "target_index_date": target_date
        }

@frappe.whitelist()
def get_historical_rates(item_code, start_date=None, end_date=None):
    """Get historical rates for an item"""
    filters = {"item_code": item_code}
    
    if start_date:
        filters["rate_date"] = [">=", start_date]
    if end_date:
        if "rate_date" in filters:
            filters["rate_date"] = ["between", [start_date, end_date]]
        else:
            filters["rate_date"] = ["<=", end_date]
    
    # Get the historical rate database document
    rate_db = frappe.get_doc("Historical Rate Database", item_code)
    
    # Filter rate history based on date range
    rates = []
    for record in rate_db.rate_history:
        include = True
        if start_date and getdate(record.rate_date) < getdate(start_date):
            include = False
        if end_date and getdate(record.rate_date) > getdate(end_date):
            include = False
        
        if include:
            rates.append({
                "rate_date": record.rate_date,
                "rate": record.rate,
                "index_value": record.index_value,
                "source": record.source
            })
    
    return {
        "item_code": rate_db.item_code,
        "item_name": rate_db.item_name,
        "current_rate": rate_db.current_rate,
        "current_rate_date": rate_db.current_rate_date,
        "rates": rates
    }

@frappe.whitelist()
def calculate_indexed_rate(item_code, target_index=None, target_date=None):
    """Calculate indexed rate for an item"""
    rate_db = frappe.get_doc("Historical Rate Database", item_code)
    return rate_db.calculate_indexed_rate(target_index, target_date)

@frappe.whitelist()
def add_rate_history(item_code, rate, rate_date, index_value=None, source=None, notes=None):
    """Add a rate history entry for an item"""
    rate_db = frappe.get_doc("Historical Rate Database", item_code)
    return rate_db.add_rate_history(rate, rate_date, index_value, source, notes) 