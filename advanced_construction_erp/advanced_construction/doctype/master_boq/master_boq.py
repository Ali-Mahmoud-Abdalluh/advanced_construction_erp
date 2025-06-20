import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, today

class MasterBOQ(Document):
    def validate(self):
        self.update_item_amounts()
        self.calculate_total_amount()
        self.validate_hierarchical_items()
        
    def before_save(self):
        if self.status == "Submitted" and not self.prepared_by:
            self.prepared_by = frappe.session.user
            self.prepared_on = today()
    
    def on_submit(self):
        if self.status not in ["Submitted", "Approved"]:
            frappe.throw(_("Only BOQs with 'Submitted' or 'Approved' status can be submitted."))
    
    def on_cancel(self):
        self.status = "Cancelled"
    
    def update_item_amounts(self):
        """Update amounts for all BOQ items"""
        for item in self.boq_items:
            # Calculate main amount
            item.amount = flt(item.quantity) * flt(item.rate)
            
            # Calculate alternative amounts
            if item.alternative_rate_1:
                item.alternative_amount_1 = flt(item.quantity) * flt(item.alternative_rate_1)
            else:
                item.alternative_amount_1 = 0
                
            if item.alternative_rate_2:
                item.alternative_amount_2 = flt(item.quantity) * flt(item.alternative_rate_2)
            else:
                item.alternative_amount_2 = 0
                
            if item.alternative_rate_3:
                item.alternative_amount_3 = flt(item.quantity) * flt(item.alternative_rate_3)
            else:
                item.alternative_amount_3 = 0
    
    def calculate_total_amount(self):
        """Calculate total amount for the BOQ"""
        total = 0
        
        if self.allow_hierarchical_items:
            # If hierarchical, we only sum top-level items that are not groups
            # and all group items
            for item in self.boq_items:
                if not item.parent_item and not item.is_group:
                    total += flt(item.amount)
                elif item.is_group:
                    # For group items, calculate the sum of all its direct children
                    children_total = 0
                    for child in self.boq_items:
                        if child.parent_item == item.name:
                            children_total += flt(child.amount)
                    
                    # Update group item amount
                    item.amount = children_total
                    total += children_total
        else:
            # If not hierarchical, simply sum all items
            for item in self.boq_items:
                total += flt(item.amount)
                
        self.total_amount = total
    
    def validate_hierarchical_items(self):
        """Validate hierarchical structure of BOQ items"""
        if not self.allow_hierarchical_items:
            # Clear parent_item and is_group fields if hierarchical items are not allowed
            for item in self.boq_items:
                item.parent_item = None
                item.is_group = 0
            return
        
        # Validate parent-child relationships
        item_dict = {}
        for i, item in enumerate(self.boq_items):
            item_dict[item.name] = {"idx": i, "parent": item.parent_item, "is_group": item.is_group}
        
        for item in self.boq_items:
            if item.parent_item:
                # Check if parent exists
                if item.parent_item not in item_dict:
                    frappe.throw(_("Parent item {0} does not exist for item {1}").format(
                        item.parent_item, item.item_name))
                
                # Check if parent is a group
                if not item_dict[item.parent_item]["is_group"]:
                    frappe.throw(_("Parent item {0} must be a group item").format(
                        item.parent_item))
                
                # Check for circular references
                parent = item.parent_item
                while parent:
                    if parent == item.name:
                        frappe.throw(_("Circular reference detected in item {0}").format(
                            item.item_name))
                    parent = item_dict[parent]["parent"] if parent in item_dict and item_dict[parent]["parent"] else None
    
    def import_from_detailed_estimate(self):
        """Import data from linked detailed estimate"""
        if not self.based_on_detailed_estimate or not self.detailed_estimate:
            frappe.throw(_("No detailed estimate selected for import."))
            
        detailed_estimate = frappe.get_doc("Detailed Estimate", self.detailed_estimate)
        
        # Import data from detailed estimate
        if detailed_estimate:
            self.project = detailed_estimate.project
            
            # Clear existing items
            self.boq_items = []
            
            # Create sections based on CSI divisions
            csi_divisions = {}
            for item in detailed_estimate.estimate_items:
                if item.csi_division not in csi_divisions:
                    # Create a new section for this CSI division
                    section_name = f"BOQ-{item.csi_division.split(' - ')[0]}"
                    section_item = {
                        "item_type": "Section",
                        "is_group": 1,
                        "item_code": section_name,
                        "item_name": item.csi_division,
                        "quantity": 1,
                        "unit": "ls",
                        "rate": 0
                    }
                    self.append("boq_items", section_item)
                    csi_divisions[item.csi_division] = len(self.boq_items) - 1
            
            # Add items under their respective sections
            for item in detailed_estimate.estimate_items:
                section_idx = csi_divisions[item.csi_division]
                section_name = self.boq_items[section_idx].name
                
                # Create BOQ item
                boq_item = {
                    "item_type": "Item",
                    "parent_item": section_name,
                    "is_group": 0,
                    "item_code": item.item_code,
                    "item_name": item.description[:40] if item.description else item.item_code,
                    "description": item.description,
                    "specification_reference": item.specification_reference,
                    "drawing_reference": item.drawing_reference,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "rate": item.unit_cost,
                    "amount": item.total_cost,
                    "notes": f"From Detailed Estimate: {self.detailed_estimate}"
                }
                self.append("boq_items", boq_item)
            
            # Update all amounts
            self.update_item_amounts()
            self.calculate_total_amount()
    
    def create_new_revision(self):
        """Create a new revision of this BOQ"""
        if self.status not in ["Approved", "Rejected"]:
            frappe.throw(_("Only approved or rejected BOQs can be revised."))
            
        new_boq = frappe.copy_doc(self)
        new_boq.status = "Draft"
        new_boq.revision_number = self.revision_number + 1
        
        # Clear approval fields
        new_boq.prepared_by = ""
        new_boq.prepared_on = None
        new_boq.reviewed_by = ""
        new_boq.reviewed_on = None
        new_boq.approved_by = ""
        new_boq.approved_on = None
        new_boq.rejected_by = ""
        new_boq.rejected_on = None
        new_boq.rejection_reason = ""
        
        return new_boq
    
    def approve(self):
        """Approve the BOQ"""
        if self.status != "Submitted":
            frappe.throw(_("Only submitted BOQs can be approved."))
            
        self.status = "Approved"
        self.approved_by = frappe.session.user
        self.approved_on = today()
        self.save()
        
    def reject(self, reason):
        """Reject the BOQ with a reason"""
        if self.status != "Submitted":
            frappe.throw(_("Only submitted BOQs can be rejected."))
            
        self.status = "Rejected"
        self.rejected_by = frappe.session.user
        self.rejected_on = today()
        self.rejection_reason = reason
        self.save()
    
    def verify_quantity(self, item_idx, verified=True):
        """Verify quantity for a BOQ item"""
        if not self.enable_quantity_verification:
            frappe.throw(_("Quantity verification is not enabled for this BOQ."))
            
        if item_idx < 0 or item_idx >= len(self.boq_items):
            frappe.throw(_("Invalid item index."))
            
        self.boq_items[item_idx].quantity_verified = verified
        self.boq_items[item_idx].verified_by = frappe.session.user
        self.boq_items[item_idx].verified_on = today()
        
        # Update amounts after verification
        self.update_item_amounts()
        self.calculate_total_amount()
        self.save()

