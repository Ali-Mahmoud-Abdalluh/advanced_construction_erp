# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import getdate, nowdate

class OpportunityAssessment(Document):
	def validate(self):
		# Validate scores are within range
		self.validate_scores()
		
		# Validate dates
		self.validate_dates()
		
		# Calculate total score
		self.calculate_total_score()
	
	def on_update(self):
		# Add comment on status change
		if self.has_value_changed('status'):
			self.add_status_comment()
		
		# Add comment on decision change
		if self.has_value_changed('go_no_go_decision'):
			self.add_decision_comment()
	
	def validate_scores(self):
		"""Validate that all scores are within the 0-20 range"""
		score_fields = ['financial_score', 'technical_score', 'strategic_score', 'resource_score', 'risk_score']
		
		for field in score_fields:
			if self.get(field) is not None:
				if self.get(field) < 0 or self.get(field) > 20:
					frappe.throw(f"{field.replace('_', ' ').title()} must be between 0 and 20")
	
	def validate_dates(self):
		"""Validate assessment and decision dates"""
		if self.assessment_date and getdate(self.assessment_date) > getdate(nowdate()):
			frappe.throw("Assessment Date cannot be in the future")
		
		if self.decision_date:
			if getdate(self.decision_date) > getdate(nowdate()):
				frappe.throw("Decision Date cannot be in the future")
			
			if self.assessment_date and getdate(self.decision_date) < getdate(self.assessment_date):
				frappe.throw("Decision Date cannot be before Assessment Date")
	
	def calculate_total_score(self):
		"""Calculate the total score from all individual scores"""
		total = 0
		score_fields = ['financial_score', 'technical_score', 'strategic_score', 'resource_score', 'risk_score']
		
		for field in score_fields:
			if self.get(field) is not None:
				total += self.get(field)
		
		self.total_score = total
		
		# Suggest a decision based on the total score
		if not self.go_no_go_decision and self.status == "Completed":
			if total >= 70:
				self.suggested_decision = "Go"
			elif total >= 50:
				self.suggested_decision = "Conditional Go"
			else:
				self.suggested_decision = "No-Go"
	
	def add_status_comment(self):
		"""Add a comment when the status changes"""
		comment = f"Status changed to {self.status}"
		
		if self.status == "Completed":
			comment += f" with a total score of {self.total_score}/100"
		
		frappe.get_doc({
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": self.doctype,
			"reference_name": self.name,
			"content": comment
		}).insert(ignore_permissions=True)
	
	def add_decision_comment(self):
		"""Add a comment when a decision is made"""
		comment = f"Decision: {self.go_no_go_decision}"
		
		if self.decision_rationale:
			comment += f"\nRationale: {self.decision_rationale}"
		
		frappe.get_doc({
			"doctype": "Comment",
			"comment_type": "Info",
			"reference_doctype": self.doctype,
			"reference_name": self.name,
			"content": comment
		}).insert(ignore_permissions=True)
		
		# If this is linked to a Construction Lead, update the lead status
		if self.lead_reference:
			lead = frappe.get_doc("Construction Lead", self.lead_reference)
			
			if self.go_no_go_decision == "Go":
				lead.status = "Qualified"
				lead.add_comment("Info", f"Qualified based on Opportunity Assessment {self.name}")
				lead.save()
			elif self.go_no_go_decision == "No-Go":
				lead.status = "Disqualified"
				lead.add_comment("Info", f"Disqualified based on Opportunity Assessment {self.name}")
				lead.save()

@frappe.whitelist()
def make_feasibility_study(source_name, target_doc=None):
	"""Create a Feasibility Study from an Opportunity Assessment"""
	def set_missing_values(source, target):
		target.opportunity_assessment = source.name
		target.lead_reference = source.lead_reference
		target.project_type = source.project_type
		target.estimated_budget = source.estimated_budget
		target.currency = source.currency
		target.expected_start_date = source.expected_start_date
		target.expected_completion_date = source.expected_completion_date
		target.project_description = source.project_description
		target.project_location = source.project_location
	
	doclist = get_mapped_doc("Opportunity Assessment", source_name, {
		"Opportunity Assessment": {
			"doctype": "Feasibility Study",
			"field_map": {
				"name": "opportunity_assessment",
				"lead_reference": "lead_reference",
				"lead_name": "lead_name",
				"organization": "organization"
			}
		}
	}, target_doc, set_missing_values)
	
	return doclist