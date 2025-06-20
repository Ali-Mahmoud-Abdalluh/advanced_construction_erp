import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, today

class DetailedEstimate(Document):
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
        self.total_direct_cost = 0
        
        for item in self.estimate_items:
            # Calculate material costs
            if item.material_rate and item.material_quantity:
                item.material_amount = flt(item.material_rate) * flt(item.material_quantity)
                item.material_waste_amount = flt(item.material_amount) * (flt(item.material_waste_percentage) / 100)
                item.total_material_amount = flt(item.material_amount) + flt(item.material_waste_amount)
            else:
                item.material_amount = 0
                item.material_waste_amount = 0
                item.total_material_amount = 0
                
            # Calculate labor costs
            if item.labor_hours and item.labor_rate:
                item.labor_amount = flt(item.labor_hours) * flt(item.labor_rate)
                item.labor_productivity_amount = flt(item.labor_amount) * (flt(item.labor_productivity_factor) - 1)
                item.total_labor_amount = flt(item.labor_amount) + flt(item.labor_productivity_amount)
            else:
                item.labor_amount = 0
                item.labor_productivity_amount = 0
                item.total_labor_amount = 0
                
            # Calculate equipment costs
            if item.equipment_hours and item.equipment_rate:
                item.equipment_amount = flt(item.equipment_hours) * flt(item.equipment_rate)
                item.equipment_efficiency_amount = flt(item.equipment_amount) * (flt(item.equipment_efficiency_factor) - 1)
                item.total_equipment_amount = flt(item.equipment_amount) + flt(item.equipment_efficiency_amount)
            else:
                item.equipment_amount = 0
                item.equipment_efficiency_amount = 0
                item.total_equipment_amount = 0
                
            # Calculate subcontractor costs
            if item.subcontractor_quote_amount:
                item.subcontractor_markup_amount = flt(item.subcontractor_quote_amount) * (flt(item.subcontractor_markup_percentage) / 100)
                item.total_subcontractor_amount = flt(item.subcontractor_quote_amount) + flt(item.subcontractor_markup_amount)
            else:
                item.subcontractor_markup_amount = 0
                item.total_subcontractor_amount = 0
                
            # Calculate item total
            item.unit_cost = (
                flt(item.total_material_amount) + 
                flt(item.total_labor_amount) + 
                flt(item.total_equipment_amount) + 
                flt(item.total_subcontractor_amount)
            ) / flt(item.quantity) if flt(item.quantity) else 0
            
            item.total_cost = flt(item.unit_cost) * flt(item.quantity)
            
            # Add to total direct cost
            self.total_direct_cost += flt(item.total_cost)
        
        # Calculate indirect costs
        self.general_requirements_amount = flt(self.total_direct_cost) * (flt(self.general_requirements_percentage) / 100)
        self.overhead_amount = flt(self.total_direct_cost) * (flt(self.overhead_percentage) / 100)
        self.profit_amount = flt(self.total_direct_cost) * (flt(self.profit_percentage) / 100)
        self.bond_amount = flt(self.total_direct_cost) * (flt(self.bond_percentage) / 100)
        
        if self.tax_percentage:
            self.tax_amount = flt(self.total_direct_cost) * (flt(self.tax_percentage) / 100)
        else:
            self.tax_amount = 0
            
        self.contingency_amount = flt(self.total_direct_cost) * (flt(self.contingency_percentage) / 100)
        self.escalation_amount = flt(self.total_direct_cost) * (flt(self.escalation_percentage) / 100)
        
        # Calculate total estimated cost
        self.total_estimated_cost = (
            flt(self.total_direct_cost) +
            flt(self.general_requirements_amount) +
            flt(self.overhead_amount) +
            flt(self.profit_amount) +
            flt(self.bond_amount) +
            flt(self.tax_amount) +
            flt(self.contingency_amount) +
            flt(self.escalation_amount)
        )
        
        # Calculate unit cost
        if self.gross_floor_area and flt(self.gross_floor_area) > 0:
            self.cost_per_square_meter = flt(self.total_estimated_cost) / flt(self.gross_floor_area)
        else:
            self.cost_per_square_meter = 0
    
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
    
    def import_from_preliminary_estimate(self):
        """Import data from linked preliminary estimate"""
        if not self.based_on_preliminary_estimate or not self.preliminary_estimate:
            frappe.throw(_("No preliminary estimate selected for import."))
            
        preliminary_estimate = frappe.get_doc("Preliminary Estimate", self.preliminary_estimate)
        
        # Import data from preliminary estimate
        if preliminary_estimate:
            self.project = preliminary_estimate.project
            self.contingency_percentage = preliminary_estimate.contingency_percentage
            self.overhead_percentage = preliminary_estimate.overhead_percentage
            self.profit_percentage = preliminary_estimate.profit_percentage
            
            # Clear existing items and create new ones based on preliminary estimate
            self.estimate_items = []
            
            for item in preliminary_estimate.estimate_items:
                # Convert category to CSI division
                csi_division = self.map_category_to_csi_division(item.assembly_category)
                
                # Create a detailed estimate item from preliminary
                self.append("estimate_items", {
                    "csi_division": csi_division,
                    "item_code": f"DE-{item.assembly_name[:8]}",
                    "description": item.description or item.assembly_name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "material_quantity": item.quantity,
                    "material_unit": item.unit,
                    "material_rate": item.material_cost_per_unit,
                    "material_waste_percentage": 5,
                    "labor_hours": item.labor_hours_per_unit * item.quantity,
                    "labor_rate": item.labor_rate_per_hour,
                    "labor_productivity_factor": 1,
                    "equipment_hours": (item.equipment_hours_per_unit or 0) * item.quantity,
                    "equipment_rate": item.equipment_rate_per_hour or 0,
                    "equipment_efficiency_factor": 1,
                    "subcontractor_quote_amount": item.subcontractor_cost_per_unit * item.quantity if item.subcontractor_cost_per_unit else 0,
                    "subcontractor_markup_percentage": 10
                })
            
            self.calculate_costs()
    
    def map_category_to_csi_division(self, category):
        """Map preliminary estimate category to CSI division"""
        mapping = {
            "Foundation": "03 - Concrete",
            "Superstructure": "05 - Metals",
            "Exterior Enclosure": "07 - Thermal and Moisture Protection",
            "Roofing": "07 - Thermal and Moisture Protection",
            "Interior Construction": "09 - Finishes",
            "Stairs": "05 - Metals",
            "Interior Finishes": "09 - Finishes",
            "Conveying Systems": "14 - Conveying Systems",
            "Plumbing": "15 - Mechanical",
            "HVAC": "15 - Mechanical",
            "Fire Protection": "15 - Mechanical",
            "Electrical": "16 - Electrical",
            "Equipment": "11 - Equipment",
            "Furnishings": "12 - Furnishings",
            "Special Construction": "13 - Special Construction",
            "Site Preparation": "02 - Site Construction",
            "Site Improvements": "02 - Site Construction",
            "Site Utilities": "02 - Site Construction",
            "General Conditions": "01 - General Requirements"
        }
        
        return mapping.get(category, "01 - General Requirements")

# Function to create detailed estimate from preliminary estimate
@frappe.whitelist()
def make_detailed_estimate(source_name, target_doc=None):
    """Create a new detailed estimate from preliminary estimate"""
    from frappe.model.mapper import get_mapped_doc
    
    def set_missing_values(source, target):
        target.based_on_preliminary_estimate = 1
        target.preliminary_estimate = source.name
        target.import_from_preliminary_estimate()
    
    doc = get_mapped_doc("Preliminary Estimate", source_name, {
        "Preliminary Estimate": {
            "doctype": "Detailed Estimate",
            "field_map": {
                "name": "preliminary_estimate",
                "project": "project"
            },
        }
    }, target_doc, set_missing_values)
    
    return doc 