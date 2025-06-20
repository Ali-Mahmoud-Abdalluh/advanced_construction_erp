from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, cint, getdate, nowdate, add_days, add_months

class ConstructionProjectBudget(Document):
    def validate(self):
        self.validate_item()
        self.calculate_amount()
        self.calculate_variance()
        self.check_budget_limits()

    def validate_item(self):
        if self.item_code:
            item = frappe.get_doc("Item", self.item_code)
            self.item_name = item.item_name
            if not self.unit:
                self.unit = item.stock_uom

    def calculate_amount(self):
        if self.quantity and self.rate:
            self.amount = flt(self.quantity) * flt(self.rate)

    def calculate_variance(self):
        """Calculate variance between budgeted and actual amounts"""
        if self.amount and self.actual_amount:
            self.variance = flt(self.actual_amount) - flt(self.amount)
            if flt(self.amount) != 0:
                self.variance_percentage = (flt(self.variance) / flt(self.amount)) * 100
        else:
            self.variance = 0
            self.variance_percentage = 0

    def check_budget_limits(self):
        """Check if budget exceeds limits and send alerts"""
        if self.parent and self.parenttype == "Construction Project":
            project = frappe.get_doc("Construction Project", self.parent)
            
            # Check if this budget item exceeds its category limit
            if self.budget_category:
                category_budget = frappe.get_value("Project Budget Category", 
                    self.budget_category, "budget_limit")
                
                if category_budget:
                    # Get total budget for this category
                    total_category_budget = frappe.db.sql("""
                        SELECT SUM(amount)
                        FROM `tabConstruction Project Budget`
                        WHERE parent = %s AND parenttype = 'Construction Project'
                        AND budget_category = %s
                    """, (self.parent, self.budget_category))[0][0] or 0
                    
                    if total_category_budget > flt(category_budget):
                        frappe.msgprint(
                            _("Budget for category {0} exceeds the limit of {1}").format(
                                self.budget_category, 
                                frappe.format(category_budget, {"fieldtype": "Currency"})
                            ),
                            alert=True
                        )

    def on_update(self):
        self.update_project_budget()
        self.track_budget_history()

    def update_project_budget(self):
        if self.parent and self.parenttype == "Construction Project":
            project = frappe.get_doc("Construction Project", self.parent)
            total_budget = sum(flt(item.amount) for item in project.budget_items)
            total_actual = sum(flt(item.actual_amount) for item in project.budget_items if item.actual_amount)
            
            project.total_budget = total_budget
            project.actual_cost = total_actual
            project.cost_variance = total_actual - total_budget
            
            project.save()

    def track_budget_history(self):
        """Track budget changes over time"""
        if not self.name:
            return
            
        # Check if there's a previous version with different amount
        previous_amount = frappe.db.get_value("Construction Project Budget History",
            {"budget_item": self.name}, "amount")
            
        if previous_amount is None or flt(previous_amount) != flt(self.amount):
            # Create a budget history record
            history = frappe.new_doc("Construction Project Budget History")
            history.budget_item = self.name
            history.item_code = self.item_code
            history.item_name = self.item_name
            history.quantity = self.quantity
            history.rate = self.rate
            history.amount = self.amount
            history.actual_amount = self.actual_amount
            history.variance = self.variance
            history.date = nowdate()
            history.modified_by = frappe.session.user
            history.insert(ignore_permissions=True)

    def get_purchase_orders(self):
        """Get purchase orders related to this budget item"""
        if not self.item_code or not self.parent:
            return []
            
        return frappe.get_all("Purchase Order Item",
            filters={
                "item_code": self.item_code,
                "project": self.parent
            },
            fields=["parent", "qty", "rate", "amount", "received_qty"],
            order_by="creation desc"
        )

    def get_actual_cost(self):
        """Calculate actual cost from purchase orders and other sources"""
        purchase_orders = self.get_purchase_orders()
        
        total_po_cost = sum(flt(po.amount) for po in purchase_orders)
        
        # TODO: Add costs from other sources like timesheets, expense claims, etc.
        
        return total_po_cost

    def update_actual_cost(self):
        """Update actual cost based on purchase orders and other sources"""
        actual_cost = self.get_actual_cost()
        
        if flt(self.actual_amount) != flt(actual_cost):
            self.actual_amount = actual_cost
            self.calculate_variance()
            self.save()

    def forecast_cost_to_completion(self):
        """Forecast the final cost based on current progress and spending"""
        if not self.parent:
            return 0
            
        project = frappe.get_doc("Construction Project", self.parent)
        if not project.progress or project.progress == 0:
            return self.amount
            
        # Simple forecasting based on current spending and progress
        if self.actual_amount and project.progress:
            # Estimate total cost = (Actual Cost / Progress) * 100
            forecast = (flt(self.actual_amount) / flt(project.progress)) * 100
            return forecast
        
        return self.amount

    def get_cost_trend(self):
        """Get the cost trend over time"""
        if not self.name:
            return []
            
        history = frappe.get_all("Construction Project Budget History",
            filters={"budget_item": self.name},
            fields=["date", "amount", "actual_amount", "variance"],
            order_by="date"
        )
        
        return history 