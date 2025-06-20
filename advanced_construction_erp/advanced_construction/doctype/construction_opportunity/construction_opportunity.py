# Copyright (c) 2023, Your Organization and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import getdate, add_days

class ConstructionOpportunity(Document):
    def validate(self):
        self.validate_dates()
        self.calculate_opportunity_score()
        
    def validate_dates(self):
        if self.opportunity_date and self.expected_closing_date:
            if getdate(self.opportunity_date) > getdate(self.expected_closing_date):
                frappe.throw("Opportunity Date cannot be later than Expected Closing Date")
                
        if self.expected_start_date and self.expected_closing_date:
            if getdate(self.expected_start_date) < getdate(self.expected_closing_date):
                frappe.msgprint("Expected Start Date should ideally be after the Expected Closing Date", alert=True)
    
    def calculate_opportunity_score(self):
        """Calculate opportunity score based on multiple factors (0-100)"""
        score = 0
        max_score = 0
        
        # Budget factor (0-20 points)
        if self.estimated_budget:
            max_score += 20
            if self.estimated_budget < 100000:
                score += 5
            elif self.estimated_budget < 500000:
                score += 10
            elif self.estimated_budget < 2000000:
                score += 15
            else:
                score += 20
        
        # Probability factor (0-25 points)
        if self.probability:
            max_score += 25
            score += (self.probability / 100) * 25
        
        # Timeline factor (0-15 points)
        if self.expected_closing_date:
            max_score += 15
            days_to_close = (getdate(self.expected_closing_date) - getdate()).days
            if days_to_close < 0:
                score += 0  # Past due
            elif days_to_close < 30:
                score += 15  # Closing soon
            elif days_to_close < 90:
                score += 10  # Medium term
            else:
                score += 5  # Long term
        
        # Competition factor (0-20 points)
        if hasattr(self, 'competing_companies') and self.competing_companies:
            max_score += 20
            num_competitors = len(self.competing_companies)
            if num_competitors == 0:
                score += 20  # No competition
            elif num_competitors < 3:
                score += 15  # Low competition
            elif num_competitors < 5:
                score += 10  # Medium competition
            else:
                score += 5  # High competition
        
        # Risk factor (0-20 points)
        if hasattr(self, 'risk_factors') and self.risk_factors:
            max_score += 20
            total_risk = sum(risk.impact * risk.probability / 100 for risk in self.risk_factors)
            avg_risk = total_risk / len(self.risk_factors) if self.risk_factors else 0
            
            if avg_risk < 2:
                score += 20  # Very low risk
            elif avg_risk < 4:
                score += 15  # Low risk
            elif avg_risk < 6:
                score += 10  # Medium risk
            elif avg_risk < 8:
                score += 5  # High risk
            else:
                score += 0  # Very high risk
        
        # Calculate final score (normalize to 100)
        self.opportunity_score = (score / max_score * 100) if max_score > 0 else 0
    
    def on_update(self):
        self.update_lead_status()
        
        # Create timeline event on status change
        if self.has_value_changed('status'):
            frappe.get_doc({
                "doctype": "Comment",
                "comment_type": "Info",
                "reference_doctype": self.doctype,
                "reference_name": self.name,
                "content": f"Status changed to {self.status}"
            }).insert(ignore_permissions=True)
    
    def update_lead_status(self):
        """Update the lead status if this opportunity was created from a lead"""
        if self.opportunity_from == "Lead" and self.lead:
            lead_status = None
            
            if self.status == "Qualified":
                lead_status = "Qualified"
            elif self.status == "Won":
                lead_status = "Converted"
            elif self.status == "Lost" or self.status == "Closed":
                lead_status = "Closed"
                
            if lead_status:
                frappe.db.set_value("Construction Lead", self.lead, "status", lead_status)

@frappe.whitelist()
def make_feasibility_study(source_name, target_doc=None):
    def set_missing_values(source, target):
        target.opportunity = source.name
        target.project_type = source.project_type
        
    doclist = get_mapped_doc("Construction Opportunity", source_name, {
        "Construction Opportunity": {
            "doctype": "Site Feasibility Analysis",
            "field_map": {
                "customer_name": "client_name",
                "site_location": "site_location",
                "site_area": "site_area",
                "project_type": "project_type",
                "estimated_budget": "estimated_budget",
                "project_requirements": "project_requirements"
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist

@frappe.whitelist()
def make_project_budget(source_name, target_doc=None):
    def set_missing_values(source, target):
        target.opportunity = source.name
        target.reference_doctype = "Construction Opportunity"
        target.reference_name = source.name
        
    doclist = get_mapped_doc("Construction Opportunity", source_name, {
        "Construction Opportunity": {
            "doctype": "Project Budget",
            "field_map": {
                "customer_name": "client_name",
                "estimated_budget": "total_budget",
                "project_type": "project_type",
                "site_location": "location"
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist

@frappe.whitelist()
def make_construction_project(source_name, target_doc=None):
    def set_missing_values(source, target):
        target.opportunity = source.name
        target.expected_end_date = add_days(getdate(source.expected_start_date), source.estimated_duration or 365)
        
    doclist = get_mapped_doc("Construction Opportunity", source_name, {
        "Construction Opportunity": {
            "doctype": "Construction Project",
            "field_map": {
                "customer_name": "customer_name",
                "site_location": "project_location",
                "estimated_budget": "estimated_budget",
                "project_type": "project_type",
                "expected_start_date": "expected_start_date",
                "site_area": "site_area",
                "project_requirements": "project_requirements"
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist

@frappe.whitelist()
def get_historical_probability(project_type):
    """Get historical win probability based on project type"""
    # Query completed opportunities with the same project type
    opportunities = frappe.get_all(
        "Construction Opportunity",
        filters={
            "project_type": project_type,
            "status": ["in", ["Won", "Lost", "Closed"]]
        },
        fields=["status"]
    )
    
    if not opportunities:
        # Return default probabilities based on project type if no historical data
        default_probabilities = {
            "Residential": 65,
            "Commercial": 55,
            "Industrial": 50,
            "Infrastructure": 40,
            "Hospitality": 45,
            "Educational": 60,
            "Healthcare": 55,
            "Mixed-Use": 50,
            "Other": 45
        }
        return default_probabilities.get(project_type, 50)
    
    # Calculate win rate from historical data
    won = sum(1 for opp in opportunities if opp.status == "Won")
    total = len(opportunities)
    
    win_rate = (won / total) * 100 if total > 0 else 50
    return win_rate