# Function to create master BOQ from detailed estimate
@frappe.whitelist()
def make_master_boq(source_name, target_doc=None):
    """Create a new master BOQ from detailed estimate"""
    from frappe.model.mapper import get_mapped_doc
    
    def set_missing_values(source, target):
        target.based_on_detailed_estimate = 1
        target.detailed_estimate = source.name
        target.import_from_detailed_estimate()
    
    doc = get_mapped_doc("Detailed Estimate", source_name, {
        "Detailed Estimate": {
            "doctype": "Master BOQ",
            "field_map": {
                "name": "detailed_estimate",
                "project": "project"
            },
        }
    }, target_doc, set_missing_values)
    
    return doc

@frappe.whitelist()
def export_to_excel(master_boq):
    """Export the BOQ to Excel format"""
    from frappe.utils.xlsxutils import make_xlsx
    
    boq = frappe.get_doc("Master BOQ", master_boq)
    
    data = []
    
    # Add header row
    headers = ["Item Code", "Item Name", "Description", "Quantity", "Unit", "Rate", "Amount", 
               "Specification Reference", "Drawing Reference"]
    data.append(headers)
    
    # Function to process items recursively
    def process_items(items, parent=None, level=0):
        for item in items:
            if item.parent_item == parent:
                # Add item to data
                indent = "    " * level
                row = [
                    f"{indent}{item.item_code}",
                    f"{indent}{item.item_name}",
                    item.description,
                    item.quantity,
                    item.unit,
                    item.rate,
                    item.amount,
                    item.specification_reference,
                    item.drawing_reference
                ]
                data.append(row)
                
                # Process children if this is a group
                if item.is_group:
                    process_items(items, item.name, level + 1)
    
    # Process all top-level items
    if boq.allow_hierarchical_items:
        process_items(boq.boq_items)
    else:
        # If not hierarchical, just add all items
        for item in boq.boq_items:
            row = [
                item.item_code,
                item.item_name,
                item.description,
                item.quantity,
                item.unit,
                item.rate,
                item.amount,
                item.specification_reference,
                item.drawing_reference
            ]
            data.append(row)
    
    # Create xlsx file
    xlsx_data = make_xlsx(data, "Master BOQ")
    
    # Return xlsx file
    frappe.response['filename'] = f"{boq.name}.xlsx"
    frappe.response['filecontent'] = xlsx_data
    frappe.response['type'] = 'binary' 