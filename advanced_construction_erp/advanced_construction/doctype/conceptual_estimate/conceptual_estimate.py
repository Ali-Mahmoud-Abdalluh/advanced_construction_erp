import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate
from frappe.model.document import Document

class ConceptualEstimate(Document):
    def validate(self):
        self.validate_dates()
        self.calculate_totals()
        self.validate_rates()
        
    def validate_dates(self):
        if getdate(self.estimate_date) > getdate(nowdate()):
            frappe.throw(_("Estimate date cannot be in the future"))
            
    def calculate_totals(self):
        """Calculate total estimated cost and add contingency"""
        total_base_cost = 0
        for item in self.estimate_items:
            item.amount = flt(item.quantity * item.rate)
            total_base_cost += item.amount
            
        self.total_base_cost = total_base_cost
        self.contingency_amount = flt(total_base_cost * (self.contingency_percentage / 100))
        self.total_estimated_cost = flt(total_base_cost + self.contingency_amount)
        
    def validate_rates(self):
        """Validate rates against market standards"""
        for item in self.estimate_items:
            if item.rate < 0:
                frappe.throw(_("Rate cannot be negative for item {0}").format(item.item_name))
                
    def get_historical_data(self):
        """Fetch historical cost data for similar projects"""
        return frappe.get_all(
            "Conceptual Estimate",
            filters={
                "project_type": self.project_type,
                "status": "Completed",
                "docstatus": 1
            },
            fields=["name", "total_estimated_cost", "actual_cost", "project_size"]
        )
        
    def apply_escalation(self):
        """Apply escalation factors to the estimate"""
        if not self.escalation_percentage:
            return
            
        for item in self.estimate_items:
            item.rate = flt(item.rate * (1 + self.escalation_percentage / 100))
            item.amount = flt(item.quantity * item.rate)
            
        self.calculate_totals()
        
    def create_detailed_estimate(self):
        """Create a detailed estimate from this conceptual estimate"""
        if not self.docstatus == 1:
            frappe.throw(_("Please submit the conceptual estimate first"))
            
        detailed_estimate = frappe.new_doc("Detailed Estimate")
        detailed_estimate.project = self.project
        detailed_estimate.conceptual_estimate = self.name
        detailed_estimate.estimate_date = nowdate()
        
        # Copy basic project information
        detailed_estimate.project_type = self.project_type
        detailed_estimate.project_size = self.project_size
        detailed_estimate.location = self.location
        
        # Create detailed items from conceptual items
        for item in self.estimate_items:
            detailed_item = detailed_estimate.append("estimate_items", {
                "item_code": item.item_code,
                "item_name": item.item_name,
                "quantity": item.quantity,
                "unit": item.unit,
                "rate": item.rate,
                "amount": item.amount
            })
            
        detailed_estimate.insert()
        return detailed_estimate
        
    def update_from_market_rates(self):
        """Update rates based on current market prices"""
        for item in self.estimate_items:
            market_rate = frappe.get_value("Market Rate", {
                "item_code": item.item_code,
                "is_active": 1
            }, "rate")
            
            if market_rate:
                item.rate = market_rate
                item.amount = flt(item.quantity * item.rate)
                
        self.calculate_totals()
        
    def compare_with_historical(self):
        """Compare current estimate with historical data"""
        historical_data = self.get_historical_data()
        if not historical_data:
            return
            
        avg_cost_per_unit = sum(d.actual_cost / d.project_size for d in historical_data) / len(historical_data)
        current_cost_per_unit = self.total_estimated_cost / self.project_size
        
        variance_percentage = ((current_cost_per_unit - avg_cost_per_unit) / avg_cost_per_unit) * 100
        
        return {
            "average_historical_cost": avg_cost_per_unit,
            "current_cost": current_cost_per_unit,
            "variance_percentage": variance_percentage
        }
        
    def on_submit(self):
        """Actions to perform when estimate is submitted"""
        self.status = "Submitted"
        self.submitted_by = frappe.session.user
        self.submitted_on = nowdate()
        
    def on_cancel(self):
        """Actions to perform when estimate is cancelled"""
        self.status = "Cancelled"
        self.cancelled_by = frappe.session.user
        self.cancelled_on = nowdate() 