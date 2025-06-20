# Copyright (c) 2023, Your Organization and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc

class ConstructionLead(Document):
    def validate(self):
        self.validate_dates()
        self.validate_contact_info()
        
    def validate_dates(self):
        if self.project_start_date and self.expected_completion_date:
            if self.project_start_date > self.expected_completion_date:
                frappe.throw("Project Start Date cannot be later than Expected Completion Date")
    
    def validate_contact_info(self):
        if not (self.email or self.phone):
            frappe.msgprint("Either Email or Phone should be provided for better follow-up", alert=True)
    
    def before_save(self):
        # Auto-calculate probability based on project details completeness
        score = 0
        total_fields = 8  # Number of key fields we're checking
        
        if self.company_name: score += 1
        if self.contact_person: score += 1
        if self.email: score += 1
        if self.phone: score += 1
        if self.project_description: score += 1
        if self.project_location: score += 1
        if self.estimated_budget: score += 1
        if self.project_start_date: score += 1
        
        # Set probability based on completeness
        self.probability = (score / total_fields) * 100
    
    def on_update(self):
        # Create timeline event on status change
        if self.has_value_changed('status'):
            frappe.get_doc({
                "doctype": "Comment",
                "comment_type": "Info",
                "reference_doctype": self.doctype,
                "reference_name": self.name,
                "content": f"Status changed to {self.status}"
            }).insert(ignore_permissions=True)

@frappe.whitelist()
def make_opportunity(source_name, target_doc=None):
    def set_missing_values(source, target):
        target.opportunity_from = "Lead"
        target.opportunity_type = source.project_type

    doclist = get_mapped_doc("Construction Lead", source_name, {
        "Construction Lead": {
            "doctype": "Construction Opportunity",
            "field_map": {
                "name": "lead",
                "company_name": "customer_name",
                "email": "contact_email",
                "phone": "contact_mobile",
                "project_description": "opportunity_description",
                "project_type": "project_type",
                "estimated_budget": "estimated_budget",
                "project_location": "site_location"
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist

@frappe.whitelist()
def get_project_type_details(project_type):
    # Return typical budget and duration based on project type
    project_type_details = {
        "Residential": {"typical_budget": 500000, "typical_duration": 180},
        "Commercial": {"typical_budget": 2000000, "typical_duration": 365},
        "Industrial": {"typical_budget": 5000000, "typical_duration": 540},
        "Infrastructure": {"typical_budget": 10000000, "typical_duration": 730},
        "Hospitality": {"typical_budget": 8000000, "typical_duration": 450},
        "Educational": {"typical_budget": 3000000, "typical_duration": 300},
        "Healthcare": {"typical_budget": 6000000, "typical_duration": 365},
        "Mixed-Use": {"typical_budget": 7000000, "typical_duration": 450},
        "Other": {"typical_budget": 1000000, "typical_duration": 270}
    }
    
    return project_type_details.get(project_type, {"typical_budget": 0, "typical_duration": 0}) 