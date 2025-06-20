# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import getdate, nowdate, flt

class FeasibilityStudy(Document):
	def validate(self):
		# Validate dates
		self.validate_dates()
		
		# Calculate total project cost
		self.calculate_total_project_cost()
		
		# Validate financial metrics
		self.validate_financial_metrics()
	
	def on_update(self):
		# Add comment on status change
		if self.has_value_changed('status'):
			self.add_status_comment()
		
		# Add comment on conclusion change
		if self.has_value_changed('overall_feasibility_conclusion'):
			self.add_conclusion_comment()
		
		# Update linked lead if conclusion is made
		if self.lead_reference and self.has_value_changed('overall_feasibility_conclusion'):
			self.update_lead_status()
	
	def validate_dates(self):
		"""Validate study date and expected project dates"""
		if self.study_date and getdate(self.study_date) > getdate(nowdate()):
			frappe.throw("Study Date cannot be in the future")
		
		if self.expected_start_date and self.expected_completion_date:
			if getdate(self.expected_completion_date) < getdate(self.expected_start_date):
				frappe.throw("Expected Completion Date cannot be before Expected Start Date")
	
	def calculate_total_project_cost(self):
		"""Calculate the total project cost from all cost components"""
		total = 0
		cost_fields = [
			'land_acquisition_cost', 'design_cost', 'construction_cost', 
			'equipment_cost', 'permit_fees', 'contingency_cost', 'other_costs'
		]
		
		for field in cost_fields:
			if self.get(field):
				total += flt(self.get(field))
		
		self.total_project_cost = total
	
	def validate_financial_metrics(self):
		"""Validate financial metrics are within reasonable ranges"""
		if self.roi is not None and (flt(self.roi) < -100 or flt(self.roi) > 1000):
			frappe.msgprint("ROI value seems unusual. Please verify.", indicator='orange')
		
		if self.irr is not None and (flt(self.irr) < -100 or flt(self.irr) > 1000):
			frappe.msgprint("IRR value seems unusual. Please verify.", indicator='orange')
		
		if self.debt_service_coverage_ratio is not None and flt(self.debt_service_coverage_ratio) < 0:
			frappe.throw("Debt Service Coverage Ratio cannot be negative")
	
	def add_status_comment(self):
		"""Add a comment when the status changes"""
		comment = f"Status changed to {self.status}"
		
		frappe.get_doc({
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": self.doctype,
			"reference_name": self.name,
			"content": comment
		}).insert(ignore_permissions=True)
	
	def add_conclusion_comment(self):
		"""Add a comment when a conclusion is made"""
		comment = f"Feasibility Conclusion: {self.overall_feasibility_conclusion}"
		
		if self.recommendation:
			# Extract text from HTML content
			import re
			plain_text = re.sub('<.*?>', ' ', self.recommendation)
			plain_text = re.sub('\s+', ' ', plain_text).strip()
			
			# Add a summary of the recommendation
			if len(plain_text) > 150:
				comment += f"\nRecommendation Summary: {plain_text[:150]}..."
			else:
				comment += f"\nRecommendation: {plain_text}"
		
		frappe.get_doc({
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": self.doctype,
			"reference_name": self.name,
			"content": comment
		}).insert(ignore_permissions=True)
	
	def update_lead_status(self):
		"""Update the linked Construction Lead status based on feasibility conclusion"""
		if not self.lead_reference:
			return
		
		try:
			lead = frappe.get_doc("Construction Lead", self.lead_reference)
			
			if self.overall_feasibility_conclusion == "Not Feasible":
				lead.status = "Disqualified"
				lead.add_comment("Info", f"Disqualified based on Feasibility Study {self.name} conclusion: Not Feasible")
				lead.save()
			elif self.overall_feasibility_conclusion in ["Highly Feasible", "Feasible"]:
				if lead.status != "Converted":
					lead.status = "Qualified"
					lead.add_comment("Info", f"Qualified based on Feasibility Study {self.name} conclusion: {self.overall_feasibility_conclusion}")
					lead.save()
		except Exception as e:
			frappe.log_error(f"Failed to update Construction Lead {self.lead_reference} from Feasibility Study {self.name}: {str(e)}")
	
	def generate_conclusion(self):
		"""Generate overall conclusion based on individual conclusions"""
		conclusion_fields = [
			'technical_feasibility_conclusion', 
			'financial_feasibility_conclusion',
			'market_feasibility_conclusion',
			'legal_feasibility_conclusion',
			'timeline_feasibility_conclusion'
		]
		
		# Check if all conclusion fields are filled
		missing_fields = []
		for field in conclusion_fields:
			if not self.get(field):
				missing_fields.append(frappe.meta.get_label(self.doctype, field))
		
		if missing_fields:
			frappe.throw(f"Please complete the following conclusions first: {', '.join(missing_fields)}")
		
		# Calculate overall conclusion based on individual conclusions
		conclusion_values = {
			"Highly Feasible": 4,
			"Feasible": 3,
			"Marginally Feasible": 2,
			"Not Feasible": 1
		}
		
		total_value = 0
		for field in conclusion_fields:
			total_value += conclusion_values[self.get(field)]
		
		avg_value = total_value / len(conclusion_fields)
		
		if avg_value >= 3.5:
			overall_conclusion = "Highly Feasible"
		elif avg_value >= 2.5:
			overall_conclusion = "Feasible"
		elif avg_value >= 1.5:
			overall_conclusion = "Marginally Feasible"
		else:
			overall_conclusion = "Not Feasible"
		
		# Check if any individual conclusion is "Not Feasible"
		has_not_feasible = False
		for field in conclusion_fields:
			if self.get(field) == "Not Feasible":
				has_not_feasible = True
				break
		
		# If any conclusion is "Not Feasible", cap the overall at "Marginally Feasible"
		if has_not_feasible and overall_conclusion == "Highly Feasible":
			overall_conclusion = "Feasible"
		elif has_not_feasible and overall_conclusion == "Feasible":
			overall_conclusion = "Marginally Feasible"
		
		self.overall_feasibility_conclusion = overall_conclusion
		
		# Generate recommendation text
		recommendation = "<p><strong>Summary of Findings:</strong></p><ul>"
		for field in conclusion_fields:
			label = frappe.meta.get_label(self.doctype, field)
			recommendation += f"<li>{label}: {self.get(field)}</li>"
		recommendation += "</ul>"
		
		recommendation += f"<p><strong>Overall Conclusion:</strong> {overall_conclusion}</p>"
		
		if overall_conclusion in ["Highly Feasible", "Feasible"]:
			recommendation += "<p><strong>Recommendation:</strong> Proceed with the project. "
			if overall_conclusion == "Feasible":
				recommendation += "Address any concerns identified in the individual assessments."
			recommendation += "</p>"
		elif overall_conclusion == "Marginally Feasible":
			recommendation += "<p><strong>Recommendation:</strong> Proceed with caution. Address all identified issues before committing resources. Consider project modifications to improve feasibility.</p>"
		else:
			recommendation += "<p><strong>Recommendation:</strong> Do not proceed with the project in its current form. Major revisions or reconsideration of the project scope is required.</p>"
		
		self.recommendation = recommendation

@frappe.whitelist()
def make_project_estimation(source_name, target_doc=None):
	"""Create a Project Estimation from a Feasibility Study"""
	def set_missing_values(source, target):
		target.feasibility_study = source.name
		target.lead_reference = source.lead_reference
		target.project_type = source.project_type
		target.estimated_budget = source.total_project_cost
		target.currency = source.currency
		target.expected_start_date = source.expected_start_date
		target.expected_completion_date = source.expected_completion_date
		target.project_description = source.project_description
		target.project_location = source.project_location
	
	doclist = get_mapped_doc("Feasibility Study", source_name, {
		"Feasibility Study": {
			"doctype": "Project Estimation",
			"field_map": {
				"name": "feasibility_study",
				"lead_reference": "lead_reference",
				"lead_name": "lead_name",
				"organization": "organization",
				"total_project_cost": "estimated_budget"
			}
		}
	}, target_doc, set_missing_values)
	
	return doclist