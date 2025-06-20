# Copyright (c) 2023, Your Organization and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import getdate

class SiteFeasibilityAnalysis(Document):
    def validate(self):
        self.calculate_feasibility_score()
        self.validate_mandatory_fields()
    
    def calculate_feasibility_score(self):
        """Calculate the overall feasibility score based on individual scores"""
        weights = {
            'technical': 0.25,
            'financial': 0.3,
            'legal': 0.2,
            'environmental': 0.15,
            'social': 0.1
        }
        
        # Default values if not provided
        if not self.technical_feasibility:
            self.technical_feasibility = 0
        if not self.financial_feasibility:
            self.financial_feasibility = 0
        if not self.legal_feasibility:
            self.legal_feasibility = 0
        if not self.environmental_feasibility:
            self.environmental_feasibility = 0
        if not self.social_feasibility:
            self.social_feasibility = 0
        
        # Calculate weighted score
        score = (
            float(self.technical_feasibility) * weights['technical'] +
            float(self.financial_feasibility) * weights['financial'] +
            float(self.legal_feasibility) * weights['legal'] +
            float(self.environmental_feasibility) * weights['environmental'] +
            float(self.social_feasibility) * weights['social']
        )
        
        self.feasibility_score = round(score, 2)
        
        # Set recommendation based on score
        if score < 40:
            self.recommendation = 'Not Feasible - Significant issues found'
        elif score < 60:
            self.recommendation = 'Marginally Feasible - Major concerns need to be addressed'
        elif score < 80:
            self.recommendation = 'Feasible with Conditions - Some concerns need to be addressed'
        else:
            self.recommendation = 'Highly Feasible - Proceed with the project'
    
    def validate_mandatory_fields(self):
        """Validate mandatory fields before submission"""
        if self.docstatus == 1:  # On submit
            if not self.client_name:
                frappe.throw("Client Name is mandatory for submission")
            if not self.site_location:
                frappe.throw("Site Location is mandatory for submission")
            if not self.project_type:
                frappe.throw("Project Type is mandatory for submission")
            if not self.conclusion:
                frappe.throw("Conclusion is mandatory for submission")
    
    def on_submit(self):
        """On submission actions"""
        # Update opportunity if linked
        if self.opportunity:
            # Update the opportunity with the feasibility results
            frappe.db.set_value("Construction Opportunity", self.opportunity, {
                "feasibility_completed": 1,
                "feasibility_score": self.feasibility_score,
                "feasibility_recommendation": self.recommendation
            })
            
            # Add a comment to the opportunity
            frappe.get_doc({
                "doctype": "Comment",
                "comment_type": "Info",
                "reference_doctype": "Construction Opportunity",
                "reference_name": self.opportunity,
                "content": f"Site Feasibility Analysis completed with score {self.feasibility_score}/100. Recommendation: {self.recommendation}"
            }).insert(ignore_permissions=True)
    
    def on_cancel(self):
        """On cancellation actions"""
        if self.opportunity:
            # Remove feasibility information from opportunity
            frappe.db.set_value("Construction Opportunity", self.opportunity, {
                "feasibility_completed": 0,
                "feasibility_score": 0,
                "feasibility_recommendation": ""
            })
            
            # Add a comment to the opportunity
            frappe.get_doc({
                "doctype": "Comment",
                "comment_type": "Info",
                "reference_doctype": "Construction Opportunity",
                "reference_name": self.opportunity,
                "content": "Site Feasibility Analysis cancelled"
            }).insert(ignore_permissions=True)

@frappe.whitelist()
def make_pre_construction_plan(source_name, target_doc=None):
    """Create a Pre-Construction Plan from Site Feasibility Analysis"""
    def set_missing_values(source, target):
        target.site_feasibility_analysis = source.name
        target.status = "Draft"
        target.plan_date = getdate()
    
    doclist = get_mapped_doc("Site Feasibility Analysis", source_name, {
        "Site Feasibility Analysis": {
            "doctype": "Pre Construction Plan",
            "field_map": {
                "client_name": "client_name",
                "opportunity": "opportunity",
                "site_location": "site_location",
                "site_area": "site_area",
                "project_type": "project_type",
                "estimated_budget": "estimated_budget",
                "recommendation": "feasibility_recommendation",
                "feasibility_score": "feasibility_score"
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist 