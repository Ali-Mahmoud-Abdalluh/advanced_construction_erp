import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, today

class PreliminaryEstimate(Document):
    def validate(self):
        self.calculate_costs()
        
    def before_save(self):
        if self.status == "Submitted" and not self.prepared_by:
            self.prepared_by = frappe.session.user
            self.prepared_on = today()
    
    def on_submit(self):
        if self.status not in ["Submitted", "Approved"]:
            frappe.throw(_("Only estimates with 'Submitted' or 'Approved' status can be submitted."))
    
    def on_cancel(self):
        self.status = "Cancelled"
    
    def calculate_costs(self):
        """Calculate all costs based on estimate items"""
        self.total_material_cost = 0
        self.total_labor_cost = 0
        self.total_equipment_cost = 0
        self.total_subcontractor_cost = 0
        
        for item in self.estimate_items:
            # Calculate individual item costs
            item.total_material_cost = flt(item.material_cost_per_unit) * flt(item.quantity)
            item.total_labor_cost = flt(item.labor_hours_per_unit) * flt(item.labor_rate_per_hour) * flt(item.quantity)
            
            if item.equipment_hours_per_unit and item.equipment_rate_per_hour:
                item.total_equipment_cost = flt(item.equipment_hours_per_unit) * flt(item.equipment_rate_per_hour) * flt(item.quantity)
            else:
                item.total_equipment_cost = 0
                
            if item.subcontractor_cost_per_unit:
                item.total_subcontractor_cost = flt(item.subcontractor_cost_per_unit) * flt(item.quantity)
            else:
                item.total_subcontractor_cost = 0
            
            # Calculate total cost per unit and total cost
            item.total_cost_per_unit = (
                flt(item.material_cost_per_unit) + 
                (flt(item.labor_hours_per_unit) * flt(item.labor_rate_per_hour)) +
                (flt(item.equipment_hours_per_unit) * flt(item.equipment_rate_per_hour)) +
                flt(item.subcontractor_cost_per_unit)
            )
            
            item.total_cost = item.total_cost_per_unit * flt(item.quantity)
            
            # Add to parent totals
            self.total_material_cost += flt(item.total_material_cost)
            self.total_labor_cost += flt(item.total_labor_cost)
            self.total_equipment_cost += flt(item.total_equipment_cost)
            self.total_subcontractor_cost += flt(item.total_subcontractor_cost)
        
        # Calculate total base cost
        self.total_base_cost = (
            flt(self.total_material_cost) + 
            flt(self.total_labor_cost) + 
            flt(self.total_equipment_cost) + 
            flt(self.total_subcontractor_cost)
        )
        
        # Calculate overhead, profit, and contingency amounts
        self.overhead_amount = flt(self.total_base_cost) * (flt(self.overhead_percentage) / 100)
        self.profit_amount = flt(self.total_base_cost) * (flt(self.profit_percentage) / 100)
        self.contingency_amount = flt(self.total_base_cost) * (flt(self.contingency_percentage) / 100)
        
        # Calculate total estimated cost
        self.total_estimated_cost = (
            flt(self.total_base_cost) + 
            flt(self.overhead_amount) + 
            flt(self.profit_amount) + 
            flt(self.contingency_amount)
        )
    
    def create_new_revision(self):
        """Create a new revision of this estimate"""
        if self.status not in ["Approved", "Rejected"]:
            frappe.throw(_("Only approved or rejected estimates can be revised."))
            
        new_estimate = frappe.copy_doc(self)
        new_estimate.status = "Draft"
        new_estimate.revision_number = self.revision_number + 1
        
        # Clear approval fields
        new_estimate.prepared_by = ""
        new_estimate.prepared_on = None
        new_estimate.reviewed_by = ""
        new_estimate.reviewed_on = None
        new_estimate.approved_by = ""
        new_estimate.approved_on = None
        new_estimate.rejected_by = ""
        new_estimate.rejected_on = None
        new_estimate.rejection_reason = ""
        
        return new_estimate
    
    def approve(self):
        """Approve the estimate"""
        if self.status != "Submitted":
            frappe.throw(_("Only submitted estimates can be approved."))
            
        self.status = "Approved"
        self.approved_by = frappe.session.user
        self.approved_on = today()
        self.save()
        
    def reject(self, reason):
        """Reject the estimate with a reason"""
        if self.status != "Submitted":
            frappe.throw(_("Only submitted estimates can be rejected."))
            
        self.status = "Rejected"
        self.rejected_by = frappe.session.user
        self.rejected_on = today()
        self.rejection_reason = reason
        self.save()
    
    def import_from_conceptual_estimate(self):
        """Import data from linked conceptual estimate"""
        if not self.based_on_conceptual_estimate or not self.conceptual_estimate:
            frappe.throw(_("No conceptual estimate selected for import."))
            
        conceptual_estimate = frappe.get_doc("Conceptual Estimate", self.conceptual_estimate)
        
        # Import data from conceptual estimate
        if conceptual_estimate:
            self.project = conceptual_estimate.project
            self.contingency_percentage = conceptual_estimate.contingency_percentage
            
            # Clear existing items and create new ones based on conceptual estimate
            self.estimate_items = []
            
            for item in conceptual_estimate.estimate_items:
                # Create a basic preliminary estimate item from conceptual
                self.append("estimate_items", {
                    "assembly_category": "Other",
                    "assembly_name": item.name_of_element,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit": item.unit_of_measurement,
                    "material_cost_per_unit": item.rate / 2,  # Simplified conversion
                    "labor_hours_per_unit": 1,  # Default placeholder
                    "labor_rate_per_hour": item.rate / 4,  # Simplified conversion
                    "equipment_hours_per_unit": 0.5,  # Default placeholder
                    "equipment_rate_per_hour": item.rate / 8,  # Simplified conversion
                })
            
            self.calculate_costs() 