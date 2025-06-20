from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class ConstructionProjectBudgetHistory(Document):
    def validate(self):
        self.validate_amounts()
    
    def validate_amounts(self):
        """Ensure amounts are calculated correctly"""
        if self.quantity and self.rate:
            self.amount = self.quantity * self.rate
            
        if self.amount and self.actual_amount:
            self.variance = self.actual_amount - self.amount
            
    def get_budget_item(self):
        """Get the budget item this history record is linked to"""
        if self.budget_item:
            return frappe.get_doc("Construction Project Budget", self.budget_item)
        return None 