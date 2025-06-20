# Copyright (c) 2023, Your Organization and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import getdate, add_days

class PreConstructionPlan(Document):
    def validate(self):
        self.calculate_overall_completion()
        self.validate_dates()
        
    def calculate_overall_completion(self):
        """Calculate the overall completion percentage based on all phase completions"""
        phases = [
            'site_survey_completion',
            'permits_approvals_completion',
            'design_drawings_completion',
            'resource_planning_completion',
            'preliminary_schedule_completion',
            'risk_assessment_completion',
            'procurement_strategy_completion',
            'stakeholder_communication_completion'
        ]
        
        total = 0
        completed = 0
        
        for phase in phases:
            if hasattr(self, phase) and getattr(self, phase) is not None:
                total += 100
                completed += float(getattr(self, phase))
        
        self.overall_completion = round(completed / total * 100, 0) if total > 0 else 0
        
        # Update status based on completion
        if self.overall_completion == 100:
            self.status = 'Completed'
        elif self.overall_completion > 0:
            self.status = 'In Progress'
    
    def validate_dates(self):
        """Validate that dates are in logical order"""
        if self.plan_date and self.target_completion_date:
            if getdate(self.plan_date) > getdate(self.target_completion_date):
                frappe.throw("Plan Date cannot be later than Target Completion Date")
    
    def on_submit(self):
        """Actions to perform on submission"""
        # Update opportunity status if linked
        if self.opportunity:
            frappe.db.set_value("Construction Opportunity", self.opportunity, {
                "pre_construction_plan": self.name,
                "pre_construction_completed": 1
            })
            
            # Add comment to opportunity
            frappe.get_doc({
                "doctype": "Comment",
                "comment_type": "Info",
                "reference_doctype": "Construction Opportunity",
                "reference_name": self.opportunity,
                "content": f"Pre-Construction Plan {self.name} has been completed and submitted. Overall completion: {self.overall_completion}%"
            }).insert(ignore_permissions=True)
    
    def on_cancel(self):
        """Actions to perform on cancellation"""
        if self.opportunity:
            frappe.db.set_value("Construction Opportunity", self.opportunity, {
                "pre_construction_plan": "",
                "pre_construction_completed": 0
            })
            
            # Add comment to opportunity
            frappe.get_doc({
                "doctype": "Comment",
                "comment_type": "Info",
                "reference_doctype": "Construction Opportunity",
                "reference_name": self.opportunity,
                "content": f"Pre-Construction Plan {self.name} has been cancelled"
            }).insert(ignore_permissions=True)

@frappe.whitelist()
def make_construction_project(source_name, target_doc=None):
    """Create a Construction Project from Pre-Construction Plan"""
    def set_missing_values(source, target):
        target.pre_construction_plan = source.name
        target.status = "Planning"
        target.expected_start_date = getdate()
        target.expected_end_date = add_days(getdate(), 365)  # Default to 1 year
    
    doclist = get_mapped_doc("Pre Construction Plan", source_name, {
        "Pre Construction Plan": {
            "doctype": "Construction Project",
            "field_map": {
                "client_name": "customer_name",
                "site_location": "project_location",
                "site_area": "site_area",
                "project_type": "project_type",
                "estimated_budget": "estimated_budget",
                "plan_summary": "project_description",
                "scope_of_work": "scope_of_work"
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist

@frappe.whitelist()
def make_project_budget(source_name, target_doc=None):
    """Create a Project Budget from Pre-Construction Plan"""
    def set_missing_values(source, target):
        target.pre_construction_plan = source.name
        target.reference_doctype = "Pre Construction Plan"
        target.reference_name = source.name
    
    doclist = get_mapped_doc("Pre Construction Plan", source_name, {
        "Pre Construction Plan": {
            "doctype": "Project Budget",
            "field_map": {
                "client_name": "client_name",
                "estimated_budget": "total_budget",
                "project_type": "project_type",
                "site_location": "location"
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist

@frappe.whitelist()
def make_bill_of_quantities(source_name, target_doc=None):
    """Create a Bill of Quantities from Pre-Construction Plan"""
    def set_missing_values(source, target):
        target.pre_construction_plan = source.name
        target.status = "Draft"
    
    doclist = get_mapped_doc("Pre Construction Plan", source_name, {
        "Pre Construction Plan": {
            "doctype": "Bill of Quantities",
            "field_map": {
                "client_name": "client_name",
                "project_type": "project_type",
                "site_location": "project_location",
                "estimated_budget": "estimated_total"
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist 